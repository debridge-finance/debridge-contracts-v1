// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IStrategy {
    function deposit(address token, uint256 amount) external;
    function withdraw(address token, uint256 amount) external;
}