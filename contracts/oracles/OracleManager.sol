// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract OracleManager is Ownable {
    struct WithdrawalInfo {
        uint256 amount; // amount of staked token
        uint256 timelock; // time till the asset is locked
        address receiver; // token receiver
        bool executed; // whether is executed
    }

    struct OracleInfo {
        uint256 stake; // amount of staked token
        address admin; // current oracle admin
        uint256 withdrawalCount; // withdrawals count
        mapping(uint256 => WithdrawalInfo) withdrawals; // list of withdrawal requests
    }

    mapping(address => OracleInfo) public getOracleInfo; // oracle address => oracle details
    IERC20 public token; // token address
    uint256 public confiscatedFunds; // total confiscated tokens
    uint256 public totalLocked; // total staked tokens
    uint256 public timelock; // duration of withdrawal timelock

    /* PUBLIC */

    /// @dev Constructor that initializes the most important configurations.
    /// @param _token Token to stake.
    /// @param _timelock Duration of withdrawal timelock.
    constructor(IERC20 _token, uint256 _timelock) Ownable() {
        token = _token;
        timelock = _timelock;
    }

    /// @dev Withdraws oracle reward.
    /// @param _oracle Oracle address.
    /// @param _amount Amount to withdraw.
    function stake(address _oracle, uint256 _amount) external {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        require(
            token.transferFrom(msg.sender, address(this), _amount),
            "stake: transfer failed"
        );
        oracle.stake += _amount;
        totalLocked += _amount;
    }

    /// @dev Withdraws oracle reward.
    /// @param _oracle Oracle address.
    /// @param _recipient Recepient reward.
    /// @param _amount Amount to withdraw.
    function requestUnstake(
        address _oracle,
        address _recipient,
        uint256 _amount
    ) external {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        require(
            oracle.admin == msg.sender,
            "withdrawStake: only callable by admin"
        );
        uint256 available = oracle.stake;
        require(
            available >= _amount,
            "withdrawStake: insufficient withdrawable funds"
        );
        oracle.stake = available - _amount;
        totalLocked -= _amount;
        oracle.withdrawals[oracle.withdrawalCount] = WithdrawalInfo(
            _amount,
            block.timestamp + timelock,
            _recipient,
            false
        );
        oracle.withdrawalCount++;
    }

    /// @dev Withdraw stake.
    /// @param _oracle Oracle address.
    /// @param _withdrawalId Withdrawal identifier.
    function executeWithdrawal(address _oracle, uint256 _withdrawalId)
        external
    {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        require(
            oracle.admin == msg.sender,
            "executeWithdrawal: only callable by admin"
        );
        WithdrawalInfo storage withdrawal = oracle.withdrawals[_withdrawalId];
        require(!withdrawal.executed, "executeWithdrawal: alreaddy executed");
        withdrawal.executed = true;
        require(
            token.transfer(withdrawal.receiver, withdrawal.amount),
            "executeWithdrawal: transfer failed"
        );
    }

    /* ADMIN */

    /// @dev Withdraws confiscated tokens.
    /// @param _oracle Oracle address.
    /// @param _amount Amount to withdraw.
    function confiscate(address _oracle, uint256 _amount) external onlyOwner() {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        require(
            oracle.stake >= _amount,
            "confiscate: insufficient confiscate amount"
        );
        oracle.stake -= _amount;
        confiscatedFunds += _amount;
        totalLocked -= _amount;
    }

    /// @dev Withdraws confiscated tokens.
    /// @param _recipient Recepient reward.
    /// @param _amount Amount to withdraw.
    function withdrawFunds(address _recipient, uint256 _amount)
        external
        onlyOwner()
    {
        require(
            uint256(confiscatedFunds) >= _amount,
            "withdrawFunds: insufficient reserve funds"
        );
        require(
            token.transfer(_recipient, _amount),
            "withdrawFunds: transfer failed"
        );
        confiscatedFunds -= _amount;
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
}
