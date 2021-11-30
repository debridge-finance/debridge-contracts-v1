// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IStrategy {
    function deposit(address token, address validator, address recipient, uint256 shares, uint256 amount) external;
    function withdraw(address token, address validator, address recipient, uint256 shares) external;

    function withdrawAll(address token) external;
    function strategyToken(address token) external view returns(address);
    function updateReserves(address account, address token) 
        external 
        view 
        returns(uint256);

    function totalReserves(address token) external view returns(uint256);
    function totalShares(address token) external view returns(uint256);
    function rewards(address token) external view returns(uint256);
    function isEnabled(address token) external view returns(bool);
    function strategyInfo(address token) external view returns(bool, bool);

    function delegatorShares(address collateral, address validator, address delegator) external view returns(uint256);
    function validatorShares(address collateral, address validator) external view returns(uint256);
    function calculateShares(address token, uint256 amount) external view returns(uint256);
    function calculateFromShares(address token, uint256 shares) external view returns(uint256);

    function updateStrategyEnabled(address token, bool isEnabled) external;
    function updateStrategyRecoverable(address token, bool isRecoverable) external;
    function resetStrategy(address stakeToken) external;
    function addStrategy(address stakeToken, address rewardToken) external;

    function slashValidatorDeposits(address validator, address collateral, uint256 slashingFraction) external returns(uint256);
    function slashDelegatorDeposits(address validator, address delegator, address collateral, uint256 slashingFraction) external returns(uint256);
}