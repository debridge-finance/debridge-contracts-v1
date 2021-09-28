// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "../interfaces/IERC20Permit.sol";
import "../interfaces/IDeBridgeToken.sol";
import "../interfaces/IDeBridgeTokenDeployer.sol";
import "../interfaces/ISignatureVerifier.sol";
import "../interfaces/IWETH.sol";
import "../interfaces/IDeBridgeGate.sol";
import "../interfaces/IConfirmationAggregator.sol";
import "../interfaces/ICallProxy.sol";
import "../interfaces/IFlashCallback.sol";
import "../libraries/SignatureUtil.sol";
import "../libraries/Flags.sol";

contract DeBridgeGate is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    IDeBridgeGate
{
    using SafeERC20 for IERC20;
    using SignatureUtil for bytes;
    using Flags for uint256;

    /* ========== STATE VARIABLES ========== */

    // Basis points or bps equal to 1/10000
    // used to express relative values (fees)
    uint256 public constant BPS_DENOMINATOR = 10000;
    bytes32 public constant GOVMONITORING_ROLE = keccak256("GOVMONITORING_ROLE"); // role allowed to stop transfers

    address public deBridgeTokenDeployer;
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
    error AssetNotConfirmed();
    error ZeroAddress();

    error ProposedFeeTooHigh();
    error FeeNotPaid();

    error NotEnoughReserves();
    error EthTransferFailed();

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
        address _deBridgeTokenDeployer,
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
        deBridgeTokenDeployer = _deBridgeTokenDeployer;
        feeProxy = _feeProxy;
    }

    /* ========== send, claim ========== */

    /// @dev Locks asset on the chain and enables minting on the other chain.
    /// @param _tokenAddress Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount to be transfered (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    /// @param _permit deadline + signature for approving the spender by signature.
    function send(
        address _tokenAddress,
        bytes memory _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        bytes memory _permit,
        bool _useAssetFee,
        uint32 _referralCode,
        bytes calldata _autoParams
    ) external payable override nonReentrant whenNotPaused {
        // bool isNativeToken;
        bytes32 debridgeId;
        FeeParams memory feeParams;
        uint256 amountAfterFee;
        // the amount will be reduced by the protocol fee
        (amountAfterFee, debridgeId, feeParams) = _send(
            _permit,
            _tokenAddress,
            _amount,
            _chainIdTo,
            _useAssetFee
        );

        SubmissionAutoParamsTo memory autoParams = _validateAutoParams(_autoParams, amountAfterFee);
        amountAfterFee -= autoParams.executionFee;

        //Avoid Stack too deep, try removing local variables
        bytes memory receiver = _receiver;
        bytes32 submissionId = getSubmissionIdTo(
            debridgeId,
            _chainIdTo,
            amountAfterFee,
            receiver,
            autoParams,
            _autoParams.length > 0
        );

        emit Sent(
            submissionId,
            debridgeId,
            amountAfterFee,
            receiver,
            nonce,
            _chainIdTo,
            _referralCode,
            feeParams,
            autoParams,
            msg.sender
            // isNativeToken
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
        bytes calldata _signatures,
        bytes calldata _autoParams
    ) external override whenNotPaused {

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
            autoParams,
            _autoParams.length > 0
        );

        _checkConfirmations(submissionId, _debridgeId, _amount, _signatures);

        bool isNativeToken =_claim(
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
            autoParams,
            isNativeToken
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

    function deployNewAsset(
        bytes memory _nativeTokenAddress,
        uint256 _nativeChainId,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        bytes memory _signatures
    ) external {
        bytes32 debridgeId = getbDebridgeId(_nativeChainId, _nativeTokenAddress);

        if (getDebridge[debridgeId].exist) revert AssetAlreadyExist();

        bytes32 deployId =  keccak256(abi.encodePacked(debridgeId, _name, _symbol, _decimals));
        if(_signatures.length > 0){
            // verify signatures
            ISignatureVerifier(signatureVerifier).submit(deployId, _signatures, excessConfirmations);
        }
        else {
            bytes32 confirmedDeployId = IConfirmationAggregator(confirmationAggregator).getConfirmedDeployId(debridgeId);
            if (deployId != confirmedDeployId) revert AssetNotConfirmed();
        }

        address deBridgeTokenAddress = IDeBridgeTokenDeployer(deBridgeTokenDeployer)
            .deployAsset(debridgeId, _name, _symbol, _decimals);

        _addAsset(debridgeId, deBridgeTokenAddress, _nativeTokenAddress, _nativeChainId);
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
        if (_excessConfirmations == 0) revert WrongArgument();
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

    /// @dev Set asset deployer address.
    /// @param _deBridgeTokenDeployer Asset deployer address.
    function setDeBridgeTokenDeployer(address _deBridgeTokenDeployer) external onlyAdmin {
        deBridgeTokenDeployer = _deBridgeTokenDeployer;
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
            _safeTransferETH(feeProxy, amount);
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
        nonReentrant
    {
        bytes32 debridgeId = getDebridgeId(getChainId(), _tokenAddress);
        DebridgeInfo storage debridge = getDebridge[debridgeId];
        if (!debridge.exist) revert DebridgeNotFound();
        uint256 minReserves = (debridge.balance * debridge.minReservesBps) / BPS_DENOMINATOR;

        if (minReserves + _amount > IERC20(_tokenAddress).balanceOf(address(this)))
            revert NotEnoughReserves();

        debridge.lockedInStrategies += _amount;
        IERC20(_tokenAddress).safeTransfer(defiController, _amount);
    }

    /// @dev Return the assets that were used in defi protocol.
    /// @param _tokenAddress Asset address.
    /// @param _amount Amount of tokens to claim.
    function returnReserves(address _tokenAddress, uint256 _amount)
        external
        override
        onlyDefiController
        nonReentrant
    {
        bytes32 debridgeId = getDebridgeId(getChainId(), _tokenAddress);
        DebridgeInfo storage debridge = getDebridge[debridgeId];
        if (!debridge.exist) revert DebridgeNotFound();
        debridge.lockedInStrategies -= _amount;
        IERC20(debridge.tokenAddress).safeTransferFrom(
            defiController,
            address(this),
            _amount
        );
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

    function _checkConfirmations(
        bytes32 _submissionId,
        bytes32 _debridgeId,
        uint256 _amount,
        bytes calldata _signatures
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
    /// @param _nativeChainId Native chain id.
    function _addAsset(
        bytes32 _debridgeId,
        address _tokenAddress,
        bytes memory _nativeAddress,
        uint256 _nativeChainId
    ) internal {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];

        if (debridge.exist) revert AssetAlreadyExist();
        if (_tokenAddress == address(0)) revert ZeroAddress();

        debridge.exist = true;
        debridge.tokenAddress = _tokenAddress;
        debridge.chainId = _nativeChainId;
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
        tokenInfo.nativeChainId = _nativeChainId;
        tokenInfo.nativeAddress = _nativeAddress;

        emit PairAdded(
            _debridgeId,
            _tokenAddress,
            _nativeAddress,
            _nativeChainId,
            debridge.maxAmount,
            debridge.minReservesBps
        );
    }

    /// @dev Locks asset on the chain and enables minting on the other chain.
    /// @param _amount Amount to be transfered (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    /// @param _permit deadline + signature for approving the spender by signature.
    function _send(
        bytes memory _permit,
        address _tokenAddress,
        uint256 _amount,
        uint256 _chainIdTo,
        bool _useAssetFee
    ) internal returns (
        // bool isNativeToken,
        uint256 amountAfterFee,
        bytes32 debridgeId,
        FeeParams memory feeParams
    ) {
        feeParams.receivedAmount = _amount;
        // Run _permit first. Avoid Stack too deep
        if (_permit.length > 0) {
            // call permit before transfering token
            uint256 deadline = _permit.toUint256(0);
            (bytes32 r, bytes32 s, uint8 v) = _permit.parseSignature(32);
            IERC20Permit(_tokenAddress).permit(
                msg.sender,
                address(this),
                _amount,
                deadline,
                v,
                r,
                s);
        }

        TokenInfo memory nativeTokenInfo = getNativeInfo[_tokenAddress];
        bool isNativeToken = nativeTokenInfo.nativeChainId  == 0
            ? true // token not in mapping
            : nativeTokenInfo.nativeChainId == getChainId(); // token native chain id the same

        feeParams.isNativeToken = isNativeToken;
        if (isNativeToken) {
            //We use WETH debridgeId for transfer ETH
            debridgeId = getDebridgeId(
                getChainId(),
                _tokenAddress == address(0) ? address(weth) : _tokenAddress
            );
        }
        else {
            debridgeId = getbDebridgeId(
                nativeTokenInfo.nativeChainId,
                nativeTokenInfo.nativeAddress
            );
        }

        DebridgeInfo storage debridge = getDebridge[debridgeId];
        if (!debridge.exist) {
            if (isNativeToken) {
                _addAsset(
                    debridgeId,
                    _tokenAddress == address(0) ? address(weth) : _tokenAddress,
                    abi.encodePacked(_tokenAddress),
                    getChainId()
                );
            } else revert DebridgeNotFound();
        }

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

        //_processFeeForTransfer
        {
            ChainSupportInfo memory chainSupportInfo = getChainSupport[_chainIdTo];
            DiscountInfo memory discountInfo = feeDiscount[msg.sender];
            DebridgeFeeInfo storage debridgeFee = getDebridgeFeeInfo[debridgeId];
            uint256 assetsFixedFee;
            if (_useAssetFee) {
                assetsFixedFee = debridgeFee.getChainFee[_chainIdTo];
                if (assetsFixedFee == 0) revert NotSupportedFixedFee();
                //Calculate transfer fee with discount
                assetsFixedFee = assetsFixedFee - (assetsFixedFee * discountInfo.discountFixBps) / BPS_DENOMINATOR;
                feeParams.fixFee = assetsFixedFee;
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
                feeParams.fixFee = msg.value;
            }
            // Calculate transfer fee with discount
            uint256 transferFee = (_amount * chainSupportInfo.transferFeeBps) / BPS_DENOMINATOR;
            transferFee = transferFee - (transferFee * discountInfo.discountTransferBps) / BPS_DENOMINATOR;
            feeParams.transferFee = transferFee;
            if (_amount < transferFee) revert TransferAmountNotCoverFees();
            debridgeFee.collectedFees += transferFee + assetsFixedFee;
            feeParams.transferFee = transferFee;
            feeParams.useAssetFee = _useAssetFee;
            amountAfterFee = _amount - transferFee - assetsFixedFee;
        }
        // Is native token
        if (isNativeToken) {
            debridge.balance += amountAfterFee;
        }
        else {
            debridge.balance -= amountAfterFee;
            IDeBridgeToken(debridge.tokenAddress).burn(amountAfterFee);
        }
        return (_amount, debridgeId, feeParams);
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
    ) internal returns (bool isNativeToken) {
        if (isSubmissionUsed[_submissionId]) revert SubmissionUsed();
        isSubmissionUsed[_submissionId] = true;

        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        if (!debridge.exist) revert DebridgeNotFound();
        // if (debridge.chainId != getChainId()) revert WrongChain();
        isNativeToken = debridge.chainId == getChainId();

        if (isNativeToken) {
            debridge.balance -= _amount + _autoParams.executionFee;
        } else {
            debridge.balance += _amount + _autoParams.executionFee;
        }

        address _token = debridge.tokenAddress;
        if (_autoParams.executionFee > 0) {
            _mintOrTransfer(_token, msg.sender, _autoParams.executionFee, isNativeToken);
        }
        if (_autoParams.data.length > 0) {
            address callProxyAddress = _autoParams.flags.getFlag(Flags.PROXY_WITH_SENDER)
                ? callProxyAddresses[Flags.PROXY_WITH_SENDER]
                : callProxyAddresses[0];

            _mintOrTransfer(_token, callProxyAddress, _amount, isNativeToken);

            bool status = ICallProxy(callProxyAddress).callERC20(
                _token,
                _autoParams.fallbackAddress,
                _receiver,
                _autoParams.data,
                _autoParams.flags,
                _autoParams.nativeSender
            );
            emit AutoRequestExecuted(_submissionId, status, callProxyAddress);
        } else if (isNativeToken
            && _autoParams.flags.getFlag(Flags.UNWRAP_ETH)
            && _token == address(weth)
        ) {
            // transferring WETH with unwrap flag
            weth.withdraw(_amount);
            _safeTransferETH(_receiver, _amount);
        } else {
            _mintOrTransfer(_token, _receiver, _amount, isNativeToken);
        }
    }

    function _mintOrTransfer(
        address _token,
        address _receiver,
        uint256 _amount,
        bool isNativeToken
    ) internal {
        if (isNativeToken) {
            IERC20(_token).safeTransfer(_receiver, _amount);
        } else {
            IDeBridgeToken(_token).mint(_receiver, _amount);
        }
    }

    /*
    * @dev transfer ETH to an address, revert if it fails.
    * @param to recipient of the transfer
    * @param value the amount to send
    */
    function _safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        if (!success) revert EthTransferFailed();
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

    /// @dev Calculates asset identifier.
    /// @param _chainId Current chain id.
    /// @param _tokenAddress Address of the asset on the other chain.
    function getbDebridgeId(uint256 _chainId, bytes memory _tokenAddress) public pure returns (bytes32) {
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
        SubmissionAutoParamsFrom memory autoParams,
        bool hasAutoParams
    ) public view returns (bytes32) {
        bytes memory packedSubmission = abi.encodePacked(
            _debridgeId,
            _chainIdFrom,
            getChainId(),
            _amount,
            _receiver,
            _nonce
        );
        if (hasAutoParams) {
            // auto submission
            return keccak256(
                abi.encodePacked(
                    packedSubmission,
                    autoParams.executionFee,
                    autoParams.flags,
                    autoParams.fallbackAddress,
                    autoParams.data,
                    autoParams.nativeSender
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
        SubmissionAutoParamsTo memory autoParams,
        bool hasAutoParams
    ) private view returns (bytes32) {
        bytes memory packedSubmission = abi.encodePacked(
            _debridgeId,
            getChainId(),
            _chainIdTo,
            _amount,
            _receiver,
            nonce
        );
        if (hasAutoParams) {
            // auto submission
            return keccak256(
                abi.encodePacked(
                    packedSubmission,
                    autoParams.executionFee,
                    autoParams.flags,
                    autoParams.fallbackAddress,
                    autoParams.data,
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
        returns (uint256 nativeChainId, bytes memory nativeAddress)
    {
        TokenInfo memory tokenInfo = getNativeInfo[currentTokenAddress];
        return (tokenInfo.nativeChainId, tokenInfo.nativeAddress);
    }

    function getChainId() public view virtual returns (uint256 cid) {
        assembly {
            cid := chainid()
        }
    }
}
