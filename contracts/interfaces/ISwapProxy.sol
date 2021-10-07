// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface ISwapProxy {
    function swap(
        address _fromToken,
        address _toToken,
        address _receiver
    ) external returns(uint256);
}
