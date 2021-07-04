// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IWrappedAssetFactory {
    function deploy(
        string memory _name,
        string memory _symbol,
        address _admin,
        address[] memory _minters
    ) external returns (address);
}
