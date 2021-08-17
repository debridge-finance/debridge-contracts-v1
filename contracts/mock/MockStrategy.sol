// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../interfaces/IStrategy.sol";

contract MockStrategy is IStrategy {
    uint256 public balance;

    constructor()
    {
        balance = 0;
    }

    function setBalance(uint256 new_balance) external
    {
        balance = new_balance;
    }

    function deposit(address _token, uint256 _amount) external override {
        
    }

    function withdraw(address _token, uint256 _amount) external override {
        
    }

    function withdrawAll(address token) external override {

    }

    function updateReserves(address account, address token) 
        external 
        view 
        override 
        returns(uint256) 
    {
    // uint256 reserves = IERC20(_token).balanceOf(_account);
    // address incentivesController = IAToken(_token).getIncentivesController();
    // uint256 reserves = IAaveIncentivesController(incentivesController).getUserAssetData(_account, _token);
        return balance;
    }
}