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
import "../interfaces/IWhiteAggregator.sol";
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
        uint256 fixedFee; // transfer fee rate
        uint256 transferFee; // transfer fee rate
        uint256 collectedFees; // total collected fees that can be used to buy LINK
        uint256 balance; // total locked assets
        uint256 minReserves; // minimal hot reserves
        mapping(uint256 => bool) isSupported; // wheter the chain for the asset is supported
    }

    struct AggregatorInfo {
        address aggregator; // aggregator address
        bool isValid; // if is still valid
    }

    uint256 public constant DENOMINATOR = 1e18; // accuacy multiplyer
    uint256 public chainId; // current chain id
    address public aggregator; // chainlink aggregator address
    uint8 public aggregatorVersion; // aggregators number
    uint256[] public chainIds; // list of all supported chain ids
    IDefiController public defiController; // proxy to use the locked assets in Defi protocols
    mapping(bytes32 => DebridgeInfo) public getDebridge; // debridgeId (i.e. hash(native chainId, native tokenAddress)) => token
    mapping(bytes32 => bool) public isSubmissionUsed; // submissionId (i.e. hash( debridgeId, amount, receiver, nonce)) => whether is claimed
    mapping(address => uint256) public getUserNonce; // userAddress => transactions count
    mapping(bytes32 => uint256) public getClaimFee; // debridgeId => auto claim fee
    mapping(uint8 => AggregatorInfo) public getOldAggregator; // counter => agrgregator info

    event Sent(
        bytes32 submissionId,
        bytes32 debridgeId,
        uint256 amount,
        address receiver,
        uint256 nonce,
        uint256 chainIdTo
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
        uint256 fixedFee,
        uint256 transferFee,
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
    /// @param _fixedFee Fixed transfer fee.
    /// @param _transferFee Transfer fee rate.
    /// @param _minReserves Minimal reserve ratio.
    /// @param _aggregator Submission aggregator address.
    /// @param _supportedChainIds Chain ids where native token of the current chain can be wrapped.
    function _initialize(
        uint256 _minAmount,
        uint256 _fixedFee,
        uint256 _transferFee,
        uint256 _minReserves,
        address _aggregator,
        uint256[] memory _supportedChainIds,
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
            _fixedFee,
            _transferFee,
            _minReserves,
            _supportedChainIds
        );
        aggregator = _aggregator;
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
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        require(debridge.chainId == chainId, "send: not native chain");
        require(debridge.isSupported[_chainIdTo], "send: wrong targed chain");
        require(_amount >= debridge.minAmount, "send: amount too low");
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
            debridge.fixedFee + (_amount * debridge.transferFee) / DENOMINATOR;
        if (transferFee > 0) {
            require(_amount >= transferFee, "send: amount not cover fees");
            debridge.collectedFees += transferFee;
            _amount -= transferFee;
        }
        debridge.balance += _amount;
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
        uint256 _chainIdTo
    ) external override whenNotPaused() {
        _burn(_debridgeId, _amount, _chainIdTo);
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

    /// @dev Burns wrapped asset and allowss to claim it on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function autoBurn(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        bytes memory _data
    ) external whenNotPaused() {
        uint256 claimFee = getClaimFee[_debridgeId];
        require(claimFee != 0, "autoBurn: not supported");
        _burn(_debridgeId, _amount, _chainIdTo);
        uint256 nonce = getUserNonce[_receiver];
        bytes32 burntId =
            getAutoSubmisionId(
                _debridgeId,
                chainId,
                _chainIdTo,
                _amount,
                _receiver,
                nonce,
                claimFee,
                _data
            );
        emit AutoBurnt(
            burntId,
            _debridgeId,
            _amount,
            _receiver,
            nonce,
            _chainIdTo,
            claimFee,
            _data
        );
        getUserNonce[_receiver]++;
    }

    /* ADMIN */

    /// @dev Add support for the asset on the current chain.
    /// @param _tokenAddress Address of the asset on the current chain.
    /// @param _minAmount Minimal amount of current chain token to be wrapped.
    /// @param _fixedFee Transfer fee rate.
    /// @param _transferFee Transfer fee rate.
    /// @param _minReserves Minimal reserve ration.
    /// @param _supportedChainIds Chain ids where native token of the current chain can be wrapped.
    function addNativeAsset(
        address _tokenAddress,
        uint256 _minAmount,
        uint256 _fixedFee,
        uint256 _transferFee,
        uint256 _minReserves,
        uint256[] memory _supportedChainIds
    ) external override onlyAdmin() {
        bytes32 debridgeId = getDebridgeId(chainId, _tokenAddress);
        _addAsset(
            debridgeId,
            _tokenAddress,
            chainId,
            _minAmount,
            _fixedFee,
            _transferFee,
            _minReserves,
            _supportedChainIds
        );
    }

    /// @dev Add support for the asset from the other chain, deploy new wrapped asset.
    /// @param _tokenAddress Address of the asset on the other chain.
    /// @param _chainId Current chain id.
    /// @param _minAmount Minimal amount of the asset to be wrapped.
    /// @param _fixedFee Transfer fee rate.
    /// @param _transferFee Transfer fee rate.
    /// @param _minReserves Minimal reserve ration.
    /// @param _supportedChainIds Chain ids where the token of the current chain can be transfered.
    /// @param _wrappedAssetAddress Wrapped asset address.
    function addExternalAsset(
        address _tokenAddress,
        address _wrappedAssetAddress,
        uint256 _chainId,
        uint256 _minAmount,
        uint256 _fixedFee,
        uint256 _transferFee,
        uint256 _minReserves,
        uint256[] memory _supportedChainIds
    ) external override onlyAdmin() {
        bytes32 debridgeId = getDebridgeId(_chainId, _tokenAddress);
        _addAsset(
            debridgeId,
            _wrappedAssetAddress,
            _chainId,
            _minAmount,
            _fixedFee,
            _transferFee,
            _minReserves,
            _supportedChainIds
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
        debridge.isSupported[_chainId] = _isSupported;
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

    /// @dev Add support for the asset.
    /// @param _debridgeId Asset identifier.
    /// @param _minAmount Minimal amount of the asset to be wrapped.
    /// @param _fixedFee Fixed transfer fee rate.
    /// @param _transferFee Transfer fee rate.
    /// @param _minReserves Minimal reserve ration.
    function updateAsset(
        bytes32 _debridgeId,
        uint256 _minAmount,
        uint256 _fixedFee,
        uint256 _transferFee,
        uint256 _minReserves
    ) external onlyAdmin() {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        debridge.minAmount = _minAmount;
        debridge.fixedFee = _fixedFee;
        debridge.transferFee = _transferFee;
        debridge.minReserves = _minReserves;
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
    /// @param _fixedFee Fixed transfer fee rate.
    /// @param _transferFee Transfer fee rate.
    /// @param _minReserves Minimal reserve ration.
    /// @param _supportedChainIds Chain ids where the token of the current chain can be transfered.
    function _addAsset(
        bytes32 _debridgeId,
        address _tokenAddress,
        uint256 _chainId,
        uint256 _minAmount,
        uint256 _fixedFee,
        uint256 _transferFee,
        uint256 _minReserves,
        uint256[] memory _supportedChainIds
    ) internal {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        debridge.tokenAddress = _tokenAddress;
        debridge.chainId = _chainId;
        debridge.minAmount = _minAmount;
        debridge.fixedFee = _fixedFee;
        debridge.transferFee = _transferFee;
        debridge.minReserves = _minReserves;
        uint256 supportedChainId;
        for (uint256 i = 0; i < _supportedChainIds.length; i++) {
            supportedChainId = _supportedChainIds[i];
            debridge.isSupported[supportedChainId] = true;
            emit ChainSupportAdded(_debridgeId, supportedChainId);
        }
        emit PairAdded(
            _debridgeId,
            _tokenAddress,
            _chainId,
            _minAmount,
            _fixedFee,
            _transferFee,
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

    /// @dev Burns wrapped asset and allowss to claim it on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function _burn(
        bytes32 _debridgeId,
        uint256 _amount,
        uint256 _chainIdTo
    ) internal {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        require(debridge.chainId != chainId, "burn: native asset");
        require(debridge.isSupported[_chainIdTo], "burn: wrong targed chain");
        require(
            _amount >= debridge.minAmount,
            "burn: only native assets are claimable"
        );
        IWrappedAsset wrappedAsset = IWrappedAsset(debridge.tokenAddress);
        wrappedAsset.transferFrom(msg.sender, address(this), _amount);
        uint256 transferFee =
            debridge.fixedFee + (_amount * debridge.transferFee) / DENOMINATOR;
        if (transferFee > 0) {
            require(_amount >= transferFee, "burn: amount not cover fees");
            debridge.collectedFees += transferFee;
            _amount -= transferFee;
        }
        wrappedAsset.burn(_amount);
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _mintId Submission identifier.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: without applyed fee).
    function _mint(
        bytes32 _mintId,
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount
    ) internal {
        require(!isSubmissionUsed[_mintId], "mint: already used");
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        isSubmissionUsed[_mintId] = true;
        require(debridge.chainId != chainId, "mint: is native chain");
        IWrappedAsset(debridge.tokenAddress).mint(_receiver, _amount);
        emit Minted(_mintId, _amount, _receiver, _debridgeId);
    }

    /// @dev Unlock the asset on the current chain and transfer to receiver.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    function _claim(
        bytes32 _burntId,
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount
    ) internal {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        require(debridge.chainId == chainId, "claim: wrong target chain");
        require(!isSubmissionUsed[_burntId], "claim: already used");
        isSubmissionUsed[_burntId] = true;
        debridge.balance -= _amount;
        _ensureReserves(debridge, _amount);
        if (debridge.tokenAddress == address(0)) {
            payable(_receiver).transfer(_amount);
        } else {
            IERC20(debridge.tokenAddress).safeTransfer(_receiver, _amount);
        }
        emit Claimed(_burntId, _amount, _receiver, _debridgeId);
    }

    /* VIEW */

    /// @dev Check the balance.
    /// @param _tokenAddress Address of the asset on the other chain.
    function getBalance(address _tokenAddress) public view returns (uint256) {
        if (_tokenAddress == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(_tokenAddress).balanceOf(address(this));
        }
    }

    /// @dev Calculates asset identifier.
    /// @param _tokenAddress Address of the asset on the other chain.
    /// @param _chainId Current chain id.
    function getDebridgeId(uint256 _chainId, address _tokenAddress)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(_chainId, _tokenAddress));
    }

    /// @dev Calculate submission id.
    /// @param _debridgeId Asset identifier.
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
    /// @param _receiver Receiver address.
    /// @param _amount Amount of the transfered asset (note: the fee can be applyed).
    /// @param _nonce Submission id.
    function getAutoSubmisionId(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        uint256 _chainIdTo,
        uint256 _amount,
        address _receiver,
        uint256 _nonce,
        uint256 _claimFee,
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
                    _claimFee,
                    _data
                )
            );
    }

    /// @dev Check if transfer to chain is supported.
    /// @param _debridgeId Asset identifier.
    /// @param _chainId Chain identifier.
    function isChainIdSupported(bytes32 _debridgeId, uint256 _chainId)
        public
        view
        returns (bool)
    {
        return getDebridge[_debridgeId].isSupported[_chainId];
    }
}
