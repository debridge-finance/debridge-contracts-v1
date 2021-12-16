// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IStrategy {
    function deposit(address token, uint256 amount) external;

    function withdraw(address token, uint256 amount) external;

    function withdrawAll(address token) external;
    function strategyToken(address token) external view returns(address);
    function updateReserves(address account, address token)
        external
        view
        returns(uint256);
}