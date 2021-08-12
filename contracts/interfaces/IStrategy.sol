// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

contract IStrategy {
    function deposit(address token, uint256 amount) virtual external{}
    function withdraw(address token, uint256 amount) virtual public returns(uint256 _yield, uint256 _body){}
    function withdrawAll(address token) virtual external{}
    function updateReserves(address account, address token) 
        virtual
        external 
        view 
        returns(uint256){}
}