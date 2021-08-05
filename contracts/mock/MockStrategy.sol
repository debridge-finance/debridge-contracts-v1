// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/aave/ILendingPool.sol";
import "../interfaces/aave/IAToken.sol";
import "../interfaces/IStrategy.sol";

contract MockStrategy is IStrategy {
    
    using SafeERC20 for IERC20;
    
    address public lendPool;
    address public protocolDataProvider;

    function deposit(address _token, uint256 _amount) external override {
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_token).safeApprove(lendPool, 0);
        IERC20(_token).safeApprove(lendPool, _amount);

        ILendingPool(lendPool).deposit(
        _token,
        _amount,
        msg.sender,
        0 // referral code
        );
    }

    function withdraw(address _token, uint256 _amount) public override {
        address underlying = IAToken(_token).UNDERLYING_ASSET_ADDRESS();
        IERC20(_token).safeApprove(lendPool, 0);
        IERC20(_token).safeApprove(lendPool, _amount);
        uint256 maxAmount = IERC20(_token).balanceOf(address(this));

        uint256 amountWithdrawn = ILendingPool(lendPool).withdraw(
        underlying,
        _amount,
        msg.sender
        );

        _collectProtocolToken(_token, _amount/maxAmount);

        require(
        amountWithdrawn == _amount ||
        (_amount == type(uint256).max && maxAmount == IERC20(underlying).balanceOf(address(this))),
        "Did not withdraw requested amount"
        );
    }

    function withdrawAll(address _token) external override {
        withdraw(_token, type(uint256).max);
    }

    function updateReserves(address _account, address _token) 
        external 
        view 
        override 
        returns(uint256)
    {
        return IERC20(_token).balanceOf(_account);
    }

    function _collectProtocolToken(address _token, uint256 _amount) internal {
        address[] memory assets = new address[](1);
        assets[0] = address(_token);
        IAaveIncentivesController incentivesController = IAToken(_token).getIncentivesController();
        uint256 rewardsBalance = incentivesController.getRewardsBalance(assets, address(this));
        incentivesController.claimRewards(assets, _amount*rewardsBalance, address(this));
    }
}