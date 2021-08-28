// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IDefiController {
    function claimReserve(address _tokenAddress, uint256 _amount) external;
}
