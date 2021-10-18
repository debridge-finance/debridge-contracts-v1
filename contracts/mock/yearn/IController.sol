// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IController {
    function withdraw(address, uint256) external;

    function balanceOf(address) external view returns (uint256);

    function vaults(address) external view returns (address);
}