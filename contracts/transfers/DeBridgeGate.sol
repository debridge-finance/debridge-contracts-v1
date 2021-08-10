// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "../periphery/WrappedAsset.sol";
import "../interfaces/ISignatureVerifier.sol";
import "../interfaces/IFeeProxy.sol";
import "../interfaces/IWETH.sol";
import "../interfaces/IDeBridgeGate.sol";
import "../interfaces/IDefiController.sol";
import "../interfaces/IConfirmationAggregator.sol";
import "../interfaces/ICallProxy.sol";
import "../interfaces/IFlashCallback.sol";
import "../libraries/SignatureUtil.sol";

contract DeBridgeGate is Initializable,
                         AccessControlUpgradeable,
                         PausableUpgradeable,
                         ReentrancyGuardUpgradeable,
                         IDeBridgeGate {

    using SafeERC20 for IERC20;
    using SignatureUtil for bytes;

    /* ========== STATE VARIABLES ========== */

    // Basis points or bps equal to 1/10000
    // used to express relative values (fees)
    uint256 public constant BPS_DENOMINATOR = 10000;
    bytes32 public constant WORKER_ROLE = keccak256("WORKER_ROLE"); // role allowed to withdraw fee
    bytes32 public constant GOVMONITORING_ROLE = keccak256("GOVMONITORING_ROLE"); // role allowed to stop transfers

    bytes32 public nativeDebridgeId; // native token debridgeId
    uint256 public chainId; // current chain id
    address public signatureVerifier; // current signatureVerifier address to verify signatures
    address public confirmationAggregator; // current aggregator address to verify by oracles confirmations
    address public callProxy; // proxy to execute user's calls
    address public treasury; //address of treasury
    uint8 public excessConfirmations; // minimal required confirmations in case of too many confirmations
    uint16 public flashFeeBps; // fee in basis points (1/10000)
    uint16 public collectRewardBps; // reward BPS that user will receive for collect reawards
    uint256 nonce; //outgoing submissions count
    
    mapping(bytes32 => DebridgeInfo) public getDebridge; // debridgeId (i.e. hash(native chainId, native tokenAddress)) => token
    mapping(bytes32 => bool) public isSubmissionUsed; // submissionId (i.e. hash( debridgeId, amount, receiver, nonce)) => whether is claimed
    mapping(bytes32 => bool) public isBlockedSubmission; // submissionId  => is blocked
    mapping(bytes32 => uint256) public getAmountThreshold; // debridge => amount threshold
    mapping(uint256 => ChainSupportInfo) public getChainSupport; // whether the chain for the asset is supported
    mapping(address => uint256) public feeDiscount; //fee discount for address

    mapping(address => TokenInfo) public getNativeInfo; //return native token info by wrapped token address

    IDefiController public defiController; // proxy to use the locked assets in Defi protocols
    IFeeProxy public feeProxy; // proxy to convert the collected fees into Link's
    IWETH public weth; // wrapped native token contract

    
    /* ========== MODIFIERS ========== */

    modifier onlyWorker {
        require(hasRole(WORKER_ROLE, msg.sender), "onlyWorker: bad role");
        _;
    }

    modifier onlyDefiController {
        require(address(defiController) == msg.sender, "defiController: bad role");
        _;
    }

    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "onlyAdmin: bad role");
        _;
    }

    modifier onlyGovMonitoring {
        require(hasRole(GOVMONITORING_ROLE, msg.sender), "onlyGovMonitoring: bad role");
        _;
    }

    /* ========== CONSTRUCTOR  ========== */

    /// @dev Constructor that initializes the most important configurations.
    /// @param _signatureVerifier Aggregator address to verify signatures
    /// @param _confirmationAggregator Aggregator address to verify by oracles confirmations
    /// @param _supportedChainIds Chain ids where native token of the current chain can be wrapped.
    /// @param _treasury Address to collect a fee
    function initialize(
        uint8 _excessConfirmations,
        address _signatureVerifier,
        address _confirmationAggregator,
        address _callProxy,
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo,
        IWETH _weth,
        IFeeProxy _feeProxy,
        IDefiController _defiController,
        address _treasury
    ) public initializer {
        uint256 cid;
        assembly {
            cid := chainid()
        }
        chainId = cid;
        nativeDebridgeId = getDebridgeId(chainId, address(0));
        _addAsset(nativeDebridgeId, address(0), address(0), chainId);
        for (uint256 i = 0; i < _supportedChainIds.length; i++) {
            getChainSupport[_supportedChainIds[i]] = _chainSupportInfo[i];
        }

        signatureVerifier = _signatureVerifier;
        confirmationAggregator = _confirmationAggregator;

        callProxy = _callProxy;
        defiController = _defiController;
        excessConfirmations = _excessConfirmations;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        weth = _weth;
        feeProxy = _feeProxy;
        treasury = _treasury;

        flashFeeBps = 10;
    }


    /* ========== send, mint, burn, claim ========== */

    /// @dev Locks asset on the chain and enables minting on the other chain.
    /// @param _tokenAddress Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount to be transfered (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function send(
        address _tokenAddress,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        bool _useAssetFee
    ) external payable override whenNotPaused() {
        bytes32 debridgeId = getDebridgeId(chainId, _tokenAddress);
        _amount = _send(
            _tokenAddress,
            debridgeId,
            _amount,
            _chainIdTo,
            _useAssetFee
        );
        bytes32 sentId = getSubmisionId(
            debridgeId,
            chainId,
            _chainIdTo,
            _amount,
            _receiver,
            nonce
        );
        emit Sent(sentId, debridgeId, _amount, _receiver, nonce, _chainIdTo);
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
        bytes[] calldata _signatures
    ) external override whenNotPaused() {
        bytes32 submissionId = getSubmisionId(
            _debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce
        );

        _checkAndDeployAsset(_debridgeId, _signatures.length > 0
                                         ? signatureVerifier
                                         : confirmationAggregator);

        _checkConfirmations(
            submissionId,
            _debridgeId,
            _amount,
            _signatures);

        _mint(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            address(0),
            0,
            ""
        );
    }

    /// @dev Burns wrapped asset and allowss to claim it on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function burn(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        uint256 _deadline,
        bytes memory _signature,
        bool _useAssetFee
    ) external payable override whenNotPaused() {
        _amount = _burn(
            _debridgeId,
            _amount,
            _chainIdTo,
            _deadline,
            _signature,
            _useAssetFee
        );
        bytes32 burntId = getSubmisionId(
            _debridgeId,
            chainId,
            _chainIdTo,
            _amount,
            _receiver,
            nonce
        );
        emit Burnt(burntId, _debridgeId, _amount, _receiver, nonce, _chainIdTo);
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
        bytes[] calldata _signatures
    ) external override whenNotPaused() {
        bytes32 submissionId = getSubmisionId(
            _debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce
        );

        _checkConfirmations(
            submissionId,
            _debridgeId,
            _amount,
            _signatures);

        _claim(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            address(0),
            0,
            ""
        );
    }


    /* ========== AUTO send, mint, burn, claim ========== */

    /// @dev Locks asset on the chain and enables minting on the other chain.
    /// @param _tokenAddress Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount to be transfered (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoSend(
        address _tokenAddress,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        bool _useAssetFee
    ) external payable override whenNotPaused() {
        bytes32 debridgeId = getDebridgeId(chainId, _tokenAddress);
        //require(_executionFee != 0, "autoSend: fee too low");
        _amount = _send(
            _tokenAddress,
            debridgeId,
            _amount,
            _chainIdTo,
            _useAssetFee
        );
        //Commented out: contract-size limit
        // require(_amount >= _executionFee, "autoSend: proposed fee too high");
        _amount -= _executionFee;
        bytes32 sentId = getAutoSubmisionId(
            debridgeId,
            chainId,
            _chainIdTo,
            _amount,
            _receiver,
            nonce,
            _fallbackAddress,
            _executionFee,
            _data
        );
        emit AutoSent(
            sentId,
            debridgeId,
            _amount,
            _receiver,
            nonce,
            _chainIdTo,
            _executionFee,
            _fallbackAddress,
            _data
        );
        nonce++;
    }


    /// @dev Mints wrapped asset on the current chain.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _signatures Array of oracles signatures.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoMint(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data
    ) external override whenNotPaused() {
        bytes32 submissionId = getAutoSubmisionId(
            _debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce,
            _fallbackAddress,
            _executionFee,
            _data
        );

        _checkAndDeployAsset(_debridgeId, _signatures.length > 0
                                           ? signatureVerifier
                                           : confirmationAggregator);

        _checkConfirmations(
            submissionId,
            _debridgeId,
            _amount,
            _signatures);

        _mint(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            _fallbackAddress,
            _executionFee,
            _data
        );
    }

    /// @dev Burns wrapped asset and allowss to claim it on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoBurn(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        uint256 _deadline,
        bytes memory _signature,
        bool _useAssetFee
    ) external payable override whenNotPaused() {
        //require(_executionFee != 0, "autoBurn: fee too low");
        _amount = _burn(
            _debridgeId,
            _amount,
            _chainIdTo,
            _deadline,
            _signature,
            _useAssetFee
        );
        //Commented out: contract-size limit
        // require(_amount >= _executionFee, "autoBurn: proposed fee too high");
        _amount -= _executionFee;
        bytes32 burntId = getAutoSubmisionId(
            _debridgeId,
            chainId,
            _chainIdTo,
            _amount,
            _receiver,
            nonce,
            _fallbackAddress,
            _executionFee,
            _data
        );
        emit AutoBurnt(
            burntId,
            _debridgeId,
            _amount,
            _receiver,
            nonce,
            _chainIdTo,
            _executionFee,
            _fallbackAddress,
            _data
        );
        nonce++;
    }

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    function autoClaim(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data
    ) external override whenNotPaused() {
        bytes32 submissionId = getAutoSubmisionId(
            _debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce,
            _fallbackAddress,
            _executionFee,
            _data
        );

        _checkConfirmations(
            submissionId,
            _debridgeId,
            _amount,
            _signatures);

        _claim(
            submissionId,
            _debridgeId,
            _receiver,
            _amount,
            _fallbackAddress,
            _executionFee,
            _data
        );
    }


    function flash(
        address _tokenAddress,
        address _receiver,
        uint256 _amount,
        bytes memory _data
    ) external override nonReentrant
    // noDelegateCall
    {
        DebridgeInfo storage debridge = getDebridge[getDebridgeId(chainId, _tokenAddress)];
        uint256 currentFlashFee = (_amount * flashFeeBps) / BPS_DENOMINATOR;
        uint256 balanceBefore = IERC20(_tokenAddress).balanceOf(address(this));

        IERC20(_tokenAddress).safeTransfer(_receiver, _amount);
        IFlashCallback(msg.sender).flashCallback(currentFlashFee, _data);

        uint256 balanceAfter = IERC20(_tokenAddress).balanceOf(address(this));
        require(balanceBefore + currentFlashFee <= balanceAfter, "Not paid fee");
        uint256 paid = balanceAfter - balanceBefore;
        debridge.collectedFees += paid;
        emit Flash(msg.sender, _tokenAddress, _receiver, _amount, paid);
    }


    /* ========== ADMIN ========== */

    /// @dev Update asset's fees.
    /// @param _supportedChainIds Chain identifiers.
    /// @param _chainSupportInfo Chain support info.
    function updateChainSupport(
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo
    ) external onlyAdmin() {
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
    ) external onlyAdmin() {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        for (uint256 i = 0; i < _supportedChainIds.length; i++) {
            debridge.getChainFee[_supportedChainIds[i]] = _assetFeesInfo[i];
        }
    }

    function updateExcessConfirmations(uint8 _excessConfirmations) external onlyAdmin() {
        excessConfirmations = _excessConfirmations;
    }


    /// @dev Set support for the chains where the token can be transfered.
    /// @param _chainId Chain id where tokens are sent.
    /// @param _isSupported Whether the token is transferable to the other chain.
    function setChainSupport(
        uint256 _chainId,
        bool _isSupported
    ) external onlyAdmin() {
        getChainSupport[_chainId].isSupported = _isSupported;
        emit ChainSupportUpdated(_chainId, _isSupported);
    }

    /// @dev Set proxy address.
    /// @param _callProxy Address of the proxy that executes external calls.
    function setCallProxy(address _callProxy) external onlyAdmin() {
        callProxy = _callProxy;
        emit CallProxyUpdated(_callProxy);
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
    ) external onlyAdmin() {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        debridge.maxAmount = _maxAmount;
        debridge.minReservesBps = _minReservesBps;
        getAmountThreshold[_debridgeId] = _amountThreshold;
    }

    /// @dev Set aggregator address.
    /// @param _aggregator Submission aggregator address.
    function setAggregator(address _aggregator) external onlyAdmin() {
        confirmationAggregator = _aggregator;
    }

    /// @dev Set signature verifier address.
    /// @param _verifier Signature verifier address.
    function setSignatureVerifier(address _verifier) external onlyAdmin() {
        signatureVerifier = _verifier;
    }

    /// @dev Set defi controoler.
    /// @param _defiController Defi controller address address.
    function setDefiController(IDefiController _defiController) external onlyAdmin() {
        // TODO: claim all the reserves before
        // loop lockedInStrategies
        // defiController.claimReserve(
        //     _debridge.tokenAddress,
        //     requestedReserves
        // );
        defiController = _defiController;
    }

    /// @dev Stop all transfers.
    function pause() external onlyGovMonitoring() {
        _pause();
    }

    /// @dev Allow transfers.
    function unpause() external onlyAdmin() whenPaused() {
        _unpause();
    }

    /// @dev donate fees (called by proxy)
    /// @param _debridgeId Asset identifier.
    /// @param _amount amount for transfer.
    function donateFees(bytes32 _debridgeId, uint256 _amount) 
        external nonReentrant
    {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        require(debridge.exist, "debridge not exist");
        require(debridge.tokenAddress != address(0), "Not for native token");

        IERC20 token = IERC20(debridge.tokenAddress);
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
        // Received real amount
        _amount = token.balanceOf(address(this)) - balanceBefore;
        
        debridge.donatedFees += _amount;
        emit ReceivedTransferFee(_debridgeId, _amount);
    }
    
    /// @dev Withdraw fees.
    /// @param _debridgeId Asset identifier.
    function withdrawFee(bytes32 _debridgeId) external payable 
        nonReentrant 
        onlyWorker
    {
        // need to pay fee when call burn/send
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        //Don't needed
        // require(debridge.exist, "debridge not exist");

        //Amount for transfer to treasure
        uint256 amount = debridge.collectedFees + debridge.donatedFees - debridge.withdrawnFees;
        //save contract size
        require(amount > 0, "Zero collected fees");
        debridge.withdrawnFees += amount;
        //Reward amount for user
        uint256 rewardAmount = amount * collectRewardBps / BPS_DENOMINATOR;
        amount -= rewardAmount;
        uint256 ethAmount = msg.value;
        
        if (debridge.tokenAddress == address(0)) {
            ethAmount += amount;
            if(rewardAmount > 0) {
                payable(msg.sender).transfer(rewardAmount);
            }
        } else {
            IERC20(debridge.tokenAddress).safeTransfer(address(feeProxy), amount);
            if(rewardAmount > 0) {
                IERC20(debridge.tokenAddress).safeTransfer(msg.sender, rewardAmount);
            }
        }
        feeProxy.transferToTreasury{value: ethAmount}(_debridgeId, msg.value);
    }

    /// @dev Request the assets to be used in defi protocol.
    /// @param _tokenAddress Asset address.
    /// @param _amount Amount of tokens to request.
    function requestReserves(address _tokenAddress, uint256 _amount)
        external override
        onlyDefiController()
    {
        bytes32 debridgeId = getDebridgeId(chainId, _tokenAddress);
        DebridgeInfo storage debridge = getDebridge[debridgeId];
        uint256 minReserves = (debridge.balance * debridge.minReservesBps) / BPS_DENOMINATOR;
        require(minReserves + _amount < getBalance(debridge.tokenAddress), "not enough reserves");
        if (debridge.tokenAddress == address(0)) {
            payable(address(defiController)).transfer(_amount);
        } else {
            IERC20(debridge.tokenAddress).safeTransfer(
                address(defiController),
                _amount
            );
        }
        debridge.lockedInStrategies += _amount;
    }

    /// @dev Return the assets that were used in defi protocol.
    /// @param _tokenAddress Asset address.
    /// @param _amount Amount of tokens to claim.
    function returnReserves(address _tokenAddress, uint256 _amount)
        external
        payable override
        onlyDefiController()
    {
        bytes32 debridgeId = getDebridgeId(chainId, _tokenAddress);
        DebridgeInfo storage debridge = getDebridge[debridgeId];
        if (debridge.tokenAddress != address(0)) {
            IERC20(debridge.tokenAddress).safeTransferFrom(
                address(defiController),
                address(this),
                _amount
            );
            debridge.lockedInStrategies -=
                _amount > debridge.lockedInStrategies
                ? debridge.lockedInStrategies
                : _amount;
        } else {
            debridge.lockedInStrategies -=
                msg.value > debridge.lockedInStrategies
                ? debridge.lockedInStrategies
                : msg.value;
        }
    }

    /// @dev Withdraw collected yield from DefiController and send them to treasury address.
    ///      Called by DefiController on withdrawal funds from strategy after yield got calculated.
    /// @param _tokenAddress Asset address.
    /// @param _amount Amount of tokens to claim.
    /// todo: fix support of native Ether and ZERO_ADDRESS tokens (is it needed by design?).
    ///       see returnReserves(...) func and `if (debridge.tokenAddress != address(0))` condition.
    ///       Discarded it for simplicity.
    function returnYield(address _tokenAddress, uint256 _amount)
        external
        override
        onlyDefiController()
    {
        require(_tokenAddress != address(0), "withdrawYieldToTreasury: token address required");
        require(treasury != address(0), "withdrawYieldToTreasury: treasury doesn't exist");
        bytes32 debridgeId = getDebridgeId(chainId, _tokenAddress);
        DebridgeInfo storage debridge = getDebridge[debridgeId];
        require(_tokenAddress == debridge.tokenAddress, "withdrawYieldToTreasury: token adress doesn't match DebridgeInfo");
        IERC20(_tokenAddress).safeTransferFrom(
            address(defiController),
            address(treasury),
            _amount
        );
    }

    /// @dev Set fee converter proxy.
    /// @param _feeProxy Fee proxy address.
    function setFeeProxy(IFeeProxy _feeProxy) external onlyAdmin() {
        feeProxy = _feeProxy;
    }

    /// @dev Set wrapped native asset address.
    /// @param _weth Weth address.
    function setWeth(IWETH _weth) external onlyAdmin() {
        weth = _weth;
    }


    function blockSubmission(bytes32[] memory _submissionIds, bool isBlocked) external onlyAdmin() {
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
    function updateFlashFee(uint16 _flashFeeBps) external onlyAdmin() {
        flashFeeBps = _flashFeeBps;
    }

    /// @dev Update transfer reward BPS.
    /// @param _collectRewardBps new reward in BPS
    function updateCollectRewardBps(uint16 _collectRewardBps) external onlyAdmin() {
        // save contract size
        // require(_collectRewardBps <= BPS_DENOMINATOR, "Wrong amount");
        collectRewardBps = _collectRewardBps;
    }

    /// @dev Update discount.
    /// @param _address customer address
    /// @param _discountBps discount
    function updateFeeDiscount(address _address, uint256 _discountBps) external onlyAdmin() {
        //save contract size
        // require(_discountBps <= BPS_DENOMINATOR, "Wrong discount");
        feeDiscount[_address] = _discountBps;
    }

    function updateTreasury(address _address) external onlyAdmin() {
        treasury = _address;
    }

    /* ========== INTERNAL ========== */

    function _checkAndDeployAsset(bytes32 debridgeId, address aggregatorAddress) internal {
        if(!getDebridge[debridgeId].exist){
            (address wrappedAssetAddress, address nativeAddress, uint256 nativeChainId) =
                    IConfirmationAggregator(aggregatorAddress).deployAsset(debridgeId);
            require(wrappedAssetAddress != address(0), "mint: wrapped asset not exist");
            _addAsset(debridgeId, wrappedAssetAddress, nativeAddress, nativeChainId);
        }
    }

     function _checkConfirmations(bytes32 _submissionId, bytes32 _debridgeId,
                                  uint256 _amount, bytes[] memory _signatures)
        internal {
        (uint8 confirmations, bool confirmed) =
                _signatures.length > 0
                ? ISignatureVerifier(signatureVerifier).submit(_submissionId, _signatures)
                : IConfirmationAggregator(confirmationAggregator).getSubmissionConfirmations(_submissionId);
        require(confirmed, "not confirmed");
        if (_amount >= getAmountThreshold[_debridgeId]) {
            require(confirmations >= excessConfirmations, "amount not confirmed");
        }
    }


    /// @dev Add support for the asset.
    /// @param _debridgeId Asset identifier.
    /// @param _tokenAddress Address of the asset on the current chain.
    /// @param _nativeAddress Address of the asset on the native chain.
    /// @param _chainId Current chain id.
    function _addAsset(bytes32 _debridgeId, address _tokenAddress, address _nativeAddress, uint256 _chainId) internal {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        debridge.exist = true;
        debridge.tokenAddress = _tokenAddress;
        debridge.chainId = _chainId;
        //Don't override if the admin already set maxAmount
        if(debridge.maxAmount == 0){
            debridge.maxAmount = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
        }
        // debridge.minReservesBps = BPS;
        if(getAmountThreshold[_debridgeId] == 0){
            getAmountThreshold[_debridgeId] = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
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
    /// @param _debridgeId Asset identifier.
    /// @param _amount Amount to be transfered (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function _send(
        address _tokenAddress,
        bytes32 _debridgeId,
        uint256 _amount,
        uint256 _chainIdTo,
        bool _useAssetFee
    ) internal returns (uint256) {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        if (!debridge.exist) {
            _addAsset(_debridgeId, _tokenAddress, _tokenAddress, chainId);
        }
        ChainSupportInfo memory chainSupportInfo = getChainSupport[_chainIdTo];
        require(debridge.chainId == chainId, "send: not native chain");
        require(chainSupportInfo.isSupported, "send: wrong targed chain");
        require(_amount <= debridge.maxAmount, "send: amount too high");
        if (debridge.tokenAddress == address(0)) {
            require(_amount == msg.value, "send: amount mismatch");
         } else {
            IERC20 token = IERC20(debridge.tokenAddress);
            uint256 balanceBefore = token.balanceOf(address(this));
            token.safeTransferFrom(
                msg.sender,
                address(this),
                _amount
            );
            // Received real amount
            _amount = token.balanceOf(address(this)) - balanceBefore;
        }
        if (_useAssetFee || debridge.tokenAddress == address(0)) {
            uint256 fixedFee = debridge.tokenAddress == address(0)
                ? chainSupportInfo.fixedNativeFee
                : debridge.getChainFee[_chainIdTo];
            require(fixedFee != 0, "send: fixed fee is not supported");
            uint256 transferFee = fixedFee +
                (_amount * chainSupportInfo.transferFeeBps) / BPS_DENOMINATOR;
            if (feeDiscount[msg.sender] > 0) {
                transferFee = transferFee - transferFee * feeDiscount[msg.sender] / BPS_DENOMINATOR;
            }
            require(_amount >= transferFee, "send: amount not cover fees");
            debridge.collectedFees += transferFee;
            _amount -= transferFee;
        } else {
            {
                uint256 transferFee = (_amount*chainSupportInfo.transferFeeBps) / BPS_DENOMINATOR;
                if (feeDiscount[msg.sender] > 0) {
                    transferFee = transferFee - transferFee * feeDiscount[msg.sender] / BPS_DENOMINATOR;
                }
                require(_amount >= transferFee, "send: amount not cover fees");
                debridge.collectedFees += transferFee;
                _amount -= transferFee;
            }
            require(msg.value >= chainSupportInfo.fixedNativeFee
                - chainSupportInfo.fixedNativeFee * feeDiscount[msg.sender] / BPS_DENOMINATOR,
                "send: amount not cover fees");

            getDebridge[nativeDebridgeId].collectedFees += msg.value;
        }
        debridge.balance += _amount;
        return _amount;
    }

    /// @dev Burns wrapped asset and allowss to claim it on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function _burn(
        bytes32 _debridgeId,
        uint256 _amount,
        uint256 _chainIdTo,
        uint256 _deadline,
        bytes memory _signature,
        bool _useAssetFee
    ) internal returns (uint256) {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        ChainSupportInfo memory chainSupportInfo = getChainSupport[_chainIdTo];
        require(debridge.chainId != chainId, "burn: native asset");
        require(chainSupportInfo.isSupported, "burn: wrong targed chain");
        require(_amount <= debridge.maxAmount, "burn: amount too high");
        IWrappedAsset wrappedAsset = IWrappedAsset(debridge.tokenAddress);
        if (_signature.length > 0) {
            (bytes32 r, bytes32 s, uint8 v) = _signature.splitSignature();
            wrappedAsset.permit(
                msg.sender,
                address(this),
                _amount,
                _deadline,
                v,
                r,
                s
            );
        }
        wrappedAsset.transferFrom(msg.sender, address(this), _amount);
        if (_useAssetFee) {
            uint256 fixedFee = debridge.getChainFee[_chainIdTo];
            require(fixedFee != 0, "send: fixed fee is not supported");
            uint256 transferFee = fixedFee +
                (_amount * chainSupportInfo.transferFeeBps) / BPS_DENOMINATOR;
            if (feeDiscount[msg.sender] > 0) {
                transferFee = transferFee - transferFee * feeDiscount[msg.sender] / BPS_DENOMINATOR;
            }
            require(_amount >= transferFee, "send: amount not cover fees");
            debridge.collectedFees += transferFee;
            _amount -= transferFee;
        } else {
            {
                uint256 transferFee = (_amount*chainSupportInfo.transferFeeBps)/BPS_DENOMINATOR;
                if (feeDiscount[msg.sender] > 0) {
                    transferFee = transferFee - transferFee * feeDiscount[msg.sender] / BPS_DENOMINATOR;
                }
                require(_amount >= transferFee, "send: amount not cover fees");
                debridge.collectedFees += transferFee;
                _amount -= transferFee;
            }
            require(msg.value >= chainSupportInfo.fixedNativeFee
                - chainSupportInfo.fixedNativeFee * feeDiscount[msg.sender] / BPS_DENOMINATOR,
                "send: amount not cover fees");
            getDebridge[nativeDebridgeId].collectedFees += msg.value;
        }
        wrappedAsset.burn(_amount);
        return _amount;
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _submissionId Submission identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function _mint(
        bytes32 _submissionId,
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data
    ) internal {
        require(!isSubmissionUsed[_submissionId], "mint: already used");
        require(!isBlockedSubmission[_submissionId], "mint: blocked submission");

        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        require(debridge.exist, "mint: debridge not exist");

        isSubmissionUsed[_submissionId] = true;
        require(debridge.chainId != chainId, "mint: is native chain");
        if (_executionFee > 0) {
            IWrappedAsset(debridge.tokenAddress).mint(
                msg.sender,
                _executionFee
            );
        }
        if(_data.length > 0){
            IWrappedAsset(debridge.tokenAddress).mint(callProxy, _amount);
            bool status = ICallProxy(callProxy).callERC20(
                debridge.tokenAddress,
                _fallbackAddress,
                _receiver,
                _data
            );
            emit AutoRequestExecuted(_submissionId, status);
        } else {
            IWrappedAsset(debridge.tokenAddress).mint(_receiver, _amount);
        }
        emit Minted(_submissionId, _amount, _receiver, _debridgeId);
    }

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function _claim(
        bytes32 _submissionId,
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data
    ) internal {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        require(debridge.chainId == chainId, "claim: wrong target chain");
        require(!isSubmissionUsed[_submissionId], "claim: already used");
        require(!isBlockedSubmission[_submissionId], "claim: blocked submission");

        isSubmissionUsed[_submissionId] = true;
        debridge.balance -= _amount;
        if (debridge.tokenAddress == address(0)) {
            if (_executionFee > 0) {
                payable(msg.sender).transfer(_executionFee);
            }
            if(_data.length > 0)
            {
                bool status = ICallProxy(callProxy).call{value: _amount}(
                    _fallbackAddress,
                    _receiver,
                    _data
                );
                emit AutoRequestExecuted(_submissionId, status);
            } else {
                payable(_receiver).transfer(_amount);
            }
        } else {
            if (_executionFee > 0) {
                IERC20(debridge.tokenAddress).safeTransfer(msg.sender, _executionFee);
            }
            if(_data.length > 0){
                IERC20(debridge.tokenAddress).safeTransfer(callProxy, _amount);
                bool status = ICallProxy(callProxy).callERC20(
                    debridge.tokenAddress,
                    _fallbackAddress,
                    _receiver,
                    _data
                );
                emit AutoRequestExecuted(_submissionId, status);
            } else {
                IERC20(debridge.tokenAddress).safeTransfer(_receiver, _amount);
            }
        }
        emit Claimed(_submissionId, _amount, _receiver, _debridgeId);
    }

    /* VIEW */

    /// @dev Get the balance.
    /// @param _tokenAddress Address of the asset on the other chain.
    function getBalance(address _tokenAddress) public view returns (uint256) {
        if (_tokenAddress == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(_tokenAddress).balanceOf(address(this));
        }
    }

    /// @dev Calculates asset identifier.
    /// @param _chainId Current chain id.
    /// @param _tokenAddress Address of the asset on the other chain.
    function getDebridgeId(uint256 _chainId, address _tokenAddress)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(_chainId, _tokenAddress));
    }

    /// @dev Calculate submission id.
    /// @param _debridgeId Asset identifier.
    /// @param _chainIdFrom Chain identifier of the chain where tokens are sent from.
    /// @param _chainIdTo Chain identifier of the chain where tokens are sent to.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    function getSubmisionId(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        uint256 _chainIdTo,
        uint256 _amount,
        address _receiver,
        uint256 _nonce
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _debridgeId,
                    _chainIdFrom,
                    _chainIdTo,
                    _amount,
                    _receiver,
                    _nonce
                )
            );
    }

    /// @dev Calculate submission id for auto claimable transfer.
    /// @param _debridgeId Asset identifier.
    /// @param _chainIdFrom Chain identifier of the chain where tokens are sent from.
    /// @param _chainIdTo Chain identifier of the chain where tokens are sent to.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function getAutoSubmisionId(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        uint256 _chainIdTo,
        uint256 _amount,
        address _receiver,
        uint256 _nonce,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _debridgeId,
                    _chainIdFrom,
                    _chainIdTo,
                    _amount,
                    _receiver,
                    _nonce,
                    _fallbackAddress,
                    _executionFee,
                    _data
                )
            );
    }

    function getDebridgeInfo(bytes32 _debridgeId)
        external
        view
        override
        returns (address _tokenAddress, uint256 _chainId, bool _exist)
    {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        return (debridge.tokenAddress, debridge.chainId, debridge.exist);
    }
}
