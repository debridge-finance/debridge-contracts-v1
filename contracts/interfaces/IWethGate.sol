// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

interface IWethGate {
    function withdraw(address receiver, uint wad) external;
}