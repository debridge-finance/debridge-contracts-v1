// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IWhiteAggregator {
    function submitMint(bytes32 _mintId) external;

    function submitBurn(bytes32 _burntId) external;

    function isMintConfirmed(bytes32 _mintId) external view returns (bool);

    function isBurntConfirmed(bytes32 _burntId) external view returns (bool);
}
