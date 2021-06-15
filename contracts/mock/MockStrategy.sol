// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../interfaces/IStrategy.sol";

contract MockStrategy is IStrategy{
    function deposit(address _token, uint256 _amount) external override {
        
    }

    function withdraw(address _token, uint256 _amount) external override {
        
    }
}