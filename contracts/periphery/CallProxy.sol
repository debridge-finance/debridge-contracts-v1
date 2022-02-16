// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "../interfaces/ICallProxy.sol";
import "../libraries/Flags.sol";

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
            _flags.getFlag(Flags.PROXY_WITH_SENDER)
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
            _flags.getFlag(Flags.PROXY_WITH_SENDER)
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

    //gnosis
    //https://github.com/gnosis/MultiSigWallet/blob/ca981359cf5acd6a1f9db18e44777e45027df5e0/contracts/MultiSigWallet.sol#L244-L261

    function externalCall(
        address destination,
        uint256 value,
        bytes memory data,
        bytes memory _nativeSender,
        uint256 _chainIdFrom,
        bool storeSender
    ) internal returns (bool result) {
        // Temporary write to a storage nativeSender and chainIdFrom variables.
        // External contract can read them during a call if needed
        if (storeSender) {
            submissionChainIdFrom = _chainIdFrom;
            submissionNativeSender = _nativeSender;
        }

        assembly {
            result := call(gas(), destination, value, add(data, 0x20), mload(data), 0, 0)
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
        return 400; // 4.0.0
    }
}
