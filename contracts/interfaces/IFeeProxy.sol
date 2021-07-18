// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IFeeProxy {
    function swapToLink(
        address _erc20Token,
        address _receiver
    ) external;
}
