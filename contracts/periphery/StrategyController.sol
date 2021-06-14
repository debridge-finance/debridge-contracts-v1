// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStrategyController.sol";
import "../interfaces/IStrategy.sol";

contract StrategyController is 
IStrategyController {
    address public governance;
    mapping(address => bool) public approvedStrategies;
    
    constructor() {
        governance = msg.sender;
    }

    /**
     * @dev Set governance
     * @param _governance Address of new governance
     */
    function setGovernance(address _governance) public onlyGovernance() {
        governance = _governance;
    }

    /**
     * @dev Approve strategy by governance
     * @param _strategy Address of strategy
     */
    function approveStrategy(address _strategy) external override onlyGovernance() {
        approvedStrategies[_strategy] = true;
    }

    /**
     * @dev Reject strategy by governance
     * @param _strategy Address of strategy
     */
    function revokeStrategy(address _strategy) external override onlyGovernance() {
        approvedStrategies[_strategy] = false;
    }

    /**
     * @dev Deposit token to specific strategy
     * @param _strategy Address of strategy
     * @param _token Address of token
     * @param _amount Amount of token
     */
    function deposit(address _strategy, address _token, uint256 _amount) external override{
        require(approvedStrategies[_strategy] == true, "deposit: strategy not approved");

        IStrategy(_strategy).deposit(_token, _amount);
    }

    /**
     * @dev Withdraw token from strategy
     * @param _strategy Address of strategy
     * @param _token Address of token
     * @param _amount Amount of token to withdraw
     */
    function withdraw(address _strategy, address _token, uint256 _amount) external override{
        require(approvedStrategies[_strategy] == true, "deposit: strategy not approved");

        IStrategy(_strategy).withdraw(_token, _amount);
    }

    /* modifiers */

    modifier onlyGovernance() {
        require(governance == msg.sender, "Only governance");
        _;
    }
}
