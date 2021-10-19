// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IDeBridgeGate.sol";

contract MockFlashCallback {
    using SafeERC20 for IERC20;
    uint256 public lastAmount;
    address public lastTokenAddress;
    address public lastFlashReceiver;
    bool public revertOrNo;

    /// @param fee The fee amount in token due to the pool by the end of the flash
    // /// @param data Any data passed through by the caller via the IDeBridgeGate#flash call
    function flashCallback(uint256 fee, bytes calldata /* data */) external {
        if (revertOrNo) {
            IERC20(lastTokenAddress).safeTransfer(lastFlashReceiver, lastAmount);
        } else {
            IERC20(lastTokenAddress).safeTransfer(lastFlashReceiver, lastAmount + fee);
        }
    }

    function flash(
        address _flashReceiver,
        address _tokenAddress,
        address _receiver,
        uint256 _amount,
        bool _revert
    ) external {
        revertOrNo = _revert;
        lastAmount = _amount;
        lastTokenAddress = _tokenAddress;
        lastFlashReceiver = _flashReceiver;
        IDeBridgeGate(_flashReceiver).flash(_tokenAddress, _receiver, _amount, "0");
    }
}
