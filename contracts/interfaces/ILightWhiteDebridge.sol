// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface ILightWhiteDebridge {
    function deposit(
        bytes32 _debridgeId,
        uint256 _amount,
        address _receiver,
        uint256 _networkId
    ) external payable;

    function withdraw(
        bytes32 _debridgeId,
        uint256 _amount,
        address _receiver,
        uint256 _networkId
    ) external payable;
}
