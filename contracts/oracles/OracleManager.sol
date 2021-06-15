// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStrategyController.sol";

contract OracleManager is Ownable {
    struct WithdrawalInfo {
        uint256 amount; // amount of staked token
        uint256 timelock; // time till the asset is locked
        address receiver; // token receiver
        bool executed; // whether is executed
        uint256 collatoralId;
    }

    struct OracleInfo {
        mapping(uint256 => uint256) stake; // amount of stake per collatoral
        address admin; // current oracle admin
        uint256 withdrawalCount; // withdrawals count
        mapping(uint256 => WithdrawalInfo) withdrawals; // list of withdrawal requests
    }
    
    struct Collatoral {
        IERC20 token;
        uint256 confiscatedFunds; // total confiscated tokens
        uint256 totalLocked; // total staked tokens
    }

    mapping(address => OracleInfo) public getOracleInfo; // oracle address => oracle details
    uint256 public timelock = 2 weeks; // duration of withdrawal timelock
    Collatoral[] public collatorals;
    IStrategyController public strategyController;

    /* Events */
    event Staked(address oracle, uint256 collatoralId, uint256 amount);
    event UnstakeRequested(address oracle, uint256 collatoralId, address receipient, uint256 amount);
    event UnstakeExecuted(address oracle, uint256 withdrawalId);
    event UnstakeCancelled(address oracle, uint256 withdrawalId);
    event liquidated(address oracle, uint256 collatoralId, uint256 amount);
    event depositedToStrategy(address oracle, uint256 collatoralId, uint256 amount, address strategy);
    event withdrawedFunds(address recipient, uint256 collatoralId, uint256 amount);
    event AssetsTransferred(address oracleFrom, address oracleTo, uint256 collatoralId, uint256 amount);
    event withdrawedFromStrategy(address oracle, uint256 collatoralId, uint256 amount, address strategy);

    /* PUBLIC */

    /// @dev Constructor that initializes the most important configurations.
    /// @param _timelock Duration of withdrawal timelock.
    constructor(uint256 _timelock, IStrategyController _strategyController) Ownable() {
        timelock = _timelock;
        strategyController = _strategyController;
    }

    /// @dev Withdraws oracle reward.
    /// @param _oracle Oracle address.
    /// @param _collatoralId Index of collatoral
    /// @param _amount Amount to withdraw.
    function stake(address _oracle, uint256 _collatoralId, uint256 _amount) external {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        require(
            _collatoralId < collatorals.length,
            "stake: undefined collatoral"
        );
        Collatoral storage collatoral = collatorals[_collatoralId];
        require(
            collatoral.token.transferFrom(msg.sender, address(this), _amount),
            "stake: transfer failed"
        );
        oracle.stake[_collatoralId] += _amount;
        collatoral.totalLocked += _amount;
        emit Staked(_oracle, _collatoralId, _amount);
    }

    /// @dev Withdraws oracle reward.
    /// @param _oracle Oracle address.
    /// @param _collatoralId Index of collatoral
    /// @param _recipient Recepient reward.
    /// @param _amount Amount to withdraw.
    function requestUnstake(
        address _oracle,
        uint256 _collatoralId,
        address _recipient,
        uint256 _amount
    ) external {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        require(
            oracle.admin == msg.sender,
            "requestUnstake: only callable by admin"
        );
        if (_amount == 0) {
            return;
        }
        uint256 available = oracle.stake[_collatoralId];
        require(
            _collatoralId < collatorals.length,
            "requestUnstake: undefined collatoral"
        );
        require(
            available >= _amount,
            "requestUnstake: insufficient withdrawable funds"
        );
        Collatoral storage collatoral = collatorals[_collatoralId];
        oracle.stake[_collatoralId] = available - _amount;
        collatoral.totalLocked -= _amount;
        oracle.withdrawals[oracle.withdrawalCount] = WithdrawalInfo(
            _amount,
            block.timestamp + timelock,
            _recipient,
            false,
            _collatoralId
        );
        oracle.withdrawalCount++;
        emit UnstakeRequested(_oracle, _collatoralId, _recipient, _amount);
    }

    /// @dev Withdraw stake.
    /// @param _oracle Oracle address.
    /// @param _withdrawalId Withdrawal identifier.
    function executeUnstake(address _oracle, uint256 _withdrawalId) external {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        require(
            oracle.admin == msg.sender,
            "executeUnstake: only callable by admin"
        );
        require(
            _withdrawalId < oracle.withdrawalCount,
            "executeUnstake: withdrawal not exists"
        );
        WithdrawalInfo storage withdrawal = oracle.withdrawals[_withdrawalId];
        require(!withdrawal.executed, "executeUnstake: already executed");
        require(
            withdrawal.timelock < block.timestamp,
            "executeUnstake: too early"
        );
        withdrawal.executed = true;
        Collatoral memory collatoral = collatorals[withdrawal.collatoralId];
        require(
            collatoral.token.transfer(withdrawal.receiver, withdrawal.amount),
            "executeUnstake: transfer failed"
        );

        emit UnstakeExecuted(_oracle, _withdrawalId);
    }

    /**
     * @dev Stake token to strategies to earn rewards
     * @param _oracle address of oracle
     * @param _collatoralId Index of collatoral
     * @param _amount Amount to be staked
     * @param _strategy strategy to stake into.
     */
    function depositToStrategy(address _oracle, uint256 _collatoralId, uint256 _amount, address _strategy) external {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        Collatoral storage collatoral = collatorals[_collatoralId];
        require(oracle.stake[_collatoralId] >= _amount, "depositToStrategy: Insufficient fund");
        // strategyController.deposit(_strategy, address(collatoral.token), _amount);
        oracle.stake[_collatoralId] -= _amount;
        emit depositedToStrategy(_oracle, _collatoralId, _amount, _strategy);
    }

    /**
     * @dev Earn from the strategy
     */
    function withdrawFromStrategy(address _oracle, uint256 _collatoralId, uint256 _amount, address _strategy) external {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        Collatoral storage collatoral = collatorals[_collatoralId];
        // strategyController.withdraw(_strategy, address(collatoral.token), _amount);
        oracle.stake[_collatoralId] += _amount;
        emit withdrawedFromStrategy(_oracle, _collatoralId, _amount, _strategy);
    }

    /* ADMIN */

    /// @dev Change withdrawal timelock.
    /// @param _newTimelock Oracle address.
    function setTimelock(uint256 _newTimelock) external onlyOwner() {
        timelock = _newTimelock;
    }

    /// @dev Add new oracle.
    /// @param _oracle Oracle address.
    /// @param _admin Admin address.
    function addOracle(address _oracle, address _admin) external onlyOwner() {
        getOracleInfo[_oracle].admin = _admin;
    }

    /**
     * @dev Add a new collatoral
     * @param _token Address of token
     */
    function addCollatoral(IERC20 _token) external onlyOwner() {
        collatorals.push(Collatoral(IERC20(_token), 0, 0));
    }

    /// @dev Cancel unstake.
    /// @param _oracle Oracle address.
    /// @param _withdrawalId Withdrawal identifier.
    function cancelUnstake(address _oracle, uint256 _withdrawalId)
        external
        onlyOwner()
    {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        WithdrawalInfo storage withdrawal = oracle.withdrawals[_withdrawalId];
        require(!withdrawal.executed, "cancelUnstake: already executed");
        Collatoral storage collatoral = collatorals[withdrawal.collatoralId];
        withdrawal.executed = true;
        oracle.stake[withdrawal.collatoralId] += withdrawal.amount;
        collatoral.totalLocked += withdrawal.amount;
        UnstakeCancelled(_oracle, _withdrawalId);
    }

    /// @dev Withdraws confiscated tokens.
    /// @param _oracle Oracle address.
    /// @param _collatoralId Index of collatoral
    /// @param _amount Amount to withdraw.
    function liquidate(address _oracle, uint256 _collatoralId, uint256 _amount) external onlyOwner() {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        require(oracle.stake[_collatoralId] >= _amount, "liquidate: insufficient balance");
        Collatoral storage collatoral = collatorals[_collatoralId];
        oracle.stake[_collatoralId] -= _amount;
        collatoral.confiscatedFunds += _amount;
        collatoral.totalLocked -= _amount;
        liquidated(_oracle, _collatoralId, _amount);
    }

    /// @dev Withdraws confiscated tokens.
    /// @param _recipient Recepient reward.
    /// @param _amount Amount to withdraw.
    function withdrawFunds(address _recipient, uint256 _collatoralId, uint256 _amount)
        external
        onlyOwner()
    {
        Collatoral storage collatoral = collatorals[_collatoralId];
        require(
            uint256(collatoral.confiscatedFunds) >= _amount,
            "withdrawFunds: insufficient reserve funds"
        );
        require(
            collatoral.token.transfer(_recipient, _amount),
            "withdrawFunds: transfer failed"
        );
        collatoral.confiscatedFunds -= _amount;
        emit withdrawedFunds(_recipient, _collatoralId, _amount);
    }

    /**
     * @dev Move assets between oracles
     * @param _oracleFrom Address of oracle sender
     * @param _oracleTo Address of oracle receiver
     * @param _collatoralId Id of collatoral
     * @param _amount Amount of collatoral
     */
    function transferAssets(address _oracleFrom, address _oracleTo, uint256 _collatoralId, uint256 _amount) external onlyOwner() {
        OracleInfo storage oracleFrom = getOracleInfo[_oracleFrom];
        OracleInfo storage oracleTo = getOracleInfo[_oracleTo];

        require(oracleFrom.stake[_collatoralId] >= _amount, "transferAssets: Insufficient amount");

        oracleFrom.stake[_collatoralId] -= _amount;
        oracleTo.stake[_collatoralId] += _amount;
        emit AssetsTransferred(_oracleFrom, _oracleTo, _collatoralId, _amount);
    }

    /**
     * @dev Set strategy controller
     * @param _strategyController address of strategy controller
     */
    function setStrategyController(IStrategyController _strategyController) external onlyOwner() {
        strategyController = _strategyController;
    }

    /// @dev Get withdrawal request.
    /// @param _oracle Oracle address.
    /// @param _withdrawalId Withdrawal identifier.
    function getWithdrawalRequest(address _oracle, uint256 _withdrawalId)
        public
        view
        returns (WithdrawalInfo memory)
    {
        return getOracleInfo[_oracle].withdrawals[_withdrawalId];
    }

    /** 
     * @dev get stake property of oracle
     * @param _oracle address of oracle
     * @param _collatoralId Index of collatoral
     */
    function getOracleStaking(address _oracle, uint256 _collatoralId) public view returns (uint256) {
        return getOracleInfo[_oracle].stake[_collatoralId];
    }
}
