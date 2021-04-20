// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IWhiteFullDebridge {
    function mint(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _nonce
    ) external;

    function claim(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _nonce
    ) external;

    function mintWithOldAggregator(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        uint8 _aggregatorVersion
    ) external;

    function claimWithOldAggregator(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        uint8 _aggregatorVersion
    ) external;
}
