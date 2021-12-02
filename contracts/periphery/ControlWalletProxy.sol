// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../interfaces/ICallProxy.sol";

contract ControlWalletProxy is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /* ========== STATE VARIABLES ========== */

    ICallProxy public callProxy;
    // chainIdFrom => list of addresses that can control this contract
    mapping(uint256 => mapping(bytes => bool)) public controlParams;

    /* ========== ERRORS ========== */

    error AdminBadRole();
    error CallProxyBadRole();
    error NativeSenderBadRole(bytes nativeSender, uint256 chainIdFrom);
    error ExternalCallFailed();

    /* ========== EVENTS ========== */

    // emited when the new call proxy set
    event CallProxyUpdated(address callProxy);

    // emited when controlling address updated
    event ControlingAddressUpdated(
        bytes nativeSender,
        uint256 chainIdFrom,
        bool enabled
    );

    /* ========== MODIFIERS ========== */

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert AdminBadRole();
        _;
    }

    modifier onlyCallProxy() {
        if (address(callProxy) != msg.sender) revert CallProxyBadRole();
        _;
    }

    /* ========== CONSTRUCTOR  ========== */

    function initialize(ICallProxy _callProxy) public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        callProxy = _callProxy;
    }

    function call(
        address destination,
        bytes memory data
    ) external payable onlyCallProxy whenNotPaused returns (bool _result) {
        bytes memory nativeSender = callProxy.submissionNativeSender();
        uint256 chainIdFrom = callProxy.submissionChainIdFrom();

        if(!controlParams[chainIdFrom][nativeSender]) {
            revert NativeSenderBadRole(nativeSender, chainIdFrom);
        }

        uint256 amount = address(this).balance;
        _result = externalCall(
            destination,
            amount,
            data
        );

        if (!_result) {
            revert ExternalCallFailed();
        }
    }


    //gnosis
    //https://github.com/gnosis/MultiSigWallet/blob/ca981359cf5acd6a1f9db18e44777e45027df5e0/contracts/MultiSigWallet.sol#L244-L261

    function externalCall(
        address destination,
        uint256 value,
        bytes memory data
    ) internal returns (bool result) {
        uint256 dataLength = data.length;
        assembly {
            let x := mload(0x40) // "Allocate" memory for output (0x40 is where "free memory" pointer is stored by convention)
            let d := add(data, 32) // First 32 bytes are the padded length of data, so exclude that
            result := call(
                sub(gas(), 34710), // 34710 is the value that solidity is currently emitting
                // It includes callGas (700) + callVeryLow (3, to pay for SUB) + callValueTransferGas (9000) +
                // callNewAccountGas (25000, in case the destination address does not exist and needs creating)
                destination,
                value,
                d,
                dataLength, // Size of the input (in bytes) - this is what fixes the padding problem
                x,
                0 // Output is ignored, therefore the output size is zero
            )
        }
    }

    /* ========== ADMIN ========== */

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    /// @dev Set proxy address.
    /// @param _callProxy Address of the proxy that executes external calls.
    function setCallProxy(ICallProxy _callProxy) external onlyAdmin {
        callProxy = _callProxy;
        emit CallProxyUpdated(address(_callProxy));
    }

    function setControlingAddress(
        bytes memory _nativeSender,
        uint256 _chainIdFrom,
        bool _enabled
    ) external onlyAdmin {
        controlParams[_chainIdFrom][_nativeSender] = _enabled;
        emit ControlingAddressUpdated(_nativeSender, _chainIdFrom, _enabled);
    }

    // ============ VIEWS ============

    function getControlingAddress(
        bytes memory _nativeSender,
        uint256 _chainIdFrom
    ) external view returns (bool) {
        return controlParams[_chainIdFrom][_nativeSender];
    }

    // ============ Version Control ============
    function version() external pure returns (uint256) {
        return 101; // 1.0.1
    }
}
