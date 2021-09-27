// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IAssetDeployer {

    function deployAsset(
        bytes32 _debridgeId,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) external returns (address wrappedAssetAddress);

    event WrappedAssetDeployed(
        address asset,
        string name,
        string symbol,
        uint8 decimals
    );
}
