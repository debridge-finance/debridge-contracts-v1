// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IPriceConsumer {
    function getPriceOfTokenInWETH(address token) external view returns (uint256);

    function getRate(address base, address quote) external view returns (uint256);

    function getPairAddress(address token0, address token1) external view returns (address);
}