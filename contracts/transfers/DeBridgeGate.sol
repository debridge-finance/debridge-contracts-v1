// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "../interfaces/IWrappedAsset.sol";
import "../interfaces/ISignatureVerifier.sol";
import "../interfaces/IWETH.sol";
import "../interfaces/IDeBridgeGate.sol";
import "../interfaces/IConfirmationAggregator.sol";
import "../interfaces/ICallProxy.sol";
import "../interfaces/IFlashCallback.sol";
import "../libraries/SignatureUtil.sol";

contract DeBridgeGate is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    IDeBridgeGate
{
    using SafeERC20 for IERC20;
    using SignatureUtil for bytes;

    /* ========== STATE VARIABLES ========== */

    // Basis points or bps equal to 1/10000
    // used to express relative values (fees)
    uint256 public constant BPS_DENOMINATOR = 10000;
    bytes32 public constant GOVMONITORING_ROLE = keccak256("GOVMONITORING_ROLE"); // role allowed to stop transfers
    uint256 public constant PROXY_WITH_SENDER_FLAG = 100; //Flag to call proxy with sender contract

    address public signatureVerifier; // current signatureVerifier address to verify signatures
    address public confirmationAggregator; // current aggregator address to verify by oracles confirmations
    uint8 public excessConfirmations; // minimal required confirmations in case of too many confirmations
    uint256 public flashFeeBps; // fee in basis points (1/10000)
    uint256 public nonce; //outgoing submissions count

    mapping(uint256 => address) public callProxyAddresses; // proxy to execute user's calls
    mapping(bytes32 => DebridgeInfo) public getDebridge; // debridgeId (i.e. hash(native chainId, native tokenAddress)) => token
    mapping(bytes32 => DebridgeFeeInfo) public getDebridgeFeeInfo;
    mapping(bytes32 => bool) public isSubmissionUsed; // submissionId (i.e. hash( debridgeId, amount, receiver, nonce)) => whether is claimed
    mapping(bytes32 => bool) public isBlockedSubmission; // submissionId  => is blocked
    mapping(bytes32 => uint256) public getAmountThreshold; // debridge => amount threshold
    mapping(uint256 => ChainSupportInfo) public getChainSupport; // whether the chain for the asset is supported
    mapping(address => DiscountInfo) public feeDiscount; //fee discount for address

    mapping(address => TokenInfo) public getNativeInfo; //return native token info by wrapped token address

    address public defiController; // proxy to use the locked assets in Defi protocols
    address public feeProxy; // proxy to convert the collected fees into Link's
    IWETH public weth; // wrapped native token contract

    /* ========== ERRORS ========== */

    error FeeProxyBadRole();
    error DefiControllerBadRole();
    error AdminBadRole();
    error GovMonitoringBadRole();
    error DebridgeNotFound();

    error WrongChain();
    error WrongTargedChain();
    error WrongArgument();
    error WrongAutoArgument();

    error TransferAmountTooHigh();

    error NotSupportedFixedFee();
    error TransferAmountNotCoverFees();

    error SubmissionUsed();
    error SubmissionNotConfirmed();
    error SubmissionAmountNotConfirmed();
    error SubmissionBlocked();

    error AmountMismatch();

    error AssetAlreadyExist();
    error WrappedAssetNotFound();
    error ZeroAddress();

    error ProposedFeeTooHigh();
    error FeeNotPaid();

    error NotEnoughReserves();

    /* ========== MODIFIERS ========== */

    modifier onlyFeeProxy() {
        if (feeProxy != msg.sender) revert FeeProxyBadRole();
        _;
    }

    modifier onlyDefiController() {
        if (defiController != msg.sender) revert DefiControllerBadRole();
        _;
    }

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert AdminBadRole();
        _;
    }

    modifier onlyGovMonitoring() {
        if (!hasRole(GOVMONITORING_ROLE, msg.sender)) revert GovMonitoringBadRole();
        _;
    }

    /* ========== CONSTRUCTOR  ========== */

    /// @dev Constructor that initializes the most important configurations.
    /// @param _signatureVerifier Aggregator address to verify signatures
    /// @param _confirmationAggregator Aggregator address to verify by oracles confirmations
    function initialize(
        uint8 _excessConfirmations,
        address _signatureVerifier,
        address _confirmationAggregator,
        address _callProxy,
        IWETH _weth,
        address _feeProxy,
        address _defiController
    ) public initializer {
        _addAsset(
            getDebridgeId(getChainId(), address(_weth)),
            address(_weth),
            abi.encodePacked(address(_weth)),
            getChainId()
        );

        signatureVerifier = _signatureVerifier;
        confirmationAggregator = _confirmationAggregator;

        callProxyAddresses[0] = _callProxy;
        defiController = _defiController;
        excessConfirmations = _excessConfirmations;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        weth = _weth;
        feeProxy = _feeProxy;
    }

    /* ========== send, mint, burn, claim ========== */

    /// @dev Locks asset on the chain and enables minting on the other chain.
    /// @param _tokenAddress Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount to be transfered (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function send(
        address _tokenAddress,
        bytes memory _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        bool _useAssetFee,
        uint32 _referralCode,
        bytes calldata _autoParams
    ) external payable override nonReentrant whenNotPaused {
        bytes32 debridgeId;
        // the amount will be reduced by the protocol fee
        (_amount, debridgeId) = _send(
            _tokenAddress,
            _amount,
            _chainIdTo,
            _useAssetFee,
            _referralCode
        );

        SubmissionAutoParamsTo memory autoParams = _validateAutoParams(_autoParams, _amount);
        _amount -= autoParams.executionFee;

        bytes32 submissionId = getSubmissionIdTo(
            debridgeId,
            _chainIdTo,
            _amount,
            _receiver,
            autoParams
        );

        emit Sent(
            submissionId,
            debridgeId,
            _amount,
            _receiver,
            nonce,
            _chainIdTo,
            _referralCode,
            autoParams,
            msg.sender
        );
        nonce++;
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _signatures Array of oracles signatures.
    function mint(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes memory _signatures,
        bytes calldata _autoParams
    ) external override nonReentrant whenNotPaused {
        SubmissionAutoParamsFrom memory autoParams;
        if (_autoParams.length > 0) {
            autoParams = abi.decode(_autoParams, (SubmissionAutoParamsFrom));
        }
        bytes32 submissionId = getSubmissionIdFrom(
            _debridgeId,
            _chainIdFrom,
            _amount,
            _receiver,
            _nonce,
            autoParams
        );

        _checkAndDeployAsset(
            _debridgeId,
            _signatures.length > 0 ? signatureVerifier : confirmationAggregator
        );

        _checkConfirmations(submissionId, _debridgeId, _amount, _signatures);

        _mint(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            autoParams
        );

        emit Minted(
            submissionId,
            _debridgeId,
            _amount,
            _receiver,
            _nonce,
            _chainIdFrom,
            autoParams
        );
    }

    /// @dev Burns wrapped asset and allowss to claim it on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    /// @param _permit deadline + signature for approving the spender by signature.
    function burn(
        bytes32 _debridgeId,
        bytes memory _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        bytes memory _permit,
        bool _useAssetFee,
        uint32 _referralCode,
        bytes calldata _autoParams
    ) external payable override nonReentrant whenNotPaused {
        // the amount will be reduced by the protocol fee
        _amount = _burn(
            _debridgeId,
            _amount,
            _chainIdTo,
            _permit,
            _useAssetFee,
            _referralCode
        );

        SubmissionAutoParamsTo memory autoParams = _validateAutoParams(_autoParams, _amount);
        _amount -= autoParams.executionFee;

        bytes32 submissionId = getSubmissionIdTo(
            _debridgeId,
            _chainIdTo,
            _amount,
            _receiver,
            autoParams
        );

        emit Burnt(
            submissionId,
            _debridgeId,
            _amount,
            _receiver,
            nonce,
            _chainIdTo,
            _referralCode,
            autoParams,
            msg.sender
        );
        nonce++;
    }

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    function claim(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes memory _signatures,
        bytes calldata _autoParams
    ) external override nonReentrant whenNotPaused {

        SubmissionAutoParamsFrom memory autoParams;
        if (_autoParams.length > 0) {
            autoParams = abi.decode(_autoParams, (SubmissionAutoParamsFrom));
        }

        bytes32 submissionId = getSubmissionIdFrom(
            _debridgeId,
            _chainIdFrom,
            _amount,
            _receiver,
            _nonce,
            autoParams
        );

        _checkConfirmations(submissionId, _debridgeId, _amount, _signatures);

        _claim(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            autoParams
        );

        emit Claimed(
            submissionId,
            _debridgeId,
            _amount,
            _receiver,
            _nonce,
            _chainIdFrom,
            autoParams
        );
    }

    function flash(
        address _tokenAddress,
        address _receiver,
        uint256 _amount,
        bytes memory _data
    ) external override nonReentrant whenNotPaused // noDelegateCall
    {
        bytes32 debridgeId = getDebridgeId(getChainId(), _tokenAddress);
        if (!getDebridge[debridgeId].exist) revert DebridgeNotFound();
        uint256 currentFlashFee = (_amount * flashFeeBps) / BPS_DENOMINATOR;
        uint256 balanceBefore = IERC20(_tokenAddress).balanceOf(address(this));

        IERC20(_tokenAddress).safeTransfer(_receiver, _amount);
        IFlashCallback(msg.sender).flashCallback(currentFlashFee, _data);

        uint256 balanceAfter = IERC20(_tokenAddress).balanceOf(address(this));
        if (balanceBefore + currentFlashFee > balanceAfter) revert FeeNotPaid();

        uint256 paid = balanceAfter - balanceBefore;
        getDebridgeFeeInfo[debridgeId].collectedFees += paid;
        emit Flash(msg.sender, _tokenAddress, _receiver, _amount, paid);
    }

    /* ========== ADMIN ========== */

    /// @dev Update asset's fees.
    /// @param _supportedChainIds Chain identifiers.
    /// @param _chainSupportInfo Chain support info.
    function updateChainSupport(
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo
    ) external onlyAdmin {
        for (uint256 i = 0; i < _supportedChainIds.length; i++) {
            getChainSupport[_supportedChainIds[i]] = _chainSupportInfo[i];
        }
        emit ChainsSupportUpdated(_supportedChainIds);
    }

    /// @dev Update asset's fees.
    /// @param _debridgeId Asset identifier.
    /// @param _supportedChainIds Chain identifiers.
    /// @param _assetFeesInfo Chain support info.
    function updateAssetFixedFees(
        bytes32 _debridgeId,
        uint256[] memory _supportedChainIds,
        uint256[] memory _assetFeesInfo
    ) external onlyAdmin {
        DebridgeFeeInfo storage debridgeFee = getDebridgeFeeInfo[_debridgeId];
        for (uint256 i = 0; i < _supportedChainIds.length; i++) {
            debridgeFee.getChainFee[_supportedChainIds[i]] = _assetFeesInfo[i];
        }
    }

    function updateExcessConfirmations(uint8 _excessConfirmations) external onlyAdmin {
        excessConfirmations = _excessConfirmations;
    }

    /// @dev Set support for the chains where the token can be transfered.
    /// @param _chainId Chain id where tokens are sent.
    /// @param _isSupported Whether the token is transferable to the other chain.
    function setChainSupport(uint256 _chainId, bool _isSupported) external onlyAdmin {
        getChainSupport[_chainId].isSupported = _isSupported;
        emit ChainSupportUpdated(_chainId, _isSupported);
    }

    /// @dev Set proxy address.
    /// @param _address Address of the proxy that executes external calls.
    function setCallProxy(uint256 version, address _address) external onlyAdmin {
        if (_address == address(0)) revert WrongArgument();
        callProxyAddresses[version] = _address;
        emit CallProxyUpdated(version, _address);
    }

    /// @dev Add support for the asset.
    /// @param _debridgeId Asset identifier.
    /// @param _maxAmount Maximum amount of current chain token to be wrapped.
    /// @param _minReservesBps Minimal reserve ration in BPS.
    function updateAsset(
        bytes32 _debridgeId,
        uint256 _maxAmount,
        uint16 _minReservesBps,
        uint256 _amountThreshold
    ) external onlyAdmin {
        if (_minReservesBps > BPS_DENOMINATOR) revert WrongArgument();
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        debridge.maxAmount = _maxAmount;
        debridge.minReservesBps = _minReservesBps;
        getAmountThreshold[_debridgeId] = _amountThreshold;
    }

    /// @dev Set aggregator address.
    /// @param _aggregator Submission aggregator address.
    function setAggregator(address _aggregator) external onlyAdmin {
        confirmationAggregator = _aggregator;
    }

    /// @dev Set signature verifier address.
    /// @param _verifier Signature verifier address.
    function setSignatureVerifier(address _verifier) external onlyAdmin {
        signatureVerifier = _verifier;
    }

    /// @dev Set defi controoler.
    /// @param _defiController Defi controller address address.
    function setDefiController(address _defiController) external onlyAdmin {
        // TODO: claim all the reserves before
        defiController = _defiController;
    }

    /// @dev Stop all transfers.
    function pause() external onlyGovMonitoring {
        _pause();
    }

    /// @dev Allow transfers.
    function unpause() external onlyAdmin whenPaused {
        _unpause();
    }

    /// @dev Withdraw fees.
    /// @param _debridgeId Asset identifier.
    function withdrawFee(bytes32 _debridgeId) external override nonReentrant onlyFeeProxy {
        DebridgeFeeInfo storage debridgeFee = getDebridgeFeeInfo[_debridgeId];
        // Amount for transfer to treasure
        uint256 amount = debridgeFee.collectedFees - debridgeFee.withdrawnFees;
        debridgeFee.withdrawnFees += amount;

        if (amount == 0) revert NotEnoughReserves();

        if (_debridgeId == getDebridgeId(getChainId(), address(0))) {
            payable(feeProxy).transfer(amount);
        } else {
            // don't need this check as we check that amount is not zero
            // if (!getDebridge[_debridgeId].exist) revert DebridgeNotFound();
            IERC20(getDebridge[_debridgeId].tokenAddress).safeTransfer(feeProxy, amount);
        }
        emit WithdrawnFee(_debridgeId, amount);
    }

    /// @dev Request the assets to be used in defi protocol.
    /// @param _tokenAddress Asset address.
    /// @param _amount Amount of tokens to request.
    function requestReserves(address _tokenAddress, uint256 _amount)
        external
        override
        onlyDefiController
    {
        bytes32 debridgeId = getDebridgeId(getChainId(), _tokenAddress);
        DebridgeInfo storage debridge = getDebridge[debridgeId];
        if (!debridge.exist) revert DebridgeNotFound();
        uint256 minReserves = (debridge.balance * debridge.minReservesBps) / BPS_DENOMINATOR;

        if (minReserves + _amount > IERC20(_tokenAddress).balanceOf(address(this)))
            revert NotEnoughReserves();

        IERC20(_tokenAddress).safeTransfer(defiController, _amount);
        debridge.lockedInStrategies += _amount;
    }

    /// @dev Return the assets that were used in defi protocol.
    /// @param _tokenAddress Asset address.
    /// @param _amount Amount of tokens to claim.
    function returnReserves(address _tokenAddress, uint256 _amount)
        external
        override
        onlyDefiController
    {
        bytes32 debridgeId = getDebridgeId(getChainId(), _tokenAddress);
        DebridgeInfo storage debridge = getDebridge[debridgeId];
        if (!debridge.exist) revert DebridgeNotFound();
        IERC20(debridge.tokenAddress).safeTransferFrom(
            defiController,
            address(this),
            _amount
        );
        debridge.lockedInStrategies -= _amount;
    }

    /// @dev Set fee converter proxy.
    /// @param _feeProxy Fee proxy address.
    function setFeeProxy(address _feeProxy) external onlyAdmin {
        feeProxy = _feeProxy;
    }

    function blockSubmission(bytes32[] memory _submissionIds, bool isBlocked) external onlyAdmin {
        for (uint256 i = 0; i < _submissionIds.length; i++) {
            isBlockedSubmission[_submissionIds[i]] = isBlocked;
            if (isBlocked) {
                emit Blocked(_submissionIds[i]);
            } else {
                emit Unblocked(_submissionIds[i]);
            }
        }
    }

    /// @dev Update flash fees.
    /// @param _flashFeeBps new fee in BPS
    function updateFlashFee(uint256 _flashFeeBps) external onlyAdmin {
        if (_flashFeeBps > BPS_DENOMINATOR) revert WrongArgument();
        flashFeeBps = _flashFeeBps;
    }

    /// @dev Update discount.
    /// @param _address customer address
    /// @param _discountFixBps  fix discount in BPS
    /// @param _discountTransferBps transfer % discount in BPS
    function updateFeeDiscount(
        address _address,
        uint16 _discountFixBps,
        uint16 _discountTransferBps
    ) external onlyAdmin {
        if (_address == address(0) ||
            _discountFixBps > BPS_DENOMINATOR ||
            _discountTransferBps > BPS_DENOMINATOR
        ) revert WrongArgument();
        DiscountInfo storage discountInfo = feeDiscount[_address];
        discountInfo.discountFixBps = _discountFixBps;
        discountInfo.discountTransferBps = _discountTransferBps;
    }

    // we need to accept ETH sends to unwrap WETH
    receive() external payable {
        assert(msg.sender == address(weth)); // only accept ETH via fallback from the WETH contract
    }

    /* ========== INTERNAL ========== */

    function _checkAndDeployAsset(bytes32 _debridgeId, address _aggregatorAddress) internal {
        if (!getDebridge[_debridgeId].exist) {
            (
                address wrappedAssetAddress,
                bytes memory nativeAddress,
                uint256 nativeChainId
            ) = IConfirmationAggregator(_aggregatorAddress).deployAsset(_debridgeId);
            if (wrappedAssetAddress == address(0)) revert WrappedAssetNotFound();
            _addAsset(_debridgeId, wrappedAssetAddress, nativeAddress, nativeChainId);
        }
    }

    function _checkConfirmations(
        bytes32 _submissionId,
        bytes32 _debridgeId,
        uint256 _amount,
        bytes memory _signatures
    ) internal {
        if (isBlockedSubmission[_submissionId]) revert SubmissionBlocked();
        if (_signatures.length > 0) {
            // inside check is confirmed
            ISignatureVerifier(signatureVerifier).submit(
                _submissionId,
                _signatures,
                _amount >= getAmountThreshold[_debridgeId] ? excessConfirmations : 0
            );
        } else {
            (uint8 confirmations, bool confirmed) = IConfirmationAggregator(confirmationAggregator)
                .getSubmissionConfirmations(_submissionId);

            if (!confirmed) revert SubmissionNotConfirmed();
            if (_amount >= getAmountThreshold[_debridgeId]) {
                if (confirmations < excessConfirmations) revert SubmissionAmountNotConfirmed();
            }
        }
    }

    /// @dev Add support for the asset.
    /// @param _debridgeId Asset identifier.
    /// @param _tokenAddress Address of the asset on the current chain.
    /// @param _nativeAddress Address of the asset on the native chain.
    /// @param _chainId Current chain id.
    function _addAsset(
        bytes32 _debridgeId,
        address _tokenAddress,
        bytes memory _nativeAddress,
        uint256 _chainId
    ) internal {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];

        if (debridge.exist) revert AssetAlreadyExist();
        if (_tokenAddress == address(0)) revert ZeroAddress();

        debridge.exist = true;
        debridge.tokenAddress = _tokenAddress;
        debridge.chainId = _chainId;
        //Don't override if the admin already set maxAmount
        if (debridge.maxAmount == 0) {
            debridge.maxAmount = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
        }
        // debridge.minReservesBps = BPS;
        if (getAmountThreshold[_debridgeId] == 0) {
            getAmountThreshold[
                _debridgeId
            ] = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
        }

        TokenInfo storage tokenInfo = getNativeInfo[_tokenAddress];
        tokenInfo.chainId = _chainId;
        tokenInfo.nativeAddress = _nativeAddress;

        emit PairAdded(
            _debridgeId,
            _tokenAddress,
            _chainId,
            debridge.maxAmount,
            debridge.minReservesBps
        );
    }

    /// @dev Locks asset on the chain and enables minting on the other chain.
    /// @param _amount Amount to be transfered (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function _send(
        address _tokenAddress,
        uint256 _amount,
        uint256 _chainIdTo,
        bool _useAssetFee,
        uint32 _referralCode
    ) internal returns (uint256 newAmount, bytes32 debridgeId) {
        //We use WETH debridgeId for transfer ETH
        debridgeId = getDebridgeId(
            getChainId(),
            _tokenAddress == address(0) ? address(weth) : _tokenAddress
        );

        DebridgeInfo storage debridge = getDebridge[debridgeId];
        if (!debridge.exist) {
            _addAsset(
                debridgeId,
                _tokenAddress == address(0) ? address(weth) : _tokenAddress,
                abi.encodePacked(_tokenAddress),
                getChainId()
            );
        }
        if (debridge.chainId != getChainId()) revert WrongChain();
        if (!getChainSupport[_chainIdTo].isSupported) revert WrongTargedChain();
        if (_amount > debridge.maxAmount) revert TransferAmountTooHigh();

        if (_tokenAddress == address(0)) {
            if (_amount != msg.value) revert AmountMismatch();
            weth.deposit{value: msg.value}();
            _useAssetFee = true;
        } else {
            IERC20 token = IERC20(_tokenAddress);
            uint256 balanceBefore = token.balanceOf(address(this));
            token.safeTransferFrom(msg.sender, address(this), _amount);
            // Received real amount
            _amount = token.balanceOf(address(this)) - balanceBefore;
        }
        _amount = _processFeeForTransfer(
            debridgeId,
            _amount,
            _chainIdTo,
            _useAssetFee,
            _referralCode
        );
        debridge.balance += _amount;
        return (_amount, debridgeId);
    }

    /// @dev Burns wrapped asset and allowss to claim it on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    /// @param _permit deadline + signature for approving the spender by signature.
    function _burn(
        bytes32 _debridgeId,
        uint256 _amount,
        uint256 _chainIdTo,
        bytes memory _permit,
        bool _useAssetFee,
        uint32 _referralCode
    ) internal returns (uint256) {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        if (!debridge.exist) revert DebridgeNotFound();
        if (debridge.chainId == getChainId()) revert WrongChain();
        if (!getChainSupport[_chainIdTo].isSupported) revert WrongTargedChain();
        if (_amount > debridge.maxAmount) revert TransferAmountTooHigh();
        IWrappedAsset wrappedAsset = IWrappedAsset(debridge.tokenAddress);
        if (_permit.length > 0) {
            //First dealine, next is signature
            uint256 deadline = _permit.toUint256(0);
            (bytes32 r, bytes32 s, uint8 v) = _permit.parseSignature(32);
            wrappedAsset.permit(msg.sender, address(this), _amount, deadline, v, r, s);
        }
        wrappedAsset.transferFrom(msg.sender, address(this), _amount);
        _amount = _processFeeForTransfer(
            _debridgeId,
            _amount,
            _chainIdTo,
            _useAssetFee,
            _referralCode
        );
        wrappedAsset.burn(_amount);
        debridge.balance -= _amount;
        return _amount;
    }

    function _processFeeForTransfer(
        bytes32 _debridgeId,
        uint256 _amount,
        uint256 _chainIdTo,
        bool _useAssetFee,
        uint32 _referralCode
    ) internal returns (uint256) {
        ChainSupportInfo memory chainSupportInfo = getChainSupport[_chainIdTo];
        DiscountInfo memory discountInfo = feeDiscount[msg.sender];
        DebridgeFeeInfo storage debridgeFee = getDebridgeFeeInfo[_debridgeId];
        uint256 fixedFee;
        if (_useAssetFee) {
            fixedFee = debridgeFee.getChainFee[_chainIdTo];
            if (fixedFee == 0) revert NotSupportedFixedFee();
        } else {
            // collect native fees
            if (
                msg.value <
                chainSupportInfo.fixedNativeFee -
                    (chainSupportInfo.fixedNativeFee * discountInfo.discountFixBps) /
                    BPS_DENOMINATOR
            ) revert TransferAmountNotCoverFees();
            bytes32 nativeDebridgeId = getDebridgeId(getChainId(), address(0));
            getDebridgeFeeInfo[nativeDebridgeId].collectedFees += msg.value;
            emit CollectedFee(nativeDebridgeId, _referralCode, msg.value);
        }
        uint256 transferFee = (_amount * chainSupportInfo.transferFeeBps) /
            BPS_DENOMINATOR +
            fixedFee;
        transferFee =
            transferFee -
            (transferFee * discountInfo.discountTransferBps) /
            BPS_DENOMINATOR;
        if (_amount < transferFee) revert TransferAmountNotCoverFees();
        debridgeFee.collectedFees += transferFee;
        emit CollectedFee(_debridgeId, _referralCode, transferFee);
        _amount -= transferFee;
        return _amount;
    }

    function _validateAutoParams(
        bytes calldata _autoParams,
        uint256 _amount
    ) internal pure returns (SubmissionAutoParamsTo memory autoParams) {
        if (_autoParams.length > 0) {
            autoParams = abi.decode(_autoParams, (SubmissionAutoParamsTo));
            if (autoParams.executionFee > _amount) revert ProposedFeeTooHigh();
            if (autoParams.data.length > 0 && autoParams.fallbackAddress.length == 0 ) revert WrongAutoArgument();
        }
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _submissionId Submission identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    function _mint(
        bytes32 _submissionId,
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        SubmissionAutoParamsFrom memory _autoParams
    ) internal {
        _markAsUsed(_submissionId);

        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        if (!debridge.exist) revert DebridgeNotFound();
        if (debridge.chainId == getChainId()) revert WrongChain();

        if (_autoParams.executionFee > 0) {
            IWrappedAsset(debridge.tokenAddress).mint(msg.sender, _autoParams.executionFee);
        }
        if (_autoParams.data.length > 0) {
            address callProxyAddress = _autoParams.reservedFlag == PROXY_WITH_SENDER_FLAG
                ? callProxyAddresses[PROXY_WITH_SENDER_FLAG]
                : callProxyAddresses[0];
            IWrappedAsset(debridge.tokenAddress).mint(callProxyAddress, _amount);
            bool status = ICallProxy(callProxyAddress).callERC20(
                debridge.tokenAddress,
                _autoParams.fallbackAddress,
                _receiver,
                _autoParams.data,
                _autoParams.reservedFlag,
                _autoParams.nativeSender
            );
            emit AutoRequestExecuted(_submissionId, status);
        } else {
            IWrappedAsset(debridge.tokenAddress).mint(_receiver, _amount);
        }
        debridge.balance += _amount + _autoParams.executionFee;
    }

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    function _claim(
        bytes32 _submissionId,
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        SubmissionAutoParamsFrom memory _autoParams
    ) internal {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        if (debridge.chainId != getChainId()) revert WrongChain();
        _markAsUsed(_submissionId);

        debridge.balance -= _amount;

        if (_autoParams.executionFee > 0) {
            IERC20(debridge.tokenAddress).safeTransfer(msg.sender, _autoParams.executionFee);
        }
        if (_autoParams.data.length > 0) {
            address callProxyAddress = _autoParams.reservedFlag == PROXY_WITH_SENDER_FLAG
                ? callProxyAddresses[PROXY_WITH_SENDER_FLAG]
                : callProxyAddresses[0];

            IERC20(debridge.tokenAddress).safeTransfer(callProxyAddress, _amount);
            bool status = ICallProxy(callProxyAddress).callERC20(
                debridge.tokenAddress,
                _autoParams.fallbackAddress,
                _receiver,
                _autoParams.data,
                _autoParams.reservedFlag,
                _autoParams.nativeSender
            );
            emit AutoRequestExecuted(_submissionId, status);
        } else {
            IERC20(debridge.tokenAddress).safeTransfer(_receiver, _amount);
        }
    }

    /// @dev Mark submission as used.
    /// @param _submissionId Submission identifier.
    function _markAsUsed(bytes32 _submissionId) internal {
        if (isSubmissionUsed[_submissionId]) revert SubmissionUsed();
        isSubmissionUsed[_submissionId] = true;
    }

    /* VIEW */

    function getDefiAvaliableReserves(address _tokenAddress)
        external
        view
        override
        returns (uint256)
    {
        DebridgeInfo storage debridge = getDebridge[getDebridgeId(getChainId(), _tokenAddress)];
        return (debridge.balance * (BPS_DENOMINATOR - debridge.minReservesBps)) / BPS_DENOMINATOR;
    }

    /// @dev Calculates asset identifier.
    /// @param _chainId Current chain id.
    /// @param _tokenAddress Address of the asset on the other chain.
    function getDebridgeId(uint256 _chainId, address _tokenAddress) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_chainId, _tokenAddress));
    }

    /// @dev Calculate submission id for auto claimable transfer.
    /// @param _debridgeId Asset identifier.
    /// @param _chainIdFrom Chain identifier of the chain where tokens are sent from.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    function getSubmissionIdFrom(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        uint256 _amount,
        address _receiver,
        uint256 _nonce,
        SubmissionAutoParamsFrom memory _autoParams
    ) public view returns (bytes32) {
        bytes memory packedSubmission = abi.encodePacked(
            _debridgeId,
            _chainIdFrom,
            getChainId(),
            _amount,
            _receiver,
            _nonce
        );
        if (_autoParams.data.length > 0) {
            // auto submission
            return keccak256(
                abi.encodePacked(
                    packedSubmission,
                    _autoParams.fallbackAddress,
                    _autoParams.executionFee,
                    _autoParams.data,
                    _autoParams.reservedFlag,
                    _autoParams.nativeSender
                )
            );
        }
        // regular submission
        return keccak256(packedSubmission);
    }

    function getSubmissionIdTo(
        bytes32 _debridgeId,
        uint256 _chainIdTo,
        uint256 _amount,
        bytes memory _receiver,
        SubmissionAutoParamsTo memory _autoParams
    ) private view returns (bytes32) {
        bytes memory packedSubmission = abi.encodePacked(
            _debridgeId,
            getChainId(),
            _chainIdTo,
            _amount,
            _receiver,
            nonce
        );
        if (_autoParams.data.length > 0) {
            // auto submission
            return keccak256(
                abi.encodePacked(
                    packedSubmission,
                    _autoParams.fallbackAddress,
                    _autoParams.executionFee,
                    _autoParams.data,
                    _autoParams.reservedFlag,
                    msg.sender
                )
            );
        }
        // regular submission
        return keccak256(packedSubmission);
    }

    function getNativeTokenInfo(address currentTokenAddress)
        external
        view
        override
        returns (uint256 chainId, bytes memory nativeAddress)
    {
        TokenInfo memory tokenInfo = getNativeInfo[currentTokenAddress];
        return (tokenInfo.chainId, tokenInfo.nativeAddress);
    }

    function getChainId() public view virtual returns (uint256 cid) {
        assembly {
            cid := chainid()
        }
    }
}
