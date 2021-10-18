// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IYRegistry {
    function getVaults() external view returns (address[] memory);
}
