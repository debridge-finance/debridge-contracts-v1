// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../interfaces/IWhiteDebridge.sol";
import "../interfaces/IFeeProxy.sol";
import "../interfaces/IWETH.sol";
import "../interfaces/IDefiController.sol";
import "../interfaces/IWhiteFullAggregator.sol";
import "../interfaces/ICallProxy.sol";
import "../periphery/WrappedAsset.sol";
import "../periphery/Pausable.sol";

abstract contract WhiteDebridge is
    AccessControl,
    IWhiteDebridge,
    Initializable,
    Pausable
{
    using SafeERC20 for IERC20;

    struct DebridgeInfo {
        address tokenAddress; // asset address on the current chain
        uint256 chainId; // native chain id
        uint256 minAmount; // minimal amount to transfer
        uint256 maxAmount; // minimal amount to transfer
        uint256 collectedFees; // total collected fees that can be used to buy LINK
        uint256 balance; // total locked assets
        uint256 minReserves; // minimal hot reserves
        mapping(uint256 => ChainSupportInfo) chainSupported; // whether the chain for the asset is supported
    }

    struct AggregatorInfo {
        address aggregator; // aggregator address
        bool isValid; // if is still valid
    }

    uint256 public constant DENOMINATOR = 1e18; // accuacy multiplyer
    uint256 public chainId; // current chain id
    address public aggregator; // current chainlink aggregator address
    address public callProxy; // proxy to execute user's calls
    uint8 public aggregatorVersion; // aggregators count
    uint256[] public chainIds; // list of all supported chain ids
    IDefiController public defiController; // proxy to use the locked assets in Defi protocols
    mapping(bytes32 => DebridgeInfo) public getDebridge; // debridgeId (i.e. hash(native chainId, native tokenAddress)) => token
    mapping(bytes32 => bool) public isSubmissionUsed; // submissionId (i.e. hash( debridgeId, amount, receiver, nonce)) => whether is claimed
    mapping(address => uint256) public getUserNonce; // userAddress => transactions count
    mapping(uint8 => AggregatorInfo) public getOldAggregator; // counter => agrgregator info

    event Sent(
        bytes32 submissionId,
        bytes32 debridgeId,
        uint256 amount,
        address receiver,
        uint256 nonce,
        uint256 chainIdTo
    ); // emited once the native tokens are locked to be sent to the other chain
    event AutoSent(
        bytes32 submissionId,
        bytes32 debridgeId,
        uint256 amount,
        address receiver,
        uint256 nonce,
        uint256 chainIdTo,
        uint256 claimFee,
        bytes data
    ); // emited once the native tokens are locked to be sent to the other chain
    event Minted(
        bytes32 submissionId,
        uint256 amount,
        address receiver,
        bytes32 debridgeId
    ); // emited once the wrapped tokens are minted on the current chain
    event Burnt(
        bytes32 submissionId,
        bytes32 debridgeId,
        uint256 amount,
        address receiver,
        uint256 nonce,
        uint256 chainIdTo
    ); // emited once the wrapped tokens are sent to the contract
    event AutoBurnt(
        bytes32 submissionId,
        bytes32 debridgeId,
        uint256 amount,
        address receiver,
        uint256 nonce,
        uint256 chainIdTo,
        uint256 claimFee,
        bytes data
    ); // emited once the wrapped tokens are sent to the contract
    event Claimed(
        bytes32 submissionId,
        uint256 amount,
        address receiver,
        bytes32 debridgeId
    ); // emited once the tokens are withdrawn on native chain
    event PairAdded(
        bytes32 indexed debridgeId,
        address indexed tokenAddress,
        uint256 indexed chainId,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 minReserves
    ); // emited when new asset is supported
    event ChainSupportAdded(
        bytes32 indexed debridgeId,
        uint256 indexed chainId
    ); // emited when the asset is allowed to be spent on other chains
    event ChainSupportRemoved(
        bytes32 indexed debridgeId,
        uint256 indexed chainId
    ); // emited when the asset is disallowed to be spent on other chains
    event ChainsSupportUpdated(uint256[] chainIds); // emited when the supported assets are updated
    event CallProxyUpdated(address callProxy); // emited when the new call proxy set
    event AutoRequestExecuted(bytes32 submissionId, bool success); // emited when the new call proxy set

    modifier onlyAggregator {
        require(aggregator == msg.sender, "onlyAggregator: bad role");
        _;
    }
    modifier onlyDefiController {
        require(
            address(defiController) == msg.sender,
            "defiController: bad role"
        );
        _;
    }
    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "onlyAdmin: bad role");
        _;
    }

    /* EXTERNAL */

    /// @dev Constructor that initializes the most important configurations.
    /// @param _minAmount Minimal amount of current chain token to be wrapped.
    /// @param _maxAmount Maximum amount of current chain token to be wrapped.
    /// @param _minReserves Minimal reserve ratio.
    /// @param _aggregator Submission aggregator address.
    /// @param _supportedChainIds Chain ids where native token of the current chain can be wrapped.
    function _initialize(
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _minReserves,
        address _aggregator,
        address _callProxy,
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo,
        IDefiController _defiController
    ) internal {
        uint256 cid;
        assembly {
            cid := chainid()
        }
        chainId = cid;
        bytes32 debridgeId = getDebridgeId(chainId, address(0));
        _addAsset(
            debridgeId,
            address(0),
            chainId,
            _minAmount,
            _maxAmount,
            _minReserves,
            _supportedChainIds,
            _chainSupportInfo
        );
        aggregator = _aggregator;
        callProxy = _callProxy;
        chainIds = _supportedChainIds;
        _defiController = defiController;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @dev Locks asset on the chain and enables minting on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount to be transfered (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function send(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo
    ) external payable override whenNotPaused() {
        _amount = _send(_debridgeId, _amount, _chainIdTo);
        uint256 nonce = getUserNonce[_receiver];
        bytes32 sentId =
            getSubmisionId(
                _debridgeId,
                chainId,
                _chainIdTo,
                _amount,
                _receiver,
                nonce
            );
        emit Sent(sentId, _debridgeId, _amount, _receiver, nonce, _chainIdTo);
        getUserNonce[_receiver]++;
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
        bytes memory _signature
    ) external override whenNotPaused() {
        _amount = _burn(
            _debridgeId,
            _amount,
            _chainIdTo,
            _deadline,
            _signature
        );
        uint256 nonce = getUserNonce[_receiver];
        bytes32 burntId =
            getSubmisionId(
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

    /// @dev Locks asset on the chain and enables minting on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount to be transfered (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    /// @param _fallbackAddress Receiver of the tokens if the call fails.
    /// @param _executionFee Fee paid to the transaction executor.
    /// @param _data Chain id of the target chain.
    function autoSend(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        address _fallbackAddress,
        uint256 _executionFee,
        bytes memory _data
    ) external payable whenNotPaused() {
        require(_executionFee != 0, "autoSend: fee too low");
        _amount = _send(_debridgeId, _amount, _chainIdTo);
        require(_amount >= _executionFee, "autoSend: proposed fee too high");
        _amount -= _executionFee;
        uint256 nonce = getUserNonce[_receiver];
        bytes32 sentId =
            getAutoSubmisionId(
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
        emit AutoSent(
            sentId,
            _debridgeId,
            _amount,
            _receiver,
            nonce,
            _chainIdTo,
            _executionFee,
            _data
        );
        getUserNonce[_receiver]++;
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
        bytes memory _signature
    ) external whenNotPaused() {
        require(_executionFee != 0, "autoBurn: fee too low");
        _amount = _burn(
            _debridgeId,
            _amount,
            _chainIdTo,
            _deadline,
            _signature
        );
        require(_amount >= _executionFee, "autoBurn: proposed fee too high");
        _amount -= _executionFee;

        uint256 nonce = getUserNonce[_receiver];
        bytes32 burntId =
            getAutoSubmisionId(
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
            _data
        );
        getUserNonce[_receiver]++;
    }

    /* ADMIN */

    /// @dev Add support for the asset on the current chain.
    /// @param _tokenAddress Address of the asset on the current chain.
    /// @param _minAmount Minimal amount of current chain token to be wrapped.
    /// @param _maxAmount Maximum amount of current chain token to be wrapped.
    /// @param _minReserves Minimal reserve ration.
    /// @param _supportedChainIds Chain ids where native token of the current chain can be wrapped.
    function addNativeAsset(
        address _tokenAddress,
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _minReserves,
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo
    ) external override onlyAdmin() {
        bytes32 debridgeId = getDebridgeId(chainId, _tokenAddress);
        _addAsset(
            debridgeId,
            _tokenAddress,
            chainId,
            _minAmount,
            _maxAmount,
            _minReserves,
            _supportedChainIds,
            _chainSupportInfo
        );
    }

    /// @dev Add support for the asset from the other chain, deploy new wrapped asset.
    /// @param _tokenAddress Address of the asset on the other chain.
    /// @param _wrappedAssetAddress Wrapped asset address.
    /// @param _chainId Current chain id.
    /// @param _minAmount Minimal amount of the asset to be wrapped.
    /// @param _maxAmount Maximum amount of current chain token to be wrapped.
    /// @param _minReserves Minimal reserve ration.
    /// @param _supportedChainIds Chain ids where the token of the current chain can be transfered.
    function addExternalAsset(
        address _tokenAddress,
        address _wrappedAssetAddress,
        uint256 _chainId,
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _minReserves,
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo
    ) external override onlyAdmin() {
        bytes32 debridgeId = getDebridgeId(_chainId, _tokenAddress);
        _addAsset(
            debridgeId,
            _wrappedAssetAddress,
            _chainId,
            _minAmount,
            _maxAmount,
            _minReserves,
            _supportedChainIds,
            _chainSupportInfo
        );
    }

    /// @dev Set support for the chains where the token can be transfered.
    /// @param _debridgeId Asset identifier.
    /// @param _chainId Current chain id.
    /// @param _isSupported Whether the token is transferable to the other chain.
    function setChainIdSupport(
        bytes32 _debridgeId,
        uint256 _chainId,
        bool _isSupported
    ) external override onlyAdmin() {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        debridge.chainSupported[_chainId].isSupported = _isSupported;
        if (_isSupported) {
            emit ChainSupportAdded(_debridgeId, _chainId);
        } else {
            emit ChainSupportRemoved(_debridgeId, _chainId);
        }
    }

    /// @dev Set support for the chains.
    /// @param _chainIds All supported chain ids.
    function setChainIds(uint256[] memory _chainIds) external onlyAdmin() {
        chainIds = _chainIds;
        emit ChainsSupportUpdated(_chainIds);
    }

    /// @dev Set proxy address.
    /// @param _callProxy Address of the proxy that executes external calls.
    function setCallProxy(address _callProxy) external onlyAdmin() {
        callProxy = _callProxy;
        emit CallProxyUpdated(_callProxy);
    }

    /// @dev Add support for the asset.
    /// @param _debridgeId Asset identifier.
    /// @param _minAmount Minimal amount of the asset to be wrapped.
    /// @param _maxAmount Maximum amount of current chain token to be wrapped.
    /// @param _minReserves Minimal reserve ration.
    function updateAsset(
        bytes32 _debridgeId,
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _minReserves
    ) external onlyAdmin() {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        debridge.minAmount = _minAmount;
        debridge.maxAmount = _maxAmount;
        debridge.minReserves = _minReserves;
    }

    /// @dev Update asset's fees.
    /// @param _debridgeId Asset identifier.
    /// @param _supportedChainIds Chain identifiers.
    /// @param _chainSupportInfo Cahin support info.
    function updateAsset(
        bytes32 _debridgeId,
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo
    ) external onlyAdmin() {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        for (uint256 i = 0; i < _supportedChainIds.length; i++) {
            debridge.chainSupported[_supportedChainIds[i]] = _chainSupportInfo[
                i
            ];
        }
    }

    /// @dev Set aggregator address.
    /// @param _aggregator Submission aggregator address.
    function setAggregator(address _aggregator) external onlyAdmin() {
        getOldAggregator[aggregatorVersion] = AggregatorInfo(aggregator, true);
        aggregator = _aggregator;
        aggregatorVersion++;
    }

    /// @dev Set aggregator address.
    /// @param _aggregatorVersion Submission aggregator address.
    /// @param _isValid Is valid.
    function manageOldAggregator(uint8 _aggregatorVersion, bool _isValid)
        external
        onlyAdmin()
    {
        require(
            _aggregatorVersion < aggregatorVersion,
            "manageOldAggregator: version too high"
        );
        getOldAggregator[_aggregatorVersion].isValid = _isValid;
    }

    /// @dev Set defi controoler.
    /// @param _defiController Defi controller address address.
    function setDefiController(IDefiController _defiController)
        external
        onlyAdmin()
    {
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
    function withdrawFee(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount
    ) external onlyAdmin() {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        // require(debridge.chainId == chainId, "withdrawFee: wrong target chain");
        require(
            debridge.collectedFees >= _amount,
            "withdrawFee: not enough fee"
        );
        debridge.collectedFees -= _amount;
        if (
            debridge.chainId == chainId && debridge.tokenAddress == address(0)
        ) {
            payable(_receiver).transfer(_amount);
        } else {
            IERC20(debridge.tokenAddress).safeTransfer(_receiver, _amount);
        }
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
        uint256 minReserves =
            (debridge.balance * debridge.minReserves) / DENOMINATOR;
        uint256 balance = getBalance(debridge.tokenAddress);
        require(
            minReserves + _amount > balance,
            "requestReserves: not enough reserves"
        );
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

    /* INTERNAL */

    /// @dev Add support for the asset.
    /// @param _debridgeId Asset identifier.
    /// @param _tokenAddress Address of the asset on the other chain.
    /// @param _chainId Current chain id.
    /// @param _minAmount Minimal amount of the asset to be wrapped.
    /// @param _maxAmount Maximum amount of current chain token to be wrapped.
    /// @param _minReserves Minimal reserve ration.
    /// @param _supportedChainIds Chain ids where the token of the current chain can be transfered.
    /// @param _chainSupportInfo Cahin support info.
    function _addAsset(
        bytes32 _debridgeId,
        address _tokenAddress,
        uint256 _chainId,
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _minReserves,
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo
    ) internal {
        require(
            _supportedChainIds.length == _chainSupportInfo.length,
            "_addAsset: wrong chain support lengths"
        );
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        debridge.tokenAddress = _tokenAddress;
        debridge.chainId = _chainId;
        debridge.minAmount = _minAmount;
        debridge.maxAmount = _maxAmount;
        debridge.minReserves = _minReserves;
        uint256 supportedChainId;
        for (uint256 i = 0; i < _supportedChainIds.length; i++) {
            supportedChainId = _supportedChainIds[i];
            debridge.chainSupported[supportedChainId] = _chainSupportInfo[i];
            emit ChainSupportAdded(_debridgeId, supportedChainId);
        }
        emit PairAdded(
            _debridgeId,
            _tokenAddress,
            _chainId,
            _minAmount,
            _maxAmount,
            _minReserves
        );
    }

    /// @dev Request the assets to be used in defi protocol.
    /// @param _debridge Asset info.
    /// @param _amount Required amount of tokens.
    function _ensureReserves(DebridgeInfo storage _debridge, uint256 _amount)
        internal
    {
        uint256 minReserves =
            (_debridge.balance * _debridge.minReserves) / DENOMINATOR;
        uint256 balance = getBalance(_debridge.tokenAddress);
        uint256 requestedReserves =
            minReserves > _amount ? minReserves : _amount;
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
        bytes32 _debridgeId,
        uint256 _amount,
        uint256 _chainIdTo
    ) internal returns (uint256) {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        ChainSupportInfo memory chainSupportInfo =
            debridge.chainSupported[_chainIdTo];
        require(debridge.chainId == chainId, "send: not native chain");
        require(chainSupportInfo.isSupported, "send: wrong targed chain");
        require(_amount >= debridge.minAmount, "send: amount too low");
        require(_amount <= debridge.maxAmount, "send: amount too high");
        if (debridge.tokenAddress == address(0)) {
            require(_amount == msg.value, "send: amount mismatch");
        } else {
            IERC20(debridge.tokenAddress).safeTransferFrom(
                msg.sender,
                address(this),
                _amount
            );
        }
        uint256 transferFee =
            chainSupportInfo.fixedFee +
                (_amount * chainSupportInfo.transferFee) /
                DENOMINATOR;
        if (transferFee > 0) {
            require(_amount >= transferFee, "send: amount not cover fees");
            debridge.collectedFees += transferFee;
            _amount -= transferFee;
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
        bytes memory _signature
    ) internal returns (uint256) {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        ChainSupportInfo memory chainSupportInfo =
            debridge.chainSupported[_chainIdTo];
        require(debridge.chainId != chainId, "burn: native asset");
        require(chainSupportInfo.isSupported, "burn: wrong targed chain");
        require(_amount >= debridge.minAmount, "burn: amount too low");
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
        uint256 transferFee =
            chainSupportInfo.fixedFee +
                (_amount * chainSupportInfo.transferFee) /
                DENOMINATOR;
        if (transferFee > 0) {
            require(_amount >= transferFee, "burn: amount not cover fees");
            debridge.collectedFees += transferFee;
            _amount -= transferFee;
        }
        wrappedAsset.burn(_amount);
        return _amount;
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _submissionId Submission identifier.
    /// @param _debridgeId Asset identifier.
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
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        isSubmissionUsed[_submissionId] = true;
        require(debridge.chainId != chainId, "mint: is native chain");
        if (_executionFee > 0) {
            IWrappedAsset(debridge.tokenAddress).mint(
                msg.sender,
                _executionFee
            );
            IWrappedAsset(debridge.tokenAddress).mint(callProxy, _amount);
            bool status =
                ICallProxy(callProxy).callERC20(
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
        isSubmissionUsed[_submissionId] = true;
        debridge.balance -= _amount;
        _ensureReserves(debridge, _amount);
        if (debridge.tokenAddress == address(0)) {
            if (_executionFee > 0) {
                payable(msg.sender).transfer(_executionFee);
                bool status =
                    ICallProxy(callProxy).call{value: _amount}(
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
                IERC20(debridge.tokenAddress).safeTransfer(
                    msg.sender,
                    _executionFee
                );
                IERC20(debridge.tokenAddress).safeTransfer(callProxy, _amount);
                bool status =
                    ICallProxy(callProxy).callERC20(
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
        require(
            _signature.length == 65,
            "splitSignature: invalid signature length"
        );
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

    /// @dev Check if transfer to chain is supported.
    /// @param _debridgeId Asset identifier.
    /// @param _chainId Chain identifier.
    function getChainIdSupport(bytes32 _debridgeId, uint256 _chainId)
        public
        view
        returns (ChainSupportInfo memory)
    {
        return getDebridge[_debridgeId].chainSupported[_chainId];
    }
}
