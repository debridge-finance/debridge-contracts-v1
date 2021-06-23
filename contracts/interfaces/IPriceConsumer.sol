// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IPriceConsumer {
    function getPriceOfToken(address token) external returns(uint256);
}