// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IVault {
    function decimals() external view returns (uint256);

    function deposit(uint256) external;

    function withdraw(uint256) external returns(uint256);

    function withdrawAll() external;

    function pricePerShare() external view returns (uint256);

    function totalAssets() external view returns (uint256);
}