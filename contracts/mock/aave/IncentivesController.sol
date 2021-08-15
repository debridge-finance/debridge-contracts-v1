// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;


import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockAToken} from "./MockAToken.sol";
import {IAaveIncentivesController} from "../../interfaces/aave/IAaveIncentivesController.sol";

contract IncentivesController is IAaveIncentivesController {

  using SafeERC20 for IERC20;

  address REWARDTOKEN;

  event RewardsClaimed(address indexed user, address indexed to, uint256 amount);

  constructor(
    address rewardToken
  ) {
    REWARDTOKEN = rewardToken;
  }

  /**
   * @dev Claims reward for an user, on all the assets of the lending pool, accumulating the pending rewards
   * @param amount Amount of rewards to claim
   * @param to Address that will be receiving the rewards
   * @return Rewards claimed
   **/
  function claimRewards(
    address[] calldata assets,
    uint256 amount,
    address to
  ) external override returns (uint256) {
    if (amount == 0) {
      return 0;
    }
    address user = msg.sender;

    uint256 unclaimedRewards = 20 * MockAToken(assets[0]).balanceOf(user) / 100;

    uint256 amountToClaim = amount > unclaimedRewards ? unclaimedRewards : amount;
    IERC20(REWARDTOKEN).safeTransferFrom(address(this), to, amountToClaim);
    emit RewardsClaimed(msg.sender, to, amountToClaim);

    return amountToClaim;
  }

  function getRewardsBalance(address[] calldata assets, address user)
      external
      view
      override
      returns (uint256) {}
    function claimRewardsOnBehalf(
      address[] calldata assets,
      uint256 amount,
      address user,
      address to
    ) external override returns (uint256) {}
    function getUserUnclaimedRewards(address user) external view override returns (uint256) {}
    function REWARD_TOKEN() external view override returns (address) {}
}
