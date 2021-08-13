// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../periphery/DefiController.sol";

contract MockDefiController is DefiController {
    function addStrategy(
        address strategy,
        // bool isSupported,
        bool isEnabled,
        // bool isRecoverable,
        address stakeToken,
        // address strategyToken,
        // address rewardToken,
        // uint256 totalShares,
        // uint256 totalReserves,
        uint256 lockedDepositBody
    ) external {
        strategies[strategy] = Strategy(
        //bool isSupported;
        isEnabled,
        // bool isRecoverable;
        stakeToken,
        // address strategyToken;
        // address rewardToken;
        // uint256 totalShares;
        //uint256 totalReserves;
        lockedDepositBody,
        0);
    }
}
