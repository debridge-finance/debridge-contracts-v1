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

    function totalReserves(address token) external view returns(uint256);
    function totalShares(address token) external view returns(uint256);
    function isEnabled(address token) external view returns(bool);
    function strategyInfo(address token) external view returns(bool, bool);

    function calculateShares(address token, uint256 amount) external view returns(uint256);
    function calculateFromShares(address token, uint256 shares) external view returns(uint256);
}