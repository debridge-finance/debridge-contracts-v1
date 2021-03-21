// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILinkToken is IERC20 {
    function transferAndCall(
        address to,
        uint256 value,
        bytes memory data
    ) external returns (bool success);
}
