// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../transfers/DeBridgeGate.sol";

contract MockDeBridgeGateForDefiController is DeBridgeGate {
    function init() external {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        chainId = 1;
    }

    function sendETH() external payable {}

    function addDebridge(
        address tokenAddress,
        uint256 chainId,
        uint256 maxAmount,
        uint256 collectedFees,
        uint256 balance,
        uint256 lockedInStrategies,
        uint16 minReservesBps,
        uint256 chainFee,
        bool exist
    ) public {
        bytes32 debridgeId = getDebridgeId(chainId, tokenAddress);
        DebridgeInfo storage debridge = getDebridge[debridgeId];
        debridge.tokenAddress = tokenAddress;
        debridge.maxAmount = maxAmount;
        debridge.collectedFees = collectedFees;
        debridge.balance = balance;
        debridge.lockedInStrategies = lockedInStrategies;
        debridge.minReservesBps = minReservesBps;
        debridge.getChainFee[chainId] = chainFee;
        debridge.exist = exist;
    }
}
