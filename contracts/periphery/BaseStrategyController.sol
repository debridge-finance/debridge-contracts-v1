// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStrategy.sol";

abstract contract BaseStrategyController is IStrategy {

    struct Strategy {
        address stakeToken;
        address strategyToken;
        address rewardToken;
        uint256 totalShares;
        uint256 totalReserves;
        uint256 rewards;
        bool isEnabled;
        bool exists;
        bool isRecoverable;
    }

    mapping(address => Strategy) public strategies;

    function totalShares(address _token) external view override returns (uint256) {
        return strategies[_token].totalShares;
    }

    function totalReserves(address _token) external view override returns (uint256) {
        return strategies[_token].totalReserves;
    }

    function isEnabled(address _token) external view override returns (bool) {
        return strategies[_token].isEnabled;
    }

    function strategyInfo(address _token) external view override returns (bool, bool) {
        Strategy memory strategy = strategies[_token]; 
        return (strategy.isEnabled, strategy.isRecoverable);
    }

    function calculateShares(address _token, uint256 _amount) external view override returns (uint256) {
        Strategy memory strategy = strategies[_token]; 
        if (strategy.totalReserves > 0) {
            return (_amount * strategy.totalShares) / strategy.totalReserves;
        } else {
            return _amount;
        }
    }

    function calculateFromShares(address _token, uint256 _shares) external view override returns (uint256) {
        Strategy memory strategy = strategies[_token]; 
        if (strategy.totalShares == 0) {
            return 0;
        }
        return (_shares * strategy.totalReserves) / strategy.totalShares;
    }
}
