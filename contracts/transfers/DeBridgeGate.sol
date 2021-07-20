// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../interfaces/ILightVerifier.sol";
import "../interfaces/IFeeProxy.sol";
import "../interfaces/IWETH.sol";
import "../interfaces/IDeBridgeGate.sol";
import "../interfaces/IDefiController.sol";
import "../interfaces/IFullAggregator.sol";
import "../interfaces/ICallProxy.sol";
import "../periphery/WrappedAsset.sol";
import "../periphery/Pausable.sol";

contract DeBridgeGate is AccessControl,
                         Initializable,
                         Pausable,
                         IDeBridgeGate {
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    uint256 public constant DENOMINATOR = 1e18; // accuacy multiplyer
    uint256 public chainId; // current chain id
    uint256 public collectedFees; // current native fee
    uint256 public excessConfirmations; // minimal required confirmations in case of too many confirmations
    address public ligthAggregator; // current aggregator address address to verify signatures
    address public fullAggregator; // current aggregator address to verify by oracles confirmations
    address public callProxy; // proxy to execute user's calls
    uint8 public aggregatorLightVersion; // aggregators count
    uint8 public aggregatorFullVersion; // aggregators count
    uint256[] public chainIds; // list of all supported chain ids
    IDefiController public defiController; // proxy to use the locked assets in Defi protocols
    mapping(bytes32 => DebridgeInfo) public getDebridge; // debridgeId (i.e. hash(native chainId, native tokenAddress)) => token
    mapping(bytes32 => bool) public isSubmissionUsed; // submissionId (i.e. hash( debridgeId, amount, receiver, nonce)) => whether is claimed
    mapping(bytes32 => bool) public isBlockedSubmission; // submissionId  => is blocked
    mapping(address => uint256) public getUserNonce; // userAddress => transactions count
    mapping(uint8 => AggregatorInfo) public getOldLightAggregator; // counter => agrgregator info
    mapping(uint8 => AggregatorInfo) public getOldFullAggregator; // counter => agrgregator info
    mapping(bytes32 => uint256) public getAmountThreshold; // debridge => amount threshold
    mapping(uint256 => ChainSupportInfo) public getChainSupport; // whether the chain for the asset is supported

    IFeeProxy public feeProxy; // proxy to convert the collected fees into Link's
    IWETH public weth; // wrapped native token contract
    address treasury; //address of treasury

    /* ========== MODIFIERS ========== */

    bytes32 public constant AGGREGATOR_ROLE = keccak256("AGGREGATOR_ROLE");

    modifier onlyAggregator {
        require(hasRole(AGGREGATOR_ROLE, msg.sender), "onlyAggregator: bad role");
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

    /* ========== CONSTRUCTOR  ========== */

    /// @dev Constructor that initializes the most important configurations.
    /// @param _ligthAggregator Aggregator address to verify signatures
    /// @param _fullAggregator Aggregator address to verify by oracles confirmations
    /// @param _supportedChainIds Chain ids where native token of the current chain can be wrapped.
    /// @param _treasury Address to collect a fee
    function initialize(
        uint256 _excessConfirmations,
        address _ligthAggregator,
        address _fullAggregator,
        address _callProxy,
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo,
        IWETH _weth,
        IFeeProxy _feeProxy,
        IDefiController _defiController,
        address _treasury
    ) public payable initializer {
        uint256 cid;
        assembly {
            cid := chainid()
        }
        chainId = cid;
        bytes32 debridgeId = getDebridgeId(chainId, address(0));
        _addAsset(debridgeId, address(0), chainId);
        chainIds = _supportedChainIds;
        for (uint256 i = 0; i < _supportedChainIds.length; i++) {
            getChainSupport[_supportedChainIds[i]] = _chainSupportInfo[i];
        }
        
        ligthAggregator = _ligthAggregator;
        fullAggregator = _fullAggregator;

        callProxy = _callProxy;
        defiController = _defiController;
        excessConfirmations = _excessConfirmations;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

        weth = _weth;
        feeProxy = _feeProxy;
        treasury = _treasury;
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
        uint256 nonce = getUserNonce[_receiver];
        bytes32 sentId = getSubmisionId(
            debridgeId,
            chainId,
            _chainIdTo,
            _amount,
            _receiver,
            nonce
        );
        emit Sent(sentId, debridgeId, _amount, _receiver, nonce, _chainIdTo);
        getUserNonce[_receiver]++;
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
                                         ? ligthAggregator 
                                         : fullAggregator);

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
        uint256 nonce = getUserNonce[_receiver];
        bytes32 burntId = getSubmisionId(
            _debridgeId,
            chainId,
            _chainIdTo,
            _amount,
            _receiver,
            nonce
        );
        emit Burnt(burntId, _debridgeId, _amount, _receiver, nonce, _chainIdTo);
        getUserNonce[_receiver]++;
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
        require(_amount >= _executionFee, "autoSend: proposed fee too high");
        _amount -= _executionFee;
        uint256 nonce = getUserNonce[_receiver];
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
        getUserNonce[_receiver]++;
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
                                           ? ligthAggregator 
                                           : fullAggregator);

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
        require(_amount >= _executionFee, "autoBurn: proposed fee too high");
        _amount -= _executionFee;
        uint256 nonce = getUserNonce[_receiver];
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
        getUserNonce[_receiver]++;
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

    /* ========== OldAggregator mint, claim ========== */

    /// @dev Mints wrapped asset on the current chain.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _signatures Array of oracles signatures.
    /// @param _aggregatorVersion Aggregator version.
    function mintWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures,
        uint8 _aggregatorVersion
    ) external override whenNotPaused(){
        bytes32 submissionId = getSubmisionId(
            _debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce
        );
        
        _checkAndDeployAsset(_debridgeId, _signatures.length > 0 
                                        ? getOldLightAggregator[_aggregatorVersion].aggregator
                                        : getOldFullAggregator[_aggregatorVersion].aggregator);
            

        _checkConfirmationsOldAggregator(
            submissionId, 
            _debridgeId, 
            _amount, 
            _signatures,
            _aggregatorVersion);

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

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    /// @param _aggregatorVersion Aggregator version.
    function claimWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures,
        uint8 _aggregatorVersion
    ) external override whenNotPaused(){
        bytes32 submissionId = getSubmisionId(
            _debridgeId,
            _chainIdFrom,
            chainId,
            _amount,
            _receiver,
            _nonce
        );
        
        _checkConfirmationsOldAggregator(
            submissionId, 
            _debridgeId, 
            _amount, 
            _signatures, 
            _aggregatorVersion);

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

    /* ========== AUTO OldAggregator mint, claim ========== */

    /// @dev Mints wrapped asset on the current chain.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    /// @param _nonce Submission id.
    /// @param _signatures Array of oracles signatures.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoMintWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        uint8 _aggregatorVersion
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
                                        ? getOldLightAggregator[_aggregatorVersion].aggregator
                                        : getOldFullAggregator[_aggregatorVersion].aggregator);

        _checkConfirmationsOldAggregator(
            submissionId, 
            _debridgeId, 
            _amount, 
            _signatures, 
            _aggregatorVersion);

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

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoClaimWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data,
        uint8 _aggregatorVersion
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
        
        _checkConfirmationsOldAggregator(
            submissionId, 
            _debridgeId, 
            _amount, 
            _signatures, 
            _aggregatorVersion);

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

    
    /* ========== ADMIN ========== */

    /// @dev Update asset's fees.
    /// @param _supportedChainIds Chain identifiers.
    /// @param _chainSupportInfo Cahin support info.
    function updateChainSupport(
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo
    ) external onlyAdmin() {
        chainIds = _supportedChainIds;
        for (uint256 i = 0; i < _supportedChainIds.length; i++) {
            getChainSupport[_supportedChainIds[i]] = _chainSupportInfo[i];
        }
        emit ChainsSupportUpdated(_supportedChainIds);
    }

    /// @dev Update asset's fees.
    /// @param _debridgeId Asset identifier.
    /// @param _supportedChainIds Chain identifiers.
    /// @param _assetFeesInfo Cahin support info.
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

    function updateExcessConfirmations(uint256 _excessConfirmations) external onlyAdmin() {
        excessConfirmations = _excessConfirmations;
    }
    

    /// @dev Set support for the chains where the token can be transfered.
    /// @param _debridgeId Asset identifier.
    /// @param _chainId Current chain id.
    /// @param _isSupported Whether the token is transferable to the other chain.
    function setChainIdSupport(
        bytes32 _debridgeId,
        uint256 _chainId,
        bool _isSupported
    ) external onlyAdmin() {
        getChainSupport[_chainId].isSupported = _isSupported;
        if (_isSupported) {
            emit ChainSupportAdded(_debridgeId, _chainId);
        } else {
            emit ChainSupportRemoved(_debridgeId, _chainId);
        }
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
    /// @param _minReserves Minimal reserve ration.
    function updateAsset(
        bytes32 _debridgeId,
        uint256 _maxAmount,
        uint256 _minReserves,
        uint256 _amountThreshold
    ) external onlyAdmin() {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        debridge.maxAmount = _maxAmount;
        debridge.minReserves = _minReserves;
        getAmountThreshold[_debridgeId] = _amountThreshold;
    }

    /// @dev Set aggregator address.
    /// @param _aggregator Submission aggregator address.
    function setAggregator(address _aggregator, bool _isLight) external onlyAdmin() {
        if(_isLight){
            getOldLightAggregator[aggregatorLightVersion] = AggregatorInfo(_aggregator, true);
            ligthAggregator = _aggregator;
            aggregatorLightVersion++;
        }
        else{
            getOldFullAggregator[aggregatorFullVersion] = AggregatorInfo(_aggregator, true);
            fullAggregator = _aggregator;
            aggregatorFullVersion++;
        }
    }

    /// @dev Set aggregator address.
    /// @param _aggregatorVersion Submission aggregator address.
    /// @param _isValid Is valid.
    function manageOldAggregator(uint8 _aggregatorVersion, bool _isLight, bool _isValid) external onlyAdmin() {
        if(_isLight){
            require(_aggregatorVersion < aggregatorLightVersion, "manageOldAggregator: version too high");
            getOldLightAggregator[_aggregatorVersion].isValid = _isValid;
        }
        else{
            require(_aggregatorVersion < aggregatorFullVersion, "manageOldAggregator: version too high");
            getOldFullAggregator[_aggregatorVersion].isValid = _isValid;
        }
    }

    /// @dev Set defi controoler.
    /// @param _defiController Defi controller address address.
    function setDefiController(IDefiController _defiController) external onlyAdmin() {
        // TODO: claim all the reserves before
        defiController = _defiController;
    }

    /// @dev Stop all transfers.
    function pause() external onlyAdmin() whenNotPaused() {
        _pause();
    }

    /// @dev Allow transfers.
    function unpause() external onlyAdmin() whenPaused() {
        _unpause();
    }

    /// @dev Withdraw fees.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of tokens to withdraw.
    function withdrawFee(bytes32 _debridgeId, address _receiver, uint256 _amount) external onlyAdmin() {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        // require(debridge.chainId == chainId, "withdrawFee: wrong target chain");
        require(debridge.collectedFees >= _amount, "withdrawFee: not enough fee");
        debridge.collectedFees -= _amount;
        if (
            debridge.chainId == chainId && debridge.tokenAddress == address(0)
        ) {
            payable(_receiver).transfer(_amount);
        } else {
            IERC20(debridge.tokenAddress).safeTransfer(_receiver, _amount);
        }
    }

    /// @dev Withdraw fees.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of tokens to withdraw.
    function withdrawNativeFee(address _receiver, uint256 _amount) external onlyAdmin() {
        require(collectedFees >= _amount, "withdrawNativeFee: not enough fee");
        collectedFees -= _amount;
        payable(_receiver).transfer(_amount);
    }

    /// @dev Request the assets to be used in defi protocol.
    /// @param _tokenAddress Asset address.
    /// @param _amount Amount of tokens to request.
    function requestReserves(address _tokenAddress, uint256 _amount)
        external
        onlyDefiController()
    {
        bytes32 debridgeId = getDebridgeId(chainId, _tokenAddress);
        DebridgeInfo storage debridge = getDebridge[debridgeId];
        uint256 minReserves = (debridge.balance * debridge.minReserves) /
            DENOMINATOR;
        uint256 balance = getBalance(debridge.tokenAddress);
        require( minReserves + _amount > balance, "requestReserves: not enough reserves");
        if (debridge.tokenAddress == address(0)) {
            payable(address(defiController)).transfer(_amount);
        } else {
            IERC20(debridge.tokenAddress).safeTransfer(
                address(defiController),
                _amount
            );
        }
    }

    /// @dev Return the assets that were used in defi protocol.
    /// @param _tokenAddress Asset address.
    /// @param _amount Amount of tokens to claim.
    function returnReserves(address _tokenAddress, uint256 _amount)
        external
        payable
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
        }
    }

    /// @dev Fund treasury.
    /// @param _debridgeId Asset identifier.
    /// @param _amount Submission aggregator address.
    function fundTreasury(bytes32 _debridgeId, uint256 _amount) external {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        require(debridge.collectedFees >= _amount, "fundTreasury: not enough fee");
        debridge.collectedFees -= _amount;
        if (debridge.tokenAddress == address(0)) {
            weth.deposit{value: _amount}();
            weth.transfer(address(feeProxy), _amount);
            feeProxy.swapToLink(address(weth), treasury);
        } else {
            IERC20(debridge.tokenAddress).safeTransfer(
                address(feeProxy),
                _amount
            );
            feeProxy.swapToLink(debridge.tokenAddress, treasury);
        }
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


    function blockSubmission(bytes32[] memory _submissionIds) external onlyAdmin() {
        for (uint256 i = 0; i < _submissionIds.length; i++) {
           isBlockedSubmission[_submissionIds[i]] = true;
           emit Blocked(_submissionIds[i]);
        }
    }

    function unBlockSubmission(bytes32[] memory _submissionIds) external onlyAdmin() {
        for (uint256 i = 0; i < _submissionIds.length; i++) {
           isBlockedSubmission[_submissionIds[i]] = false;
           emit Unblocked(_submissionIds[i]);
        }
    }


    /* ========== INTERNAL ========== */
     
    function _checkAndDeployAsset(bytes32 debridgeId, address aggregatorAddress) internal {
        if(!getDebridge[debridgeId].exist){
            (address wrappedAssetAddress, uint256 nativeChainId) = 
                    IFullAggregator(aggregatorAddress).deployAsset(debridgeId);
            require(wrappedAssetAddress != address(0), "mint: wrapped asset not exist");
            _addAsset(debridgeId, wrappedAssetAddress, nativeChainId);
        }
    }

     function _checkConfirmations(bytes32 _submissionId, bytes32 _debridgeId, 
                                  uint256 _amount, bytes[] memory _signatures) 
        internal {
        (uint256 confirmations, bool confirmed) = 
                _signatures.length > 0 
                ? ILightVerifier(ligthAggregator).submit(_submissionId, _signatures)
                : IFullAggregator(fullAggregator).getSubmissionConfirmations(_submissionId);
        require(confirmed, "not confirmed");
        if (_amount >= getAmountThreshold[_debridgeId]) {
            require(confirmations >= excessConfirmations, "amount not confirmed");
        }
    }

    function _checkConfirmationsOldAggregator(bytes32 _submissionId, bytes32 _debridgeId, 
                                              uint256 _amount, bytes[] memory _signatures,
                                              uint8 _aggregatorVersion) 
        internal {
        AggregatorInfo memory aggregatorInfo 
                = _signatures.length > 0 
                ? getOldLightAggregator[_aggregatorVersion]
                : getOldFullAggregator[_aggregatorVersion];
        require(aggregatorInfo.isValid, "invalidAggregator" );
        (uint256 confirmations, bool confirmed) = 
                _signatures.length > 0 
                ? ILightVerifier(aggregatorInfo.aggregator).submit(_submissionId, _signatures)
                : IFullAggregator(aggregatorInfo.aggregator).getSubmissionConfirmations(_submissionId);
        require(confirmed, "not confirmed");
        if (_amount >= getAmountThreshold[_debridgeId]) {
            require(confirmations >= excessConfirmations, "amount not confirmed");
        }
    }

    /// @dev Add support for the asset.
    /// @param _debridgeId Asset identifier.
    /// @param _tokenAddress Address of the asset on the other chain.
    /// @param _chainId Current chain id.
    function _addAsset(bytes32 _debridgeId, address _tokenAddress, uint256 _chainId) internal {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        debridge.exist = true;
        debridge.tokenAddress = _tokenAddress;
        debridge.chainId = _chainId;
        //Don't override if the admin already set maxAmount
        if(debridge.maxAmount == 0){
            debridge.maxAmount = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
        }
        // debridge.minReserves = DENOMINATOR;
        if(getAmountThreshold[_debridgeId] == 0){
            getAmountThreshold[_debridgeId] = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
        }
        emit PairAdded(
            _debridgeId,
            _tokenAddress,
            _chainId,
            debridge.maxAmount,
            debridge.minReserves
        );
    }

    /// @dev Request the assets to be used in defi protocol.
    /// @param _debridge Asset info.
    /// @param _amount Required amount of tokens.
    function _ensureReserves(DebridgeInfo storage _debridge, uint256 _amount) internal {
        uint256 minReserves = (_debridge.balance * _debridge.minReserves) /
            DENOMINATOR;
        uint256 balance = getBalance(_debridge.tokenAddress);
        uint256 requestedReserves = minReserves > _amount
            ? minReserves
            : _amount;
        if (requestedReserves > balance) {
            requestedReserves = requestedReserves - balance;
            defiController.claimReserve(
                _debridge.tokenAddress,
                requestedReserves
            );
        }
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
            _addAsset(_debridgeId, _tokenAddress, chainId);
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
            require(fixedFee != 0, "send: fixed fee for asset is not supported");
            uint256 transferFee = fixedFee +
                (_amount * chainSupportInfo.transferFee) /
                DENOMINATOR;
            require(_amount >= transferFee, "send: amount not cover fees");
            debridge.collectedFees += transferFee;
            _amount -= transferFee;
        } else {
            {
                uint256 transferFee = (_amount*chainSupportInfo.transferFee)/DENOMINATOR;
                require(_amount >= transferFee, "send: amount not cover fees");
                debridge.collectedFees += transferFee;
                _amount -= transferFee;
            }
            require(msg.value >= chainSupportInfo.fixedNativeFee, "send: amount not cover fees");
            collectedFees += msg.value;
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
            (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);
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
            require(fixedFee != 0, "send: fixed fee for asset is not supported");
            uint256 transferFee = fixedFee +
                (_amount * chainSupportInfo.transferFee) /
                DENOMINATOR;
            require(_amount >= transferFee, "send: amount not cover fees");
            debridge.collectedFees += transferFee;
            _amount -= transferFee;
        } else {
            {
                uint256 transferFee = (_amount*chainSupportInfo.transferFee)/DENOMINATOR;
                require(_amount >= transferFee, "send: amount not cover fees");
                debridge.collectedFees += transferFee;
                _amount -= transferFee;
            }
            require(msg.value >= chainSupportInfo.fixedNativeFee, "send: amount not cover fees");
            collectedFees += msg.value;
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
        _ensureReserves(debridge, _amount);
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

    /// @dev Splits signature bytes to r,s,v components.
    /// @param _signature Signature bytes in format r+s+v.
    function splitSignature(bytes memory _signature)
        public
        pure
        returns (
            bytes32 r,
            bytes32 s,
            uint8 v
        )
    {
        require(_signature.length == 65, "splitSignature: invalid signature length");
        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }
    }

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
}
