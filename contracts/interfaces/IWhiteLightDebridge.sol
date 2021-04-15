// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IWhiteLightDebridge {
    function mint(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[2][] memory _trxData
    ) external;

    function claim(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[2][] memory _trxData
    ) external;
}
