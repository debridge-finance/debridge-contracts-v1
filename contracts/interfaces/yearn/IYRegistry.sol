// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IYRegistry {
    function getVaults() external view returns (address[] memory);
}
