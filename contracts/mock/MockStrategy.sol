// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../interfaces/IStrategy.sol";

contract MockStrategy is IStrategy {
    uint256 public balance;

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

    constructor() {
        balance = 0;
    }

    // suppress "unused variable" warnings by commenting out variable names

    function deposit(
        address /* _token */,
        uint256 _amount
    ) external override {
        balance += _amount;
    }

    function withdraw(
        address /* _token */,
        uint256 _amount
    ) external override {
        balance -= _amount;
    }

    function withdrawAll(address /* token */) external override {
        balance = 0;
    }

    function updateReserves(
        address /* account */,
        address /* token */
    )
        external
        view
        override
        returns (uint256)
    {
        return balance;
    }

    function strategyToken(address /* token */) external pure override returns(address){
        return address(0);
    }

    function totalShares(address _token) external override view returns (uint256) {
        return strategies[_token].totalShares;
    }

    function totalReserves(address _token) external override view returns (uint256) {
        return strategies[_token].totalReserves;
    }
}
