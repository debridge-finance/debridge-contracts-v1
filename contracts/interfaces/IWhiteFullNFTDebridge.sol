// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IWhiteFullNFTDebridge {
    function mint(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _tokenId,
        uint256 _nonce
    ) external;

    function mintWithOldAggregator(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _tokenId,
        uint256 _nonce,
        uint8 _aggregatorVersion
    ) external;

    function fundAggregator(bytes32 _debridgeId, uint256 _amount) external;
}