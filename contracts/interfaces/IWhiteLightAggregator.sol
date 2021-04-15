// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IWhiteLightAggregator {
    function submitMint(bytes32 _mintId, bytes[2][] memory _trxData)
        external
        returns (bool);

    function submitBurn(bytes32 _burntId, bytes[2][] memory _trxData)
        external
        returns (bool);

    function isMintConfirmed(bytes32 _mintId) external view returns (bool);

    function isBurntConfirmed(bytes32 _burntId) external view returns (bool);
}
