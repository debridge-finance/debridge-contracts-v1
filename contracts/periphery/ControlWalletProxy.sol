// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "../interfaces/ICallProxy.sol";
import "../transfers/DeBridgeGate.sol";

contract ControlWalletProxy is Initializable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /* ========== STATE VARIABLES ========== */

    DeBridgeGate public deBridgeGate;
    uint256 public controllingAddressesCount;
    // chainIdFrom => list of addresses that can control this contract
    mapping(uint256 => mapping(bytes => bool)) public controlParams;

    /* ========== ERRORS ========== */

    error CallProxyBadRole();
    error NativeSenderBadRole(bytes nativeSender, uint256 chainIdFrom);
    error ExternalCallFailed();

    error AddressAlreadyAdded();
    error RemovingMissingAddress();
    error RemovingLastAddress();

    /* ========== EVENTS ========== */

    // emitted when controlling address updated
    event ControllingAddressUpdated(
        bytes nativeSender,
        uint256 chainIdFrom,
        bool enabled
    );

    /* ========== MODIFIERS ========== */

    modifier onlyCallProxyFromControllingAddress() {
        ICallProxy callProxy = ICallProxy(deBridgeGate.callProxy());
        if (address(callProxy) != msg.sender) revert CallProxyBadRole();

        bytes memory nativeSender = callProxy.submissionNativeSender();
        uint256 chainIdFrom = callProxy.submissionChainIdFrom();
        if(!controlParams[chainIdFrom][nativeSender]) {
            revert NativeSenderBadRole(nativeSender, chainIdFrom);
        }
        _;
    }

    /* ========== CONSTRUCTOR  ========== */

    function initialize(
        DeBridgeGate _deBridgeGate,
        bytes memory _nativeSender,
        uint256 _chainIdFrom
    ) public initializer {
        deBridgeGate = _deBridgeGate;
        controllingAddressesCount++;
        controlParams[_chainIdFrom][_nativeSender] = true;
    }

    function call(
        address token,
        uint256 amount,
        address destination,
        bytes memory data
    ) external payable onlyCallProxyFromControllingAddress returns (bool _result) {
        if (token != address(0)) {
            IERC20Upgradeable(token).safeApprove(destination, 0);
            IERC20Upgradeable(token).safeApprove(destination, amount);
        }

        _result = externalCall(
            destination,
            amount,
            data
        );

        if (!_result) {
            revert ExternalCallFailed();
        }
    }

    function addControllingAddress(
        bytes memory _nativeSender,
        uint256 _chainIdFrom
    ) external onlyCallProxyFromControllingAddress {
        if(controlParams[_chainIdFrom][_nativeSender]) {
            revert AddressAlreadyAdded();
        }

        controllingAddressesCount++;

        controlParams[_chainIdFrom][_nativeSender] = true;

        emit ControllingAddressUpdated(_nativeSender, _chainIdFrom, true);
    }

    function removeControllingAddress(
        bytes memory _nativeSender,
        uint256 _chainIdFrom
    ) external onlyCallProxyFromControllingAddress {
        if(!controlParams[_chainIdFrom][_nativeSender]) {
            revert RemovingMissingAddress();
        }

        if (controllingAddressesCount == 1){
            revert RemovingLastAddress();
        }

        controllingAddressesCount--;

        controlParams[_chainIdFrom][_nativeSender] = false;

        emit ControllingAddressUpdated(_nativeSender, _chainIdFrom, false);
    }

    // ============ VIEWS ============

    function isControllingAddress(
        bytes memory _nativeSender,
        uint256 _chainIdFrom
    ) external view returns (bool) {
        return controlParams[_chainIdFrom][_nativeSender];
    }

    // ============ INTERNALS ============

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

    // ============ Version Control ============
    function version() external pure returns (uint256) {
        return 101; // 1.0.1
    }
}
