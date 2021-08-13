// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IStrategy {
    function deposit(address token, uint256 amount) external;
    function withdraw(address token, uint256 amount) external returns(uint256 _yield, uint256 _body);
    function withdrawAll(address token) external;
    function updateReserves(address account, address token) 
        external 
        view 
        returns(uint256);
}