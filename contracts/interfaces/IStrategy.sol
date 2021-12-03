// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IStrategy {
    function getValidator() external view returns (address);

    function deposit(address token, address recipient, uint256 shares, uint256 amount) external;
    function withdraw(address token, address recipient, uint256 shares) external returns(bool, uint256);

    function withdrawAll(address token) external;
    function strategyToken(address token) external view returns(address);
    function totalReserves(address token) external view returns(uint256);
    function totalShares(address token) external view returns(uint256);
    function isEnabled(address token) external view returns(bool);
    function strategyInfo(address token) external view returns(bool, bool);

    function delegatorShares(address collateral, address delegator) external view returns(uint256);

    function updateStrategyEnabled(address token, bool isEnabled) external;
    function updateStrategyRecoverable(address token, bool isRecoverable) external;
    function resetStrategy(address stakeToken) external;
    function addStrategy(address stakeToken, address rewardToken) external;

    function slashValidatorDeposits(address collateral, uint256 slashingFraction) external returns(uint256);
    function slashDelegatorDeposits(address delegator, address collateral, uint256 slashingFraction) external returns(uint256);
}