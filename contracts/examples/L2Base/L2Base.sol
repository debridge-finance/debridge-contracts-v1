// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "../../interfaces/ICallProxy.sol";
import "../../interfaces/IDeBridgeGate.sol";
import "../../libraries/Flags.sol";

abstract contract L2Base is Initializable, AccessControlUpgradeable, PausableUpgradeable {
    using AddressUpgradeable for address payable;

    /* ========== STATE VARIABLES ========== */

    IDeBridgeGate public deBridgeGate;

    // chainId => (address => isControlling)
    /// @dev Maps chainId and address on that chain to bool that defines if the address is controlling
    mapping(uint256 => mapping(bytes => bool)) public isAddressFromChainIdControlling;
    /// @dev Maps chainId to address on that chain
    mapping(uint256 => address) public chainIdToBridgeAddress;


    /* ========== ERRORS ========== */

    error CallProxyBadRole();
    error NativeSenderBadRole(bytes nativeSender, uint256 chainIdFrom);

    error AddressAlreadyAdded();
    error RemovingMissingAddress();
    error AdminBadRole();

    error ChainToIsNotSupported();

    /* ========== EVENTS ========== */

    // emitted when controlling address updated
    event ControllingAddressUpdated(
        bytes nativeSender,
        uint256 chainIdFrom,
        bool enabled
    );

    /* ========== MODIFIERS ========== */

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert AdminBadRole();
        _;
    }

    modifier onlyControllingAddress() {
        ICallProxy callProxy = ICallProxy(deBridgeGate.callProxy());
        if (address(callProxy) != msg.sender) revert CallProxyBadRole();

        bytes memory nativeSender = callProxy.submissionNativeSender();
        uint256 chainIdFrom = callProxy.submissionChainIdFrom();
        if(!isAddressFromChainIdControlling[chainIdFrom][nativeSender]) {
            revert NativeSenderBadRole(nativeSender, chainIdFrom);
        }
        _;
    }

    /* ========== CONSTRUCTOR  ========== */

    function initialize(
        IDeBridgeGate _deBridgeGate
    ) public initializer {
        deBridgeGate = _deBridgeGate;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @param _chainIdTo Receiving chain id
    /// @param _receiver Address to call on receiving chain
    /// @param _data Data to send to _receiver
    /// @param _fallback Address to call in case call to _receiver reverts
    function send(
        uint256 _chainIdTo,
        address _receiver,
        bytes calldata _data,
        address _fallback
    ) external virtual payable;
//    whenNotPaused
//    {
//     IDeBridgeGate.SubmissionAutoParamsTo memory autoParams;
//     autoParams.flags = 2**Flags.REVERT_IF_EXTERNAL_FAIL + 2**Flags.PROXY_WITH_SENDER;
//     autoParams.executionFee = 1 ether;
//     autoParams.fallbackAddress = abi.encodePacked(_fallback);
//     autoParams.data = abi.encodeWithSignature(
//         "claim(address,bytes calldata)",
//         _receiver,
//         _data
//     );
//
//     address bridgeAddressTo = chainIdToBridgeAddress[_chainIdTo];
//     if (bridgeAddressTo == address(0)) {
//         revert ChainToIsNotSupported();
//     }
//
//
//     deBridgeGate.send{value: msg.value}(
//         address(0),
//         msg.value,
//         _chainIdTo,
//         abi.encodePacked(bridgeAddressTo),
//         "",
//         false,
//         0,
//         abi.encode(autoParams)
//     );
//    }

    /// @param _receiver Address to call
    /// @param _data Data to send to _receiver
    function claim (
        address _receiver,
        bytes calldata _data
    ) external payable virtual returns (bool);
//    onlyControllingAddress whenNotPaused
//    {
//         (bool result,) = _receiver.call{value: msg.value}(_data);
//         return result;
//    }


    function addControllingAddress(
        bytes memory _nativeSender,
        uint256 _chainIdFrom
    ) external onlyAdmin {
        if(isAddressFromChainIdControlling[_chainIdFrom][_nativeSender]) {
            revert AddressAlreadyAdded();
        }

        isAddressFromChainIdControlling[_chainIdFrom][_nativeSender] = true;

        emit ControllingAddressUpdated(_nativeSender, _chainIdFrom, true);
    }

    function removeControllingAddress(
        bytes memory _nativeSender,
        uint256 _chainIdFrom
    ) external onlyAdmin {
        if(!isAddressFromChainIdControlling[_chainIdFrom][_nativeSender]) {
            revert RemovingMissingAddress();
        }

        isAddressFromChainIdControlling[_chainIdFrom][_nativeSender] = false;

        emit ControllingAddressUpdated(_nativeSender, _chainIdFrom, false);
    }


    /// @dev Stop all transfers.
    function pause() external onlyAdmin {
        _pause();
    }

    /// @dev Allow transfers.
    function unpause() external onlyAdmin {
        _unpause();
    }

    // ============ VIEWS ============

    /// @dev Calculates asset identifier.
    /// @param _chainId Current chain id.
    /// @param _tokenAddress Address of the asset on the other chain.
    function getDebridgeId(uint256 _chainId, address _tokenAddress) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_chainId, _tokenAddress));
    }

    function isControllingAddress(
        bytes memory _nativeSender,
        uint256 _chainIdFrom
    ) external view returns (bool) {
        return isAddressFromChainIdControlling[_chainIdFrom][_nativeSender];
    }

    /// @dev Get current chain id
    function getChainId() public view virtual returns (uint256 cid) {
        assembly {
            cid := chainid()
        }
    }
    // ============ Version Control ============
    function version() external pure returns (uint256) {
        return 101; // 1.0.1
    }
}
