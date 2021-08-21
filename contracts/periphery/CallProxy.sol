// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ICallProxy.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract CallProxy is ICallProxy {
    using SafeERC20 for IERC20;

    function call(
        address _reserveAddress,
        address _receiver,
        bytes memory _data
    ) external payable override returns (bool _result) {
        _result = externalCall(_receiver, msg.value, _data.length, _data);
        if (!_result) {
            payable(_reserveAddress).transfer(msg.value);
        }
    }

    function callERC20(
        address _token,
        address _reserveAddress,
        address _receiver,
        bytes memory _data
    ) external override returns (bool _result) {
        uint256 amount = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeApprove(_receiver, 0);
        IERC20(_token).safeApprove(_receiver, amount);
        _result = externalCall(_receiver, 0, _data.length, _data);
        amount = IERC20(_token).balanceOf(address(this));
        if (!_result || amount > 0) {
            IERC20(_token).safeTransfer(_reserveAddress, amount);
        }
    }

    function externalCall(
        address destination,
        uint256 value,
        uint256 dataLength,
        bytes memory data
    ) internal returns (bool) {
        bool result;
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
        return result;
    }
}
