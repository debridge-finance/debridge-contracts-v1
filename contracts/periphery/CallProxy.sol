// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/ICallProxy.sol";

contract CallProxy is ICallProxy {
    function call(address _receiver, bytes memory _data)
        external
        payable
        override
        returns (bool)
    {
        return externalCall(_receiver, msg.value, _data.length, _data);
    }

    function callERC20(
        address _token,
        address _receiver,
        bytes memory _data
    ) external override returns (bool) {
        uint256 amount = IERC20(_token).balanceOf(address(this));
        IERC20(_token).transfer(_receiver, amount);
        return externalCall(_receiver, 0, _data.length, _data);
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
