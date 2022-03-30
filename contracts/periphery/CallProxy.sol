// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "../interfaces/ICallProxy.sol";
import "../libraries/Flags.sol";
import "../libraries/BytesLib.sol";

/// @dev Proxy to execute the other contract calls.
/// This contract is used when a user requests transfer with specific call of other contract.
contract CallProxy is Initializable, AccessControlUpgradeable, ICallProxy {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using Flags for uint256;

    /* ========== STATE VARIABLES ========== */
    /// @dev Role allowed to withdraw fee
    bytes32 public constant DEBRIDGE_GATE_ROLE = keccak256("DEBRIDGE_GATE_ROLE");

    /// @dev Value for lock variable when function is not entered
    uint256 private constant _NOT_LOCKED = 1;
    /// @dev Value for lock variable when function is entered
    uint256 private constant _LOCKED = 2;

    /// @dev Chain from which the current submission is received
    uint256 public override submissionChainIdFrom;
    /// @dev Native sender of the current submission
    bytes public override submissionNativeSender;

    uint256 private _lock;

    /* ========== ERRORS ========== */

    error DeBridgeGateBadRole();

    error ExternalCallFailed();
    error NotEnoughSafeTxGas();
    error CallFailed();
    error Locked();

    /* ========== MODIFIERS ========== */

    modifier onlyGateRole() {
        if (!hasRole(DEBRIDGE_GATE_ROLE, msg.sender)) revert DeBridgeGateBadRole();
        _;
    }

    /// @dev lock
    modifier lock() {
        if (_lock == _LOCKED) revert Locked();
        _lock = _LOCKED;
        _;
        _lock = _NOT_LOCKED;
    }

    /* ========== CONSTRUCTOR  ========== */

    function initialize() public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @inheritdoc ICallProxy
    function call(
        address _reserveAddress,
        address _receiver,
        bytes memory _data,
        uint256 _flags,
        bytes memory _nativeSender,
        uint256 _chainIdFrom
    ) external payable override onlyGateRole lock returns (bool _result) {
        uint256 amount = address(this).balance;

        _result = externalCall(
            _receiver,
            amount,
            _data,
            _nativeSender,
            _chainIdFrom,
            _flags
        );

        if (!_result && _flags.getFlag(Flags.REVERT_IF_EXTERNAL_FAIL)) {
            revert ExternalCallFailed();
        }

        amount = address(this).balance;
        if (amount > 0) {
            (bool success, ) = _reserveAddress.call{value: amount}(new bytes(0));
            if (!success) revert CallFailed();
        }
    }

    /// @inheritdoc ICallProxy
    function callERC20(
        address _token,
        address _reserveAddress,
        address _receiver,
        bytes memory _data,
        uint256 _flags,
        bytes memory _nativeSender,
        uint256 _chainIdFrom
    ) external override onlyGateRole lock returns (bool _result) {
        uint256 amount = IERC20Upgradeable(_token).balanceOf(address(this));
        IERC20Upgradeable(_token).approve(_receiver, amount);

        _result = externalCall(
            _receiver,
            0,
            _data,
            _nativeSender,
            _chainIdFrom,
            _flags
        );

        amount = IERC20Upgradeable(_token).balanceOf(address(this));

        if (!_result &&_flags.getFlag(Flags.REVERT_IF_EXTERNAL_FAIL)) {
            revert ExternalCallFailed();
        }
        if (amount > 0) {
            IERC20Upgradeable(_token).safeTransfer(_reserveAddress, amount);
        }
        IERC20Upgradeable(_token).approve(_receiver, 0);
    }

    function externalCall(
        address _destination,
        uint256 _value,
        bytes memory _data,
        bytes memory _nativeSender,
        uint256 _chainIdFrom,
        uint256 _flags
    ) internal returns (bool result) {
        bool storeSender = _flags.getFlag(Flags.PROXY_WITH_SENDER);
        bool checkGasLimit = _flags.getFlag(Flags.SEND_EXTERNAL_CALL_GAS_LIMIT);
        // Temporary write to a storage nativeSender and chainIdFrom variables.
        // External contract can read them during a call if needed
        if (storeSender) {
            submissionChainIdFrom = _chainIdFrom;
            submissionNativeSender = _nativeSender;
        }

        uint256 safeTxGas;
        if (checkGasLimit && _data.length > 4) {
            safeTxGas = BytesLib.toUint32(_data, 0);

            // Remove first 4 bytes from data
            _data = BytesLib.slice(_data, 4, _data.length - 4);
        }

        // We require some gas to finish transaction emit the events, approve(0) etc (at least 15000) after the execution and some to perform code until the execution (500)
        // We also include the 1/64 in the check that is not send along with a call to counteract potential shortings because of EIP-150
        if (gasleft() < safeTxGas * 64 / 63 + 15500) revert NotEnoughSafeTxGas();
        // if safeTxGas is zero set gasleft
        safeTxGas = safeTxGas == 0 ? gasleft() : uint256(safeTxGas);
        assembly {
            result := call(safeTxGas, _destination, _value, add(_data, 0x20), mload(_data), 0, 0)
        }

        // clear storage variables to get gas refund
        if (storeSender) {
            submissionChainIdFrom = 0;
            submissionNativeSender = "";
        }
    }

    // we need to accept ETH from deBridgeGate
    receive() external payable {
    }

    // ============ Version Control ============
     /// @dev Get this contract's version
    function version() external pure returns (uint256) {
        return 410; // 4.1.0
    }
}