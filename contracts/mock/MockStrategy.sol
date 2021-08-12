// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../interfaces/IStrategy.sol";

contract MockStrategy is IStrategy {
    function deposit(address _token, uint256 _amount) external override {
        
    }

    function withdraw(address _token, uint256 _amount) public override returns(uint256 _yield, uint256 _body){
        
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