// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IComptroller {
    function getAllMarkets() external view returns (address[] memory);
    function claimComp(address holder) external;
    function claimComp(address holder, address[] memory cTokens) external;
}
