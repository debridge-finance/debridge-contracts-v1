// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IYToken is IERC20 {
    function deposit(uint _amount) external;
    function withdraw(uint _shares) external;
}
