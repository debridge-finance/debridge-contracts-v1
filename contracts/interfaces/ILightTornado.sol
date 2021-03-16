// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface ILightTornado {
    function deposit(bytes32 _commitment) external payable;

    function withdraw(
        address payable _recipient,
        address payable _relayer,
        uint256 _fee,
        uint256 _refund
    ) external payable;
}
