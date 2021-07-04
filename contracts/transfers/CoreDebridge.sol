// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../interfaces/IDebridge.sol";
import "../interfaces/IFeeProxy.sol";
import "../interfaces/IWETH.sol";
import "../interfaces/IDefiController.sol";
import "../interfaces/IFullAggregator.sol";
import "../interfaces/ICallProxy.sol";
import "../periphery/WrappedAsset.sol";
import "../periphery/Pausable.sol";

abstract contract CoreDebridge is AccessControl, Initializable, Pausable {
    using Address for address;

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
        address fallbackAddress,
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
        address fallbackAddress,
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

    /* INTERNAL */

    function _safeTransfer(
        IERC20 token,
        address to,
        uint256 value
    ) internal {
        _callOptionalReturn(
            token,
            abi.encodeWithSelector(token.transfer.selector, to, value)
        );
    }

    function _safeTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 value
    ) internal {
        _callOptionalReturn(
            token,
            abi.encodeWithSelector(token.transferFrom.selector, from, to, value)
        );
    }

    /**
     * @dev Imitates a Solidity high-level call (i.e. a regular function call to a contract), relaxing the requirement
     * on the return value: the return value is optional (but if data is returned, it must not be false).
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     */
    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        // We need to perform a low level call here, to bypass Solidity's return data size checking mechanism, since
        // we're implementing it ourselves. We use {Address.functionCall} to perform this call, which verifies that
        // the target address contains contract code and also asserts for success in the low-level call.

        bytes memory returndata = address(token).functionCall(
            data,
            "SafeERC20: low-level call failed"
        );
        if (returndata.length > 0) {
            // Return data is optional
            // solhint-disable-next-line max-line-length
            require(
                abi.decode(returndata, (bool)),
                "SafeERC20: ERC20 operation did not succeed"
            );
        }
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
}
