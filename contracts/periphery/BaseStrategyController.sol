// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStrategy.sol";

abstract contract BaseStrategyController is IStrategy {

    event StrategyReset(address _strategy, address collateral);
    

    error StrategyDisabled();
    error AlreadyExists();

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

    function _strategyToken(address _stakeToken) internal view virtual returns (address) {
        return strategies[_stakeToken].strategyToken;
    }

    function totalShares(address _token) external view override returns (uint256) {
        return strategies[_token].totalShares;
    }

    function rewards(address _token) external view override returns (uint256) {
        return strategies[_token].rewards;
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

    function updateStrategyEnabled(address _stakeToken, bool _isEnabled) external override {
        strategies[_stakeToken].isEnabled = _isEnabled;
    }

    function updateStrategyRecoverable(address _stakeToken, bool _isRecoverable) external override {
        strategies[_stakeToken].isRecoverable = _isRecoverable;
    }

    function resetStrategy(address _stakeToken) external override {
        Strategy storage strategy = strategies[_stakeToken];
        if (!strategy.isEnabled) revert StrategyDisabled();
        strategy.totalReserves = 0;
        strategy.totalShares = 0;
        strategy.isEnabled = true;
        strategy.isRecoverable = false;
        emit StrategyReset(address(this), strategy.stakeToken);
    }


    function addStrategy(address _stakeToken, address _rewardToken) external override {
        Strategy storage strategy = strategies[_stakeToken];
        if (strategy.exists) revert AlreadyExists();
        strategy.stakeToken = _stakeToken;
        strategy.strategyToken = _strategyToken(_stakeToken);
        strategy.rewardToken = _rewardToken;
        strategy.isEnabled = true;
        strategy.exists = true;
    }
}
