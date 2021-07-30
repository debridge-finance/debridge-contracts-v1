// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../interfaces/IStrategy.sol";

contract MockStrategy is IStrategy {
    function deposit(address _token, uint256 _amount) external override {
        // TODO
    }

    function withdraw(address _token, uint256 _amount) external override {
        
    }

    function withdrawAll(address token) external override {

    }

    function updateReserves(address account, address token) 
        external 
        view 
        override 
        returns(uint256) 
    {

    }
}