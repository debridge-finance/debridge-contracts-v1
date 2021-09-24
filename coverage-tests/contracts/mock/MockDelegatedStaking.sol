pragma solidity =0.8.7;

import "../oracles/DelegatedStaking.sol";

contract MockDelegatedStaking is DelegatedStaking {


    function getOracleShares(address _oracle, address _collateral) public view returns (uint256) {
        return getUserInfo[_oracle].stake[_collateral].shares;
    }

    function getOracleAdmin(address _oracle) public view returns (address) {
        return getUserInfo[_oracle].admin;
    }

    function getOracleDelegatorsCount(address _oracle) public view returns (uint256) {
        return getUserInfo[_oracle].delegatorCount;
    }

    function getOracleDelegatorExistance(address _oracle, address delegator) public view returns (bool) {
        return getUserInfo[_oracle].delegators[delegator].exists;
    }

    function getOracleTransferCount(address _oracle) public view returns (uint256) {
        return getUserInfo[_oracle].transferCount;
    }

    function getTotalLockedCollateral(address _collateralProvider) public view returns (uint256) {
        return collaterals[_collateralProvider].totalLocked;
    }

    function getStrategyTotalShares(address _strategy) public view returns (uint256) {
        return strategies[_strategy].totalShares;
    }

    function mock_set_sender_share_stake(address sender, address _collateral, uint256 shares) public {
        getUserInfo[sender].stake[_collateral].shares = shares;
    }

    function mock_set_transfer_timelock(address sender, uint256 transferId, uint256 _timelock) public {
        getUserInfo[sender].transfers[transferId].timelock=_timelock;
    }

    function mock_set_oracle_shares(address _oracle, address _strategy, uint256 shareAmount) public {
        Strategy storage strategy = strategies[_strategy];
        UserInfo storage oracle = getUserInfo[_oracle];
        StrategyDepositInfo storage deposit = oracle.strategyStake[_strategy][strategy.stakeToken];
        deposit.shares = shareAmount;
    }

    function mock_set_strategy_total_reserves_and_shares(address _strategy, uint256 totalReserves,uint256 totalShares)public {
        Strategy storage strategy = strategies[_strategy];
        strategy.totalReserves = totalReserves;
        strategy.totalShares = totalShares;
    }

    function mock_set_oracle_stake_shares(address oracle, address collateral, uint256 amount) public {
        getUserInfo[oracle].stake[collateral].shares = amount;
    }

    function mock_add_delegator_to_oracle(address oracle, address delegator) public {
        getUserInfo[oracle].delegators[delegator].exists=true;
    }

    function mock_add_user_info_admin(address admin) public {
        getUserInfo[admin].admin=admin;
    }


}