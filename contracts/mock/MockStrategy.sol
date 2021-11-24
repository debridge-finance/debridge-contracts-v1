// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../interfaces/IStrategy.sol";
import "../periphery/BaseStrategyController.sol";

contract MockStrategy is BaseStrategyController {
    uint256 public balance;

    constructor() {
        balance = 0;
    }

    // suppress "unused variable" warnings by commenting out variable names

    function _deposit(
        address /* _token */,
        uint256 _amount
    ) internal override {
        balance += _amount;
    }

    function _withdraw(
        address /* _token */,
        uint256 _amount
    ) internal override {
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
}
