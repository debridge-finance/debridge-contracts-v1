// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "../interfaces/ICallProxy.sol";
import "../libraries/Flags.sol";

contract CallProxy is Initializable, AccessControlUpgradeable, ICallProxy {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using Flags for uint256;

    /* ========== STATE VARIABLES ========== */

    bytes32 public constant DEBRIDGE_GATE_ROLE = keccak256("DEBRIDGE_GATE_ROLE"); // role allowed to withdraw fee
    uint256 public override submissionChainIdFrom;
    bytes public override submissionNativeSender;

    /* ========== ERRORS ========== */

    error DeBridgeGateBadRole();

    error ExternalCallFailed();
    error CallFailed();

    /* ========== MODIFIERS ========== */

    modifier onlyGateRole() {
        if (!hasRole(DEBRIDGE_GATE_ROLE, msg.sender)) revert DeBridgeGateBadRole();
        _;
    }

    /* ========== CONSTRUCTOR  ========== */

    function initialize() public initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function call(
        address _reserveAddress,
        address _receiver,
        bytes memory _data,
        uint256 _flags,
        bytes memory _nativeSender,
        uint256 _chainIdFrom
    ) external payable override onlyGateRole returns (bool _result) {
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
        if (!_result) {
            (bool success, ) = _reserveAddress.call{value: amount}(new bytes(0));
            if (!success) revert CallFailed();
        }
    }

    function callERC20(
        address _token,
        address _reserveAddress,
        address _receiver,
        bytes memory _data,
        uint256 _flags,
        bytes memory _nativeSender,
        uint256 _chainIdFrom
    ) external override onlyGateRole returns (bool _result) {
        uint256 amount = IERC20Upgradeable(_token).balanceOf(address(this));
        IERC20Upgradeable(_token).safeApprove(_receiver, 0);
        IERC20Upgradeable(_token).safeApprove(_receiver, amount);

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
        if (!_result || amount > 0) {
            IERC20Upgradeable(_token).safeTransfer(_reserveAddress, amount);
        }
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
    function version() external pure returns (uint256) {
        return 120; // 1.2.0
    }
}
