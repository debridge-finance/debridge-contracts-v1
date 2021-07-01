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
     * @dev Update reserve balance
     * @param _strategy Address of strategy
     * @param _token Address of token
     */
    function updateReserves(address _strategy, address _token) 
        external 
        view 
        returns(uint256) 
    {
        uint256 reserves = IStrategy(_strategy).getAssetBalance(address(this), _token);
        return reserves;
    }

    /**
     * @dev Deposit token to specific strategy
     * @param _strategy Address of strategy
     * @param _token Address of token
     * @param _amount Amount of token
     */
    function deposit(
        address _strategy, 
        address _token, 
        uint256 _amount
    ) external override {
        require(approvedStrategies[_strategy] == true, "deposit: strategy not approved");
        IERC20(_token).safeApprove(_strategy, 0);
        IERC20(_token).safeApprove(_strategy, _amount);
        IStrategy(_strategy).deposit(_token, _amount);
    }

    /**
     * @dev Withdraw token from strategy
     * @param _strategy Address of strategy
     * @param _token Address of token
     * @param _amount Amount of token to withdraw
     */
    function withdraw(
        address _strategy, 
        address _token, 
        uint256 _amount
    ) external override {
        require(approvedStrategies[_strategy] == true, "withdraw: strategy not approved");
        IERC20(_token).safeApprove(_strategy, 0);
        IERC20(_token).safeApprove(_strategy, _amount);
        IStrategy(_strategy).withdraw(_token, _amount);
        // TODO safeTransfer underlying back to OracleManager
    }

    /**
     * @dev Withdraw all tokens from strategy in case of emergency
     * @param _strategy Address of strategy
     * @param _token Address of token
     */
    function withdrawAll(address _strategy, address _token) external override onlyGovernance() {
        require(approvedStrategies[_strategy] == true, "withdrawAll: strategy not approved");
        IERC20(_token).safeApprove(_strategy, 0);
        IERC20(_token).safeApprove(_strategy, type(uint256).max);
        IStrategy(_strategy).withdrawAll(_token);
        // TODO safeTransfer underlying to Governance
    }

    /* modifiers */

    modifier onlyGovernance() {
        require(governance == msg.sender, "Only governance");
        _;
    }
}
