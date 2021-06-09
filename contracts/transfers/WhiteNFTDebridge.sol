// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../interfaces/IWhiteNFTDebridge.sol";
import "../interfaces/IFeeProxy.sol";
import "../interfaces/IDefiController.sol";
import "../interfaces/IWhiteFullAggregator.sol";
import "../interfaces/ICallProxy.sol";
import "../interfaces/IWrappedNFT.sol";
import "../periphery/WrappedNFT.sol";
import "../periphery/Pausable.sol";

abstract contract WhiteNFTDebridge is 
    AccessControl,
    IWhiteNFTDebridge,
    Initializable,
    Pausable
{
    using SafeERC20 for IERC20;
    struct DebridgeInfo {
        address tokenAddress;   // asset address on the current chain
        uint256 chainId;        // native chain id
        uint256 collectedFees;  // total collected fees that can be used to buy Link
        mapping(uint256 => address) owners;
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
    IERC20 public feeToken; // token address of fee
    uint8 public aggregatorVersion; // aggregators count
    uint256[] public chainIds; // list of all supported chain ids
    mapping(bytes32 => DebridgeInfo) public getDebridge; // debridgeId (i.e. hash(native chainId, native tokenAddress)) => token
    mapping(bytes32 => bool) public isSubmissionUsed; // submissionId (i.e. hash( debridgeId, amount, receiver, nonce)) => whether is claimed
    mapping(address => uint256) public getUserNonce; // userAddress => transactions count
    mapping(uint8 => AggregatorInfo) public getOldAggregator; // counter => agrgregator info

    event Sent(
        bytes32 submissionID,
        bytes32 debridgeID,
        uint256 tokenId,
        address receiver,
        uint256 nonce,
        uint256 chainIdTo
    ); // emited once the native NFT is locked to be sent to the other chain
    event Minted(
        bytes32 submissionId,
        uint256 tokenId,
        address receiver,
        bytes32 debridgeId
    ); // emited once the wrapped token is minted on the current chain
    event Burnt(
        bytes32 submissionId,
        bytes32 debridgeId,
        uint256 tokenId,
        address receiver,
        uint256 nonce,
        uint256 chainIdTo
    ); // emited once the wrapped token is sent to the contract
    event Claimed(
        bytes32 submissionId,
        uint256 tokenId,
        address receiver,
        bytes32 debridgeId
    ); // emited once the tokens are withdrawn on native chain
    event PairAdded(
        bytes32 indexed debridgeId,
        address indexed tokenAddress,
        uint256 indexed chainId
    ); // emited when new asset is supported
    event ChainSupportAdded(
        bytes32 indexed debridgeId,
        uint256 indexed chainId
    ); // emited when the asset is allowed to be spent on other chains
    event ChainSupportRemoved(
        bytes32 indexed debridgeId,
        uint256 indexed chainId
    );
    event ChainsSupportUpdated(uint256[] chainIds); // emited when the supported assets are updated
    event CallProxyUpdated(address callProxy); // emited when the new call proxy set
    event AutoRequestExecuted(bytes32 submissionId, bool success); // emited when the new call proxy set

    modifier onlyAggregator {
        require(aggregator == msg.sender, "onlyAggregator: bad role");
        _;
    }

    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "onlyAdmin: bad role");
        _;
    }

    /// @dev Constructor that initializes the most important configurations.
    /// @param _callProxy proxy address
    /// @param _aggregator Submission aggregator address.
    function _initialize(
        address _aggregator,
        address _callProxy,
        IERC20 _feeToken
    ) internal {
        uint256 cid;
        assembly {
            cid := chainid()
        }
        chainId = cid;

        aggregator = _aggregator;
        callProxy = _callProxy;
        feeToken = _feeToken;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @dev Locks asset on the chain and enables minting on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _tokenId Id of token to be transfered
    /// @param _chainIdTo Chain id of the target chain.
    function send(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _tokenId,
        uint256 _chainIdTo
    ) external payable override whenNotPaused() {
        _send(_debridgeId, _tokenId, _chainIdTo);
        uint256 nonce = getUserNonce[_receiver];
        bytes32 sentId = 
            getSubmisionId(
                _debridgeId,
                chainId,
                _chainIdTo,
                _tokenId,
                _receiver,
                nonce
            );
        emit Sent(sentId, _debridgeId, _tokenId, _receiver, nonce, _chainIdTo);
        getUserNonce[_receiver] ++;
    }

    /// @dev Burns wrapped asset and allowss to claim it on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _tokenId Id of token to be transfered
    /// @param _chainIdTo Chain id of the target chain.
    function burn(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _tokenId,
        uint256 _chainIdTo,
        uint256 _deadline,
        bytes memory _signature
    ) external override whenNotPaused(){
        _burn(_debridgeId, _tokenId, _chainIdTo, _deadline, _signature);
        uint256 nonce = getUserNonce[_receiver];
        bytes32 burntId =
            getSubmisionId(
                _debridgeId,
                chainId,
                _chainIdTo,
                _tokenId,
                _receiver,
                nonce
            );
        emit Burnt(burntId, _debridgeId, _tokenId, _receiver, nonce, _chainIdTo);
        getUserNonce[_receiver]++;
    }

    /* ADMIN */

    /// @dev Add support for the asset on the current chain.
    /// @param _tokenAddress Address of the asset on the current chain.
    /// @param _supportedChainIds Chain ids where native token of the current chain can be wrapped.
    function addNativeAsset(
        address _tokenAddress,
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo
    ) external override onlyAdmin() {
        bytes32 debridgeId = getDebridgeId(chainId, _tokenAddress);
        _addAsset(
            debridgeId,
            _tokenAddress,
            chainId,
            _supportedChainIds,
            _chainSupportInfo
        );
    }

    /// @dev Add support for the asset from the other chain, deploy new wrapped asset.
    /// @param _tokenAddress Address of the asset on the other chain.
    /// @param _wrappedAssetAddress Wrapped asset address.
    /// @param _chainId Current chain id.
    /// @param _supportedChainIds Chain ids where the token of the current chain can be transfered.
    function addExternalAsset(
        address _tokenAddress,
        address _wrappedAssetAddress,
        uint256 _chainId,
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo
    ) external override onlyAdmin() {
        bytes32 debridgeId = getDebridgeId(_chainId, _tokenAddress);
        _addAsset(
            debridgeId,
            _wrappedAssetAddress,
            _chainId,
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

    /// @dev Set wrapped native asset address.
    /// @param _feeToken Weth address.
    function setFeeToken(IERC20 _feeToken) external override onlyAdmin() {
        feeToken = _feeToken;
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
        feeToken.safeTransfer(_receiver, _amount);
    }

    /* Internal */

    /// @dev Add support for the asset.
    /// @param _debridgeId Asset identifier.
    /// @param _tokenAddress Address of the asset on the other chain.
    /// @param _chainId Current chain id.
    /// @param _supportedChainIds Chain ids where the token of the current chain can be transfered.
    /// @param _chainSupportInfo Cahin support info.
    function _addAsset(
        bytes32 _debridgeId,
        address _tokenAddress,
        uint256 _chainId,
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
        uint256 supportedChainId;
        for (uint256 i = 0; i < _supportedChainIds.length; i++) {
            supportedChainId = _supportedChainIds[i];
            debridge.chainSupported[supportedChainId] = _chainSupportInfo[i];
            emit ChainSupportAdded(_debridgeId, supportedChainId);
        }
        emit PairAdded(
            _debridgeId,
            _tokenAddress,
            _chainId
        );
    }

    /// @dev Locks asset on the chain and enables minting on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _tokenId id to token to be transfered (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function _send(
        bytes32 _debridgeId,
        uint256 _tokenId,
        uint256 _chainIdTo
    ) internal {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        ChainSupportInfo memory chainSupportInfo =
            debridge.chainSupported[_chainIdTo];
        require(debridge.chainId == chainId, "send: not native chain");
        require(chainSupportInfo.isSupported, "send: wrong targed chain");
        IWrappedNFT(debridge.tokenAddress).transferFrom(
            msg.sender,
            address(this),
            _tokenId
        );
        debridge.owners[_tokenId] = IWrappedNFT(debridge.tokenAddress).ownerOf(_tokenId);
        uint256 transferFee = chainSupportInfo.fixedFee;
        if (transferFee > 0) {
            debridge.collectedFees += transferFee;
            feeToken.safeTransferFrom(msg.sender, address(this), transferFee);
        }
    }

    /// @dev Burns wrapped asset and allowss to claim it on the other chain.
    /// @param _debridgeId Asset identifier.
    /// @param _tokenId id of token to be tranfered (note: the fee can be applyed).
    /// @param _chainIdTo Chain id of the target chain.
    function _burn(
        bytes32 _debridgeId,
        uint256 _tokenId,
        uint256 _chainIdTo,
        uint256 _deadline,
        bytes memory _signature
    ) internal {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        ChainSupportInfo memory chainSupportInfo =
            debridge.chainSupported[_chainIdTo];
        require(debridge.chainId != chainId, "burn: native asset");
        require(chainSupportInfo.isSupported, "burn: wrong targed chain");
        require(debridge.owners[_tokenId] != address(0), "burn: tokenId not exist");
        IWrappedNFT wrappedNft = IWrappedNFT(debridge.tokenAddress);
        if (_signature.length > 0) {
            (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);
            wrappedNft.permit(
                address(this),
                _tokenId,
                _deadline,
                v,
                r,
                s
            );
        }
        wrappedNft.transferFrom(msg.sender, address(this), _tokenId);
        delete debridge.owners[_tokenId];
        uint256 transferFee = chainSupportInfo.fixedFee;
        if (transferFee > 0) {
            debridge.collectedFees += transferFee;
            feeToken.safeTransferFrom(msg.sender, address(this), transferFee);
        }
        wrappedNft.burn(_tokenId);
    }

    /// @dev Mints wrapped asset on the current chain.
    /// @param _submissionId Submission identifier.
    /// @param _debridgeId Asset identifier.
    /// @param _receiver Receiver address.
    /// @param _tokenId id of tken to be transfered.
    function _mint(
        bytes32 _submissionId,
        bytes32 _debridgeId,
        address _receiver,
        uint256 _tokenId
    ) internal {
        require(!isSubmissionUsed[_submissionId], "mint: already used");
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        isSubmissionUsed[_submissionId] = true;
        require(debridge.chainId != chainId, "mint: is native chain");

        IWrappedNFT(debridge.tokenAddress).mint(_receiver, _tokenId);
        debridge.owners[_tokenId] = _receiver;
        emit Minted(_submissionId, _tokenId, _receiver, _debridgeId);
    }

    /**
     * @dev Unlock the asset on the current chain and transfer to receiver
     * @param _debridgeId Asset identifier
     * @param _receiver Receiver address
     * @param _tokenId Id of token to be transferred.
     */
    function _claim(
        bytes32 _submissionId,
        bytes32 _debridgeId,
        address _receiver,
        uint256 _tokenId
    ) internal {
        DebridgeInfo storage debridge = getDebridge[_debridgeId];
        require(debridge.chainId == chainId, "claim: wrong target chain");
        require(!isSubmissionUsed[_submissionId], "claim: already used");
        isSubmissionUsed[_submissionId] = true;
        delete debridge.owners[_tokenId];
        IWrappedNFT wrappedNft = IWrappedNFT(debridge.tokenAddress);
        wrappedNft.transferFrom(address(this), _receiver, _tokenId);
        emit Claimed(_submissionId, _tokenId, _receiver, _debridgeId);
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
    /// @param _tokenId Id of token to be transfered
    /// @param _nonce Submission id.
    function getSubmisionId(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        uint256 _chainIdTo,
        uint256 _tokenId,
        address _receiver,
        uint256 _nonce
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _debridgeId,
                    _chainIdFrom,
                    _chainIdTo,
                    _tokenId,
                    _receiver,
                    _nonce
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

    /// @dev get owner of token
    /// @param _debridgeId Asset identifier.
    /// @param _tokenId Chain identifier.
    function getOwnerOfToken(bytes32 _debridgeId, uint256 _tokenId)
        public
        view
        returns (address)
    {
        return getDebridge[_debridgeId].owners[_tokenId];
    }
}