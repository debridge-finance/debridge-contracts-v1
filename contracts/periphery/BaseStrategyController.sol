// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStrategy.sol";

abstract contract BaseStrategyController is IStrategy {
    event StrategyReset(address _strategy, address collateral);
    error StrategyDisabled();
    error AlreadyExists();

    struct Validator {
        uint256 shares;
        mapping(address => uint256) delegatorShares;
    }

    struct Strategy {
        address strategyToken;
        address rewardToken;
        uint256 totalShares;
        uint256 totalReserves;
        uint256 rewards;
        mapping(address => Validator) validators;
        bool isEnabled;
        bool exists;
        bool isRecoverable;
    }

    mapping(address => Strategy) public strategies; // collateral => Strategy

    function _strategyToken(address _collateral) internal view virtual returns (address) {
        return strategies[_collateral].strategyToken;
    }

    function calculateShares(address _collateral, uint256 _amount)
        external
        view
        override
        returns (uint256)
    {
        Strategy storage strategy = strategies[_collateral];
        if (strategy.totalReserves > 0) {
            return (_amount * strategy.totalShares) / strategy.totalReserves;
        } else {
            return _amount;
        }
    }

    function calculateFromShares(address _collateral, uint256 _shares)
        external
        view
        override
        returns (uint256)
    {
        Strategy storage strategy = strategies[_collateral];
        if (strategy.totalShares == 0) {
            return 0;
        }
        return (_shares * strategy.totalReserves) / strategy.totalShares;
    }

    function delegatorShares(
        address _collateral,
        address _validator,
        address _delegator
    ) external view override returns (uint256) {
        return _delegatorShares(_collateral, _validator, _delegator);
    }

    function _delegatorShares(
        address _collateral,
        address _validator,
        address _delegator
    ) internal view returns (uint256) {
        return strategies[_collateral].validators[_validator].delegatorShares[_delegator];
    }

    function validatorShares(address _collateral, address _validator)
        external
        view
        override
        returns (uint256)
    {
        return _validatorShares(_collateral, _validator);
    }

    function _validatorShares(address _collateral, address _validator)
        internal
        view
        returns (uint256)
    {
        return strategies[_collateral].validators[_validator].shares;
    }

    function totalShares(address _collateral) external view override returns (uint256) {
        return strategies[_collateral].totalShares;
    }

    function rewards(address _collateral) external view override returns (uint256) {
        return strategies[_collateral].rewards;
    }

    function totalReserves(address _collateral) external view override returns (uint256) {
        return strategies[_collateral].totalReserves;
    }

    function isEnabled(address _collateral) external view override returns (bool) {
        return strategies[_collateral].isEnabled;
    }

    function strategyInfo(address _collateral) external view override returns (bool, bool) {
        return (strategies[_collateral].isEnabled, strategies[_collateral].isRecoverable);
    }

    // TODO: Need to add Access Control to all functions below

    function updateStrategyEnabled(address _collateral, bool _isEnabled) external override {
        strategies[_collateral].isEnabled = _isEnabled;
    }

    function updateStrategyRecoverable(address _collateral, bool _isRecoverable) external override {
        strategies[_collateral].isRecoverable = _isRecoverable;
    }

    function resetStrategy(address _collateral) external override {
        Strategy storage strategy = strategies[_collateral];
        if (!strategy.isEnabled) revert StrategyDisabled();
        strategy.totalReserves = 0;
        strategy.totalShares = 0;
        strategy.isEnabled = true;
        strategy.isRecoverable = false;
        emit StrategyReset(address(this), _collateral);
    }

    function addStrategy(address _collateral, address _rewardToken) external override {
        Strategy storage strategy = strategies[_collateral];
        if (strategy.exists) revert AlreadyExists();
        strategy.strategyToken = _strategyToken(_collateral);
        strategy.rewardToken = _rewardToken;
        strategy.isEnabled = true;
        strategy.exists = true;
    }

    function slashValidatorDeposits(
        address _validator,
        address _collateral,
        uint256 _slashingFraction
    ) external override {
        uint256 _shares = _validatorShares(_collateral, _validator) * _slashingFraction;
        strategies[_collateral].validators[_validator].shares -= _shares;
        //uint256 collateralAmount = calculateFromShares(_collateral, _shares);
        //withdraw(_collateral, _validator, collateralAmount, msg.sender);
    }

    function slashDelegatorDeposits(
        address _validator,
        address _delegator,
        address _collateral,
        uint256 _slashingFraction
    ) external override {
        uint256 _shares = _delegatorShares(_collateral, _validator, _delegator) * _slashingFraction;
        strategies[_collateral].validators[_validator].delegatorShares[_delegator] -= _shares;
        strategies[_collateral].validators[_validator].shares -= _shares;
        //uint256 collateralAmount = calculateFromShares(_collateral, _shares);
        //withdraw(_collateral, _validator, collateralAmount, msg.sender);
    }

    // TODO: withdraw function
}
