// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IStrategyController {
    function approveStrategy(address _strategy) external;
    function revokeStrategy(address _strategy) external;
    function deposit(address _strategy, address _token, uint256 _amount) external;
    function withdraw(address _strategy, address _token, uint256 _amount) external;
    function withdrawAll(address _strategy, address _token) external;
}