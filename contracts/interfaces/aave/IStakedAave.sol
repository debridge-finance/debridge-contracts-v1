// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStakedAave is IERC20 {
    function COOLDOWN_SECONDS() external view returns (uint256);

    function getTotalRewardsBalance(address staker) external view returns (uint256);
    function stakersCooldowns(address staker) external view returns (uint256);

    function stake(address to, uint256 amount) external;
    function redeem(address to, uint256 amount) external;
    function cooldown() external;
    function claimRewards(address to, uint256 amount) external;
}