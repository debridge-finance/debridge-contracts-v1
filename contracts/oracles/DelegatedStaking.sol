// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IPriceConsumer.sol";

library DelegatedStakingHelper {

    /**
     * @dev Calculates shares
     * @param _amount amount of collateral
     * @param _totalShares total number of shares
     * @param _totalAmount total amount of collateral
     */
    function _calculateShares(uint256 _amount, uint256 _totalShares, uint256 _totalAmount)
        internal
        pure
        returns(uint256)
    {
        return _amount * _totalShares / _totalAmount;
    }
    
    /**
     * @dev Calculates amount from shares
     * @param _amount amount of shares
     * @param _totalAmount total amount of collateral
     * @param _totalShares total number of shares
     */
    function _calculateFromShares(uint256 _amount, uint256 _totalAmount, uint256 _totalShares)
        internal
        pure
        returns(uint256)
    {
        return _amount * _totalAmount / _totalShares;
    }

    /**
     * @dev Calculates passed rewards
     * @param _shares Delegator shares
     * @param _accTokens Accumulated tokens per share
     */
    function _calculatePassedRewards(uint256 _shares, uint256 _accTokens) internal pure returns (uint256) {
        return _shares * _accTokens / 1e18;
    }

    /**
     * @dev Validates transfer/withdrawal not already executed
     * @param _executed Executed bool
     */
    function _validateNotExecuted(bool _executed) internal pure {
        require(!_executed, "already executed");
    }

    /**
     * @dev Validates if collateral is enabled
     * @param _collateralEnabled Collateral enabled bool
     */
    function _validateCollateral(bool _collateralEnabled) internal pure {
        require(_collateralEnabled, "collateral disabled");
    }

    /**
     * @dev Validates if oracle is oracle
     * @param _isOracle Oracle is oracle bool
     */
    function _validateOracle(bool _isOracle) internal pure {
        require(_isOracle, "only oracle");
    }

    /**
     * @dev Validates if delegator exists
     * @param _delegatorExists Delegator exists bool
     */
    function _validateDelegator(bool _delegatorExists) internal pure {
        require(_delegatorExists, "delegator !exist");
    }

    /**
     * @dev Validates if request exists
     * @param _requestExists Request exists bool
     */
    function _validateRequestExists(bool _requestExists) internal pure {
        require(_requestExists, "request !exist");
    }

    /**
     * @dev Validates if timelock passed
     * @param _timelockPassed Timelock passed bool
     */
    function _validateTimelock(bool _timelockPassed) internal pure {
        require(_timelockPassed, "too early");
    }

    /**
     * @dev Validates if strategy enabled
     * @param _strategyEnabled Strategy enabled bool
     */
    function _validateStrategy(bool _strategyEnabled) internal pure {
        require(_strategyEnabled, "strategy disabled");
    }

    /**
     * @dev Validates if sender is admin
     * @param _admin Admin address
     * @param _sender Sender address
     */
    function _validateAdmin(address _admin, address _sender) internal pure {
        require(_admin == _sender, "only admin");
    }

    function _validateShares(uint256 _shares) internal pure {
        require(_shares > 0, "no shares");
    }

    /**
     * @dev Validates if greater than
     * @param _amount Amount to validate
     * @param _min Minimum amount
     */
    function _validateGtE(uint256 _amount, uint256 _min) internal pure {
        require(_amount >= _min, "bad amount");
    }

    /**
     * @dev Validates if correct basis points
     * @param _profitSharingBPS BPS to validate
     * @param BPS_DENOMINATOR Maximum amount
     */
    function _validateBPS(uint256 _profitSharingBPS, uint256 BPS_DENOMINATOR) internal pure {
        require(_profitSharingBPS <= BPS_DENOMINATOR, "bad bps" );
    }
}

contract DelegatedStaking is AccessControl, Initializable {

    using SafeERC20 for IERC20;

    struct WithdrawalInfo {
        uint256 amount; // amount of staked token
        uint256 timelock; // time till the asset is locked
        address receiver; // token receiver
        bool executed; // whether is executed
        bool paused;    // whether is paused
        uint256 pausedTime; // paused timestamp
        address collateral; // collateral identifier
    }

    struct DelegatorInfo {
        mapping(address => StakeDepositInfo) stakes;
        mapping(address => mapping(address => StrategyDepositInfo)) strategyStakes;
        mapping(address => uint256) passedRewards; // rewards per collateral address, calculated before stake
        bool exists; //Delegator exists in oracle mapping
    }

    struct StakeDepositInfo {
        uint256 stakedAmount; // total tokens staked by oracle/delegator
        uint256 shares; // total share of collateral tokens
        uint256 locked; // total share locked by depositing to strategy
    }

    struct UserInfo { // info of validator or delegator
        mapping(address => uint256) accTokensPerShare; // accumulated reward tokens per share
        mapping(address => mapping(address => StrategyDepositInfo)) strategyStake;
        address admin; // current admin
        uint256 withdrawalCount; // withdrawals count
        mapping(uint256 => WithdrawalInfo) withdrawals; // list of withdrawal requests
        uint256 profitSharingBPS;  // profit sharing basis points.
        bool isOracle; // whether is oracles
        mapping(address => uint256) stake; // amount of oracle stake per collateral
        mapping(address => uint256) locked; // amount of oracle stake locked per collateral
        mapping(address => DelegatorInfo) delegators;
        mapping(uint256 => address) delegatorAddresses; //delegator list
        mapping(address => StakeDepositInfo) delegation; // total delegated to user and total shares per collateral
        uint256 delegatorCount; //delegator count
        // Collateral's accumulated reward per shares in other collateral
        mapping(address => mapping(address => uint256)) dependsAccTokensPerShare;
        mapping(address => uint256) accumulatedRewards;
    }

    struct Collateral {
        uint256 confiscatedFunds; // total confiscated tokens
        uint256 totalLocked; // total staked tokens
        uint256 rewards; // total accumulated rewards
        uint256 maxStakeAmount; // maximum stake for each collateral
        uint8 decimals;
        bool isSupported;
        bool isUSDStable;
        bool isEnabled;
    }

    struct Strategy {
        bool isSupported;
        bool isEnabled;
        bool isRecoverable;
        address stakeToken;
        address strategyToken;
        address rewardToken;
        uint256 totalShares;
        uint256 totalReserves;
        uint256 rewards;
    }

    struct StrategyDepositInfo {
        uint256 stakedAmount; // total tokens deposited by user
        uint256 shares; // total share of strategy tokens (e.g. aToken)
    }

    mapping(address => UserInfo) public getUserInfo; // oracle address => oracle details
    uint256 public timelock; // duration of withdrawal timelock
    uint256 public constant BPS_DENOMINATOR = 10000; // Basis points, or bps, equal to 1/10000 used to express relative value
    uint256 public minProfitSharingBPS;
    mapping(address => Collateral) public collaterals;
    address[] public collateralAddresses;
    mapping(address => uint256) public accumulatedProtocolRewards;
    mapping(address => Strategy) public strategies;
    address[] public strategyAddresses;
    IPriceConsumer public priceConsumer;

    /* Events */
    event Staked(address oracle, address user, address collateral, uint256 amount);
    event UnstakeRequested(address oracle, address user, address collateral, address receipient, uint256 amount);
    event UnstakeExecuted(address user, uint256 withdrawalId);
    event UnstakeCancelled(address oracle, address user, uint256 withdrawalId);
    event UnstakePaused(address user, uint256 withdrawalId, uint256 timestamp);
    event UnstakeResumed(address user, uint256 withdrawalId, uint256 timestamp);
    event Liquidated(address oracle, address collateral, uint256 amount);
    event LiquidatedDelegator(address oracle, address delegator, address collateral, uint256 amount);
    event DepositedToStrategy(address oracle, address user, uint256 amount, address strategy, address collateral);
    event WithdrawnFromStrategy(address oracle, address user, uint256 amount, address strategy, address collateral);
    event EmergencyWithdrawnFromStrategy(uint256 amount, address strategy, address collateral);
    event RecoveredFromEmergency(address oracle, uint256 amount, address strategy, address collateral);
    event RewardsDistributed(address oracle, address collateral, uint256 amount);
    event WithdrawnFunds(address recipient, address collateral, uint256 amount);

    /* PUBLIC */

    /**
     * @dev Initializer that initializes the most important configurations.
     * @param _timelock Duration of withdrawal timelock.
     */
    function initialize(uint256 _timelock, IPriceConsumer _priceConsumer) public initializer {
        // Grant the contract deployer the default admin role: it will be able
        // to grant and revoke any roles
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        timelock = _timelock;
        priceConsumer = _priceConsumer;
        minProfitSharingBPS = 5000;
    }

    /**
     * @dev stake collateral to oracle.
     * @param _oracle Oracle address.
     * @param _collateral address of collateral
     * @param _amount Amount to stake.
     */
    function stake(address _oracle, address _collateral, uint256 _amount) external {
        UserInfo storage oracle = getUserInfo[_oracle];
        Collateral storage collateral = collaterals[_collateral];
        DelegatedStakingHelper._validateCollateral(collateral.isEnabled);
        require(collateral.totalLocked+_amount <= collateral.maxStakeAmount,
            "collateral limited"
        );

        UserInfo storage sender = getUserInfo[msg.sender];
        if (sender.admin == address(0))
            sender.admin = msg.sender;

        IERC20(_collateral).safeTransferFrom(msg.sender, address(this), _amount);

        collateral.totalLocked += _amount;
        if (msg.sender != oracle.admin) {
            DelegatorInfo storage delegator = oracle.delegators[msg.sender];
            if (!delegator.exists) {
                oracle.delegatorAddresses[oracle.delegatorCount] = msg.sender;
                oracle.delegatorCount++;
                delegator.exists = true;
            }

            uint256 shares = oracle.delegation[_collateral].stakedAmount > 0
                ? DelegatedStakingHelper._calculateShares(_amount, oracle.delegation[_collateral].shares,
                    oracle.delegation[_collateral].stakedAmount)
                : _amount;

            //Update users passedRewards
            uint256 dependencyRewards = _creditDelegatorRewards(_oracle, msg.sender, _collateral);

            //We need to sum _amount before to recalculate new passedRewards
            oracle.delegation[_collateral].stakedAmount += _amount;
            oracle.delegation[_collateral].shares += shares;
            delegator.stakes[_collateral].stakedAmount += _amount;
            delegator.stakes[_collateral].shares += shares;

            // accumulated token per share for current collateral
            delegator.passedRewards[_collateral] = DelegatedStakingHelper._calculatePassedRewards(
                            delegator.stakes[_collateral].shares,
                            oracle.accTokensPerShare[_collateral])
                            + dependencyRewards;
        }
        else {
            oracle.stake[_collateral] += _amount;
        }
        emit Staked(_oracle, msg.sender, _collateral, _amount);
    }

    /**
     * @dev Withdraws oracle reward.
     * @param _oracle Oracle address.
     * @param _collateral Index of collateral
     * @param _recipient Recepient reward.
     * @param _amount Amount to withdraw.
     */
    function requestUnstake(
        address _oracle,
        address _collateral,
        address _recipient,
        uint256 _amount
    ) external {
        UserInfo storage oracle = getUserInfo[_oracle];
        if (_amount == 0) {
            return;
        }
        UserInfo storage sender = getUserInfo[msg.sender];
        if (msg.sender != oracle.admin) {
            DelegatorInfo storage delegator = oracle.delegators[msg.sender];
            DelegatedStakingHelper._validateDelegator(delegator.exists);
            DelegatedStakingHelper._validateGtE(
                delegator.stakes[_collateral].shares
                - delegator.stakes[_collateral].locked,
                _amount
            );
            
            uint256 dependencyRewards = _creditDelegatorRewards(_oracle, msg.sender, _collateral);
            // if called by delegator then _amount represents their share to withdraw
            uint256 delegatorCollateral = DelegatedStakingHelper._calculateFromShares(
                _amount, oracle.delegation[_collateral].stakedAmount,
                oracle.delegation[_collateral].shares
            );
            collaterals[_collateral].totalLocked -= delegatorCollateral;
            delegator.stakes[_collateral].stakedAmount -= delegatorCollateral;
            delegator.stakes[_collateral].shares -= _amount;
            oracle.delegation[_collateral].shares -= _amount;
            oracle.delegation[_collateral].stakedAmount -= delegatorCollateral;
            
            // recalculate passed rewards with new share amount
            delegator.passedRewards[_collateral] = DelegatedStakingHelper._calculatePassedRewards(
                            delegator.stakes[_collateral].shares,
                            oracle.accTokensPerShare[_collateral])
                            + dependencyRewards;

            sender.withdrawals[sender.withdrawalCount] = WithdrawalInfo(
                delegatorCollateral,
                block.timestamp + timelock,
                _recipient,
                false,
                false,
                0,
                _collateral
            );
            sender.withdrawalCount++;
        }
        else {
            // if called by oracle then _amount represents their collateral to withdraw
            DelegatedStakingHelper._validateGtE(oracle.stake[_collateral] - oracle.locked[_collateral], _amount);
            collaterals[_collateral].totalLocked -= _amount;
            oracle.stake[_collateral] -= _amount;

            oracle.withdrawals[oracle.withdrawalCount] = WithdrawalInfo(
                _amount,
                block.timestamp + timelock,
                _recipient,
                false,
                false,
                0,
                _collateral
            );
            oracle.withdrawalCount++;
        }
        emit UnstakeRequested(_oracle, msg.sender, _collateral, _recipient, _amount);
    }

    /**
     * @dev Withdraw stake.
     * @param _user User address.
     * @param _withdrawalId Withdrawal identifier.
     */
    function executeUnstake(address _user, uint256 _withdrawalId) external {
        UserInfo storage user = getUserInfo[_user];
        DelegatedStakingHelper._validateAdmin(user.admin,msg.sender);
        DelegatedStakingHelper._validateRequestExists(bool(user.withdrawalCount > _withdrawalId));
        WithdrawalInfo storage withdrawal = user.withdrawals[_withdrawalId];
        DelegatedStakingHelper._validateNotExecuted(withdrawal.executed);
        DelegatedStakingHelper._validateTimelock(bool(withdrawal.timelock < block.timestamp));
        withdrawal.executed = true;
        IERC20(withdrawal.collateral).safeTransfer(withdrawal.receiver, withdrawal.amount);
        emit UnstakeExecuted(_user, _withdrawalId);
    }

    /**
     * @dev Cancel unstake.
     * @param _oracle Oracle address.
     * @param _withdrawalId Withdrawal identifier.
     */
    function cancelUnstake(address _oracle, uint256 _withdrawalId) external {
        UserInfo storage oracle = getUserInfo[_oracle];
        WithdrawalInfo storage withdrawal;
        if (msg.sender != oracle.admin) {
            DelegatorInfo storage delegator = oracle.delegators[msg.sender];
            DelegatedStakingHelper._validateDelegator(delegator.exists);
            withdrawal = oracle.withdrawals[_withdrawalId];
            DelegatedStakingHelper._validateNotExecuted(withdrawal.executed);
            withdrawal.executed = true;
            uint256 delegatorShares = DelegatedStakingHelper._calculateShares(
                withdrawal.amount,
                oracle.delegation[withdrawal.collateral].shares,
                oracle.delegation[withdrawal.collateral].stakedAmount
            );
            collaterals[withdrawal.collateral].totalLocked += withdrawal.amount;
            delegator.stakes[withdrawal.collateral].stakedAmount += withdrawal.amount;
            delegator.stakes[withdrawal.collateral].shares += delegatorShares;
            oracle.delegation[withdrawal.collateral].shares += delegatorShares;
            oracle.delegation[withdrawal.collateral].stakedAmount += withdrawal.amount;

            // recalculate passed rewards
            delegator.passedRewards[withdrawal.collateral] = DelegatedStakingHelper._calculatePassedRewards(
                            delegator.stakes[withdrawal.collateral].shares,
                            oracle.accTokensPerShare[withdrawal.collateral]);
        }
        else {
            withdrawal = oracle.withdrawals[_withdrawalId];
            DelegatedStakingHelper._validateNotExecuted(withdrawal.executed);
            withdrawal.executed = true;
            oracle.stake[withdrawal.collateral] += withdrawal.amount;
            collaterals[withdrawal.collateral].totalLocked += withdrawal.amount;
        }
        emit UnstakeCancelled(_oracle, msg.sender, _withdrawalId);
    }

    /**
     * @dev Stake token to strategies to earn rewards
     * @param _oracle address of oracle
     * @param _amount Amount to be staked
     * @param _strategy strategy to stake into.
     */
    function depositToStrategy(address _oracle, uint256 _amount, address _strategy) external {
        Strategy storage strategy = strategies[_strategy];
        DelegatedStakingHelper._validateStrategy(strategy.isEnabled);
        IStrategy strategyController = IStrategy(_strategy);
        Collateral storage stakeCollateral = collaterals[strategy.stakeToken];
        UserInfo storage oracle = getUserInfo[_oracle];
        DelegatorInfo storage delegator = oracle.delegators[msg.sender];
        StrategyDepositInfo storage depositInfo;

        if (msg.sender != oracle.admin) {
            DelegatedStakingHelper._validateDelegator(delegator.exists);
            depositInfo = delegator.strategyStakes[_strategy][strategy.stakeToken];
            uint256 delegatorShares = DelegatedStakingHelper._calculateShares(
                _amount,
                oracle.delegation[strategy.stakeToken].shares,
                oracle.delegation[strategy.stakeToken].stakedAmount
            );
            DelegatedStakingHelper._validateGtE(
                delegator.stakes[strategy.stakeToken].shares
                - delegator.stakes[strategy.stakeToken].locked,
                delegatorShares
            );
            delegator.stakes[strategy.stakeToken].locked += delegatorShares;
        }
        else {
            DelegatedStakingHelper._validateAdmin(oracle.admin, msg.sender);
            depositInfo = oracle.strategyStake[_strategy][strategy.stakeToken];
            DelegatedStakingHelper._validateGtE(
                oracle.stake[strategy.stakeToken] - oracle.locked[strategy.stakeToken], _amount
            );
            oracle.locked[strategy.stakeToken] += _amount;
        }
        IERC20(strategy.stakeToken).safeApprove(address(strategyController), 0);
        IERC20(strategy.stakeToken).safeApprove(address(strategyController), _amount);
        strategy.totalReserves = strategyController.updateReserves(address(this), strategy.strategyToken);
        strategyController.deposit(strategy.stakeToken, _amount);
        uint256 afterBalance = strategyController.updateReserves(address(this), strategy.strategyToken);
        uint256 receivedAmount = afterBalance - strategy.totalReserves;
        uint256 shares = strategy.totalShares > 0
            ? DelegatedStakingHelper._calculateShares(receivedAmount, strategy.totalShares, strategy.totalReserves)
            : receivedAmount;
        strategy.totalShares += shares;
        strategy.totalReserves = strategyController.updateReserves(address(this), strategy.strategyToken);
        depositInfo.stakedAmount += _amount;
        depositInfo.shares += shares;
        stakeCollateral.totalLocked -= _amount;
        emit DepositedToStrategy(_oracle, msg.sender, _amount, _strategy, strategy.stakeToken);
    }

    /**
     * @dev Withdraw token from strategies to claim rewards
     * @param _oracle address of oracle
     * @param _shares number of shares to redeem
     * @param _strategy strategy to withdraw from.
     */
    function withdrawFromStrategy(address _oracle, uint256 _shares, address _strategy) external {
        Strategy storage strategy = strategies[_strategy];
        DelegatedStakingHelper._validateStrategy(strategy.isEnabled);
        Collateral storage collateral = collaterals[strategy.stakeToken];
        UserInfo storage oracle = getUserInfo[_oracle];
        DelegatorInfo storage delegator = oracle.delegators[msg.sender];
        bool isDelegator;
        uint256 beforeBalance = IStrategy(_strategy).updateReserves(address(this), strategy.stakeToken);
        uint256 stakeCollateral = DelegatedStakingHelper._calculateFromShares(
            _shares, beforeBalance, strategy.totalShares
        );
        StrategyDepositInfo storage depositInfo;

        if (msg.sender != oracle.admin) {
            DelegatedStakingHelper._validateDelegator(delegator.exists);
            isDelegator = true;
            depositInfo = delegator.strategyStakes[_strategy][strategy.stakeToken];
        }
        else {
            DelegatedStakingHelper._validateAdmin(oracle.admin, msg.sender);
            depositInfo = oracle.strategyStake[_strategy][strategy.stakeToken];
        }
        
        { // scope to avoid stack too deep errors
            DelegatedStakingHelper._validateGtE(depositInfo.shares, _shares);
            uint256 strategyTokenAmount = DelegatedStakingHelper._calculateFromShares(
                _shares, strategy.totalReserves, strategy.totalShares
            );
            depositInfo.shares -= _shares;
            depositInfo.stakedAmount -= stakeCollateral;
            strategy.totalShares -= _shares;
            strategy.totalReserves = IStrategy(_strategy).updateReserves(address(this), strategy.strategyToken);
            IStrategy(_strategy).withdraw(strategy.strategyToken, strategyTokenAmount);
        }
        uint256 receivedAmount = IStrategy(_strategy).updateReserves(address(this), strategy.stakeToken) - beforeBalance;
        collateral.totalLocked += receivedAmount;
        uint256 rewardAmount = receivedAmount - stakeCollateral;
        collateral.rewards += rewardAmount;
        strategy.rewards += rewardAmount;
        accumulatedProtocolRewards[strategy.stakeToken] += rewardAmount;
        if (isDelegator) {
            uint256 shares = oracle.delegation[strategy.stakeToken].stakedAmount > 0
            ? DelegatedStakingHelper._calculateShares(rewardAmount, oracle.delegation[strategy.stakeToken].shares,
                oracle.delegation[strategy.stakeToken].stakedAmount)
            : rewardAmount;
            delegator.stakes[strategy.stakeToken].stakedAmount += rewardAmount;
            delegator.stakes[strategy.stakeToken].shares += shares;
            delegator.stakes[strategy.stakeToken].locked -= DelegatedStakingHelper._calculateShares(
                rewardAmount,
                oracle.delegation[strategy.stakeToken].shares,
                oracle.delegation[strategy.stakeToken].stakedAmount
            );
            getUserInfo[msg.sender].accumulatedRewards[strategy.stakeToken] += rewardAmount;
            oracle.delegation[strategy.stakeToken].stakedAmount += rewardAmount;
            oracle.delegation[strategy.stakeToken].shares += shares;
        }
        else {
            oracle.stake[strategy.stakeToken] += rewardAmount;
            oracle.accumulatedRewards[strategy.stakeToken] += rewardAmount;
            oracle.locked[strategy.stakeToken] -= stakeCollateral;
        }
        emit WithdrawnFromStrategy(_oracle, msg.sender, receivedAmount, _strategy, strategy.stakeToken);
    }

    /**
     * @dev Recovers user share of all funds emergency withdrawn from the strategy.
     * @param _strategy Strategy to recover from.
     * @param _oracles Array of oracle addresses.
     */
    function recoverFromEmergency(address _strategy, address[] calldata _oracles) external {
        Strategy storage strategy = strategies[_strategy];
        require(!strategy.isEnabled, "strategy enabled");
        require(strategy.isRecoverable, "not recoverable");
        for (uint256 i=0; i<_oracles.length; i++) {
            UserInfo storage oracle = getUserInfo[_oracles[i]];
            DelegatedStakingHelper._validateOracle(oracle.isOracle);
            StrategyDepositInfo storage depositInfo = oracle.strategyStake[_strategy][strategy.stakeToken];
            uint256 amount = DelegatedStakingHelper._calculateFromShares(
                depositInfo.shares, strategy.totalReserves, strategy.totalShares
            );
            strategy.totalShares -= depositInfo.shares;
            depositInfo.shares = 0;
            depositInfo.stakedAmount = 0;
            strategy.totalReserves -= amount;
            oracle.locked[strategy.stakeToken] = 0;

            emit RecoveredFromEmergency(_oracles[i], amount, _strategy, strategy.stakeToken);
            
            for (uint256 k=0; k<oracle.delegatorCount; k++) {
                DelegatorInfo storage delegator = oracle.delegators[oracle.delegatorAddresses[k]];
                depositInfo = delegator.strategyStakes[_strategy][strategy.stakeToken];
                amount = DelegatedStakingHelper._calculateFromShares(
                    depositInfo.shares, strategy.totalReserves, strategy.totalShares
                );
                strategy.totalShares -= depositInfo.shares;
                depositInfo.shares = 0;
                depositInfo.stakedAmount = 0;
                strategy.totalReserves -= amount;
                delegator.stakes[strategy.stakeToken].locked = 0;
                
                emit RecoveredFromEmergency(oracle.delegatorAddresses[k], amount, _strategy, strategy.stakeToken);
            }
        }
    }

    /**
     * @dev set basis points of profit sharing
     * @param _oracle address of oracle
     * @param _profitSharingBPS profit sharing basis points
     */
    function setProfitSharing(address _oracle, uint256 _profitSharingBPS) external {
        UserInfo storage oracle = getUserInfo[_oracle];
        DelegatedStakingHelper._validateAdmin(oracle.admin, msg.sender);
        require(_profitSharingBPS >= minProfitSharingBPS, "bad min BPS");
        DelegatedStakingHelper._validateBPS(_profitSharingBPS, BPS_DENOMINATOR);
        oracle.profitSharingBPS = _profitSharingBPS;
    }

    /**
     * @dev Distributes oracle rewards to oracle/delegators
     * @param _oracle address of oracle
     * @param _collateral address of collateral
     * @param _amount amount of token
     */
    function distributeRewards(address _oracle, address _collateral, uint256 _amount) external {
        Collateral storage collateral = collaterals[_collateral];

        DelegatedStakingHelper._validateCollateral(collateral.isEnabled);
        IERC20(_collateral).safeTransferFrom( msg.sender, address(this), _amount);
        collateral.totalLocked += _amount;
        collateral.rewards +=_amount;
        accumulatedProtocolRewards[_collateral] += _amount;

        UserInfo storage oracle = getUserInfo[_oracle];
        uint256 delegatorsAmount = _amount * oracle.profitSharingBPS / BPS_DENOMINATOR;

        //Add rewards to oracle
        oracle.stake[_collateral] += _amount - delegatorsAmount;
        oracle.accumulatedRewards[_collateral] += _amount - delegatorsAmount;

        // All colaterals of the oracle valued in usd
        uint256 totalUSDAmount = getTotalUSDAmount(_oracle);
        for (uint256 i = 0; i < collateralAddresses.length; i++) {
            address currentCollateral = collateralAddresses[i];
            // How many rewards each collateral receives
            uint256 accTokens = delegatorsAmount *
                getPoolUSDAmount(_oracle, currentCollateral) /
                totalUSDAmount;

            uint256 accTokensPerShare = oracle.delegation[currentCollateral].shares > 0
                ? accTokens * 1e18 / oracle.delegation[currentCollateral].shares
                : 0;

            if(currentCollateral==_collateral){
                //Increase accumulated rewards per share
                oracle.accTokensPerShare[currentCollateral] += accTokensPerShare;
            } else {
                //Add a reward pool dependency
                oracle.dependsAccTokensPerShare[currentCollateral][_collateral] += accTokensPerShare;
            }
        }
        emit RewardsDistributed(_oracle, _collateral, _amount);
    }

    /* ADMIN */

    /**
     * @dev Withdraws all funds from the strategy.
     * @param _strategy Strategy to withdraw from.
     */
    function emergencyWithdrawFromStrategy(address _strategy)
        external
        onlyAdmin()
    {
        Strategy storage strategy = strategies[_strategy];
        DelegatedStakingHelper._validateStrategy(strategy.isEnabled);
        IStrategy strategyController = IStrategy(_strategy);
        Collateral storage stakeCollateral = collaterals[strategy.stakeToken];
        uint256 beforeBalance = strategyController.updateReserves(address(this), strategy.stakeToken);
        strategyController.withdrawAll(strategy.strategyToken);
        uint256 afterBalance = strategyController.updateReserves(address(this), strategy.stakeToken);
        uint256 receivedAmount = afterBalance - beforeBalance;
        stakeCollateral.totalLocked += receivedAmount;
        strategy.totalReserves = receivedAmount;
        strategy.isEnabled = false;
        strategy.isRecoverable = true;
        emit EmergencyWithdrawnFromStrategy(receivedAmount, _strategy, strategy.stakeToken);
    }

    /**
     * @dev Change withdrawal timelock.
     * @param _newTimelock New timelock.
     */
    function setTimelock(uint256 _newTimelock) external onlyAdmin() {
        timelock = _newTimelock;
    }

    /**
     * @dev set min basis points of profit sharing
     * @param _profitSharingBPS profit sharing basis points
     */
    function setMinProfitSharing(uint256 _profitSharingBPS) external onlyAdmin() {
        DelegatedStakingHelper._validateBPS(_profitSharingBPS, BPS_DENOMINATOR);
        minProfitSharingBPS = _profitSharingBPS;
    }

    /**
     * @dev Confiscate stake.
     * @param _oracle Oracle address.
     * @param _collateral Index of collateral
     * @param _amount Amount to withdraw.
     */
    function liquidate(address _oracle, address _collateral, uint256 _amount) external onlyAdmin() {
        UserInfo storage oracle = getUserInfo[_oracle];
        Collateral storage collateral = collaterals[_collateral];
        DelegatedStakingHelper._validateGtE(oracle.stake[_collateral], _amount);
        oracle.stake[_collateral] -= _amount;
        collateral.confiscatedFunds += _amount;
        collateral.totalLocked -= _amount;
        emit Liquidated(_oracle, _collateral, _amount);
    }

    /**
     * @dev Confiscate delegator stake.
     * @param _oracle Oracle address.
     * @param _delegator Delegator address.
     * @param _collateral Index of collateral.
     * @param _amount Amount to withdraw.
     */
    function liquidate(address _oracle, address _delegator, address _collateral, uint256 _amount) external onlyAdmin() {
        UserInfo storage oracle = getUserInfo[_oracle];
        DelegatorInfo storage delegator = oracle.delegators[_delegator];
        DelegatedStakingHelper._validateDelegator(delegator.exists);
        DelegatedStakingHelper._validateGtE(delegator.stakes[_collateral].stakedAmount, _amount);
        uint256 _shares = DelegatedStakingHelper._calculateShares(_amount, oracle.delegation[_collateral].shares,
                    oracle.delegation[_collateral].stakedAmount);
        delegator.stakes[_collateral].stakedAmount -= _amount;
        delegator.stakes[_collateral].shares -= _shares;
        oracle.delegation[_collateral].shares -= _shares;
        oracle.delegation[_collateral].stakedAmount -= _amount;
        collaterals[_collateral].confiscatedFunds += _amount;
        delegator.passedRewards[_collateral] = DelegatedStakingHelper._calculatePassedRewards(
                            delegator.stakes[_collateral].shares,
                            oracle.accTokensPerShare[_collateral]);
        emit LiquidatedDelegator(_oracle, _delegator, _collateral, _amount);
    }

    /**
     * @dev Withdraws confiscated tokens.
     * @param _recipient Recepient reward.
     * @param _amount Amount to withdraw.
     */
    function withdrawFunds(address _recipient, address _collateral, uint256 _amount)
        external
        onlyAdmin()
    {
        Collateral storage collateral = collaterals[_collateral];
        DelegatedStakingHelper._validateGtE(collateral.confiscatedFunds, _amount);
        IERC20(_collateral).safeTransfer(_recipient, _amount);
        collateral.confiscatedFunds -= _amount;
        emit WithdrawnFunds(_recipient, _collateral, _amount);
    }

    /**
     * @dev Add new oracle.
     * @param _oracle Oracle address.
     * @param _admin Admin address.
     */
    function addOracle(address _oracle, address _admin) external onlyAdmin() {
        getUserInfo[_oracle].admin = _admin;
        getUserInfo[_oracle].isOracle = true;
    }

    /**
     * @dev Add a new collateral
     * @param _token Address of token
     */
    function addCollateral(address _token, uint8 _decimals, bool _isUSDStable) external onlyAdmin() {
        Collateral storage collateral = collaterals[_token];
        if (!collateral.isSupported){
            collateral.isSupported = true;
            collateral.isEnabled = true;
            collateral.isUSDStable = _isUSDStable;
            collateral.decimals = _decimals;
            collateralAddresses.push(_token);
        }
    }

    /**
     * @dev enable collateral
     * @param _collateral address of collateral
     * @param _isEnabled bool of enable
     */
    function updateCollateral(address _collateral, bool _isEnabled) external onlyAdmin() {
        collaterals[_collateral].isEnabled = _isEnabled;
    }

    /**
     * @dev update collateral max amount
     * @param _collateral address of collateral
     * @param _amount max amount
     */
    function updateCollateral(address _collateral, uint256 _amount) external onlyAdmin() {
        collaterals[_collateral].maxStakeAmount = _amount;
    }

    /**
     * @dev Add a new strategy
     * @param _strategy address to strategy
     * @param _stakeToken collateralId of stakeToken
     * @param _rewardToken collateralId of rewardToken
     */
    function addStrategy(address _strategy, address _stakeToken, address _rewardToken) external onlyAdmin() {
        Strategy storage strategy = strategies[_strategy];
        require(!strategy.isSupported, "already exists");
        strategy.stakeToken = _stakeToken;
        strategy.rewardToken = _rewardToken;
        strategy.isSupported = true;
        strategy.isEnabled = true;
        strategyAddresses.push(_strategy);
    }

    /**
     * @dev enable strategy
     * @param _strategy address of strategy
     * @param _isEnabled bool of enable
     */
    function updateStrategy(address _strategy, bool _isEnabled) external onlyAdmin() {
        strategies[_strategy].isEnabled = _isEnabled;
    }

    /**
     * @dev Pause unstaking request.
     * @param _user address of user
     */
    function pauseUnstake(address _user) external onlyAdmin() {
        UserInfo storage user = getUserInfo[_user];
        uint256 i;
        for (i = 0; i < user.withdrawalCount; i ++) {
            WithdrawalInfo storage withdrawal = user.withdrawals[i];
            if (withdrawal.paused == false && withdrawal.executed == false) {
                withdrawal.paused = true;
                withdrawal.pausedTime = block.timestamp;
                emit UnstakePaused(_user, i, block.timestamp);
            }
        }
    }

    /**
     * @dev Resume unstaking request.
     * @param _user address of user
     */
    function resumeUnstake(address _user) external onlyAdmin() {
        UserInfo storage user = getUserInfo[_user];
        uint256 i;
        for (i = 0; i < user.withdrawalCount; i ++) {
            WithdrawalInfo storage withdrawal = user.withdrawals[i];
            if (withdrawal.paused == true && withdrawal.executed == false) {
                withdrawal.paused = false;
                withdrawal.timelock += block.timestamp - withdrawal.pausedTime;
                emit UnstakeResumed(_user, i, block.timestamp);
            }
        }
    }

    /**
     * @dev Set Price Consumer
     * @param _priceConsumer address of price consumer
     */
    function setPriceConsumer(IPriceConsumer _priceConsumer) external onlyAdmin() {
        priceConsumer = _priceConsumer;
    }

    /* internal & views */

    /**
     * @dev Credits delegator share of oracle rewards and updated passed rewards
     * @param _oracle address of oracle
     * @param _sender address of sender
     */
    function _creditDelegatorRewards(address _oracle, address _sender, address _collateral) internal returns(uint256) {
        UserInfo storage oracle = getUserInfo[_oracle];
        UserInfo storage sender = getUserInfo[_sender];
        DelegatorInfo storage delegator = oracle.delegators[_sender];
        uint256 collateralDependencyRewards;

        for (uint256 i = 0; i < collateralAddresses.length; i++) {
            address rewardCollateral = collateralAddresses[i];
            uint256 pendingReward = delegator.stakes[rewardCollateral].shares
                                * oracle.accTokensPerShare[rewardCollateral]
                                / 1e18;

            // accumulated token per share for collateral that exists reward in rewardCollateral
            uint256 dependencyRewards = _calculateDependencyRewards(_oracle, _sender, rewardCollateral);
            pendingReward = pendingReward + dependencyRewards - delegator.passedRewards[rewardCollateral];
            if (pendingReward > 0) {
                uint256 pendingShares = DelegatedStakingHelper._calculateShares(
                                            pendingReward, oracle.delegation[rewardCollateral].shares,
                                            oracle.delegation[rewardCollateral].stakedAmount
                                        );
                oracle.delegation[rewardCollateral].stakedAmount += pendingReward;
                oracle.delegation[rewardCollateral].shares += pendingShares;
                sender.accumulatedRewards[rewardCollateral] += pendingReward;
                delegator.stakes[rewardCollateral].stakedAmount += pendingReward;
                delegator.stakes[rewardCollateral].shares += pendingShares;
            }

            // accumulated token per share for current collateral
            delegator.passedRewards[rewardCollateral] = DelegatedStakingHelper._calculatePassedRewards(
                            delegator.stakes[rewardCollateral].shares,
                            oracle.accTokensPerShare[rewardCollateral])
                            + dependencyRewards;

            if (rewardCollateral == _collateral)
                collateralDependencyRewards = dependencyRewards;
        }
        return collateralDependencyRewards;
    }
    
    /**
     * @dev Calculates accumulated tokens per share for collateral that has rewards in rewardCollateral
     * @param _oracle address of oracle
     * @param _sender address of sender
     * @param _rewardCollateral address of rewardCollateral
     */
    function _calculateDependencyRewards(address _oracle, address _sender, address _rewardCollateral)
        internal
        view
        returns(uint256)
    {
        UserInfo storage oracle = getUserInfo[_oracle];
        DelegatorInfo storage delegator = oracle.delegators[_sender];

        // accumulated token per share for collateral that exists reward in rewardCollateral
        uint256 dependencyRewards;
        for(uint256 k = 0; k < collateralAddresses.length; k++) {
            address collateral = collateralAddresses[k];
                if(collateral != _rewardCollateral) {
                    dependencyRewards +=
                            delegator.stakes[collateral].shares
                            * oracle.dependsAccTokensPerShare[collateral][_rewardCollateral]
                            / 1e18;
                }
            }
        return dependencyRewards;
    }

    /**
     * @dev Get price per share
     * @param _strategy Address of strategy
     * @param _collateral Address of collateral
     */
    function getPricePerFullStrategyShare(address _strategy, address _collateral)
        external
        view
        returns (uint256)
    {
        DelegatedStakingHelper._validateShares(strategies[_strategy].totalShares);
        uint256 totalStrategyTokenReserves = IStrategy(_strategy).updateReserves(address(this), _collateral);
        return totalStrategyTokenReserves/strategies[_strategy].totalShares;
    }

    /**
     * @dev Get price per oracle share
     * @param _oracle Address of oracle
     * @param _collateral Address of collateral
     */
    function getPricePerFullOracleShare(address _oracle, address _collateral)
        external
        view
        returns (uint256)
    {
        UserInfo storage oracle = getUserInfo[_oracle];
        DelegatedStakingHelper._validateOracle(oracle.isOracle);
        DelegatedStakingHelper._validateShares(oracle.delegation[_collateral].shares);
        return oracle.delegation[_collateral].stakedAmount/oracle.delegation[_collateral].shares;
    }

    /**
     * @dev Get USD amount of oracle collateral
     * @param _oracle Address of oracle
     * @param _collateral Address of collateral
     * @return USD amount with decimals 18 
     */
    function getPoolUSDAmount(address _oracle, address _collateral) public view returns(uint256) {
        uint256 collateralPrice;
        Collateral storage collateral = collaterals[_collateral];
        if (collateral.isUSDStable)
            collateralPrice = 1e18;
        else collateralPrice = priceConsumer.getPriceOfToken(_collateral);
        return getUserInfo[_oracle].delegation[_collateral].stakedAmount * collateralPrice
                / (10 ** collateral.decimals);
    }

    /**
     * @dev Get total USD amount of oracle collateral
     * @param _oracle Address of oracle
     */
    function getTotalUSDAmount(address _oracle) public view returns(uint256) {
        uint256 totalUSDAmount = 0;
        for (uint256 i = 0; i < collateralAddresses.length; i++) {
            totalUSDAmount += getPoolUSDAmount(_oracle, collateralAddresses[i]);
        }
        return totalUSDAmount;
    }

    /**
     * @dev Get withdrawal request.
     * @param _user User address.
     * @param _withdrawalId Withdrawal identifier.
     */
    function getWithdrawalRequest(address _user, uint256 _withdrawalId)
        external
        view
        returns (WithdrawalInfo memory)
    {
        return getUserInfo[_user].withdrawals[_withdrawalId];
    }


    /**
     * @dev get stake property of oracle
     * @param _oracle address of oracle
     * @param _collateral Address of collateral
     */
    function getOracleStaking(address _oracle, address _collateral) external view returns (uint256, uint256) {
        UserInfo storage oracle = getUserInfo[_oracle];
        return(
            oracle.stake[_collateral],
            oracle.locked[_collateral]
        );
    }

    /**
     * @dev get delegator stakes: returns whether delegator exists, staked amount, shares, locked amount and passed rewards
     * @param _oracle address of oracle
     * @param _delegator address of delegator
     * @param _collateral Address of collateral
     */
    function getDelegatorStakes(address _oracle, address _delegator, address _collateral)
        external
        view
        returns(bool, uint256, uint256, uint256, uint256)
    {
        DelegatorInfo storage delegator = getUserInfo[_oracle].delegators[_delegator];
        return (
            delegator.exists,
            delegator.stakes[_collateral].stakedAmount,
            delegator.stakes[_collateral].shares,
            delegator.stakes[_collateral].locked,
            delegator.passedRewards[_collateral]
        );
    }

    /**
     * @dev get user, collateral and protocol rewards
     * @param _user address of account
     * @param _collateral Address of collateral
     */
    function getRewards(address _user, address _collateral)
        external
        view
        returns(uint256, uint256, uint256)
    {
        return(
            getUserInfo[_user].accumulatedRewards[_collateral],
            collaterals[_collateral].rewards,
            accumulatedProtocolRewards[_collateral]
        );
    }

    /**
     * @dev Get delegation info to oracle: returns total delegation amount, total shares, delegator count
     * @param _oracle Address of oracle
     * @param _collateral Address of collateral
     */
    function getDelegationInfo(address _oracle, address _collateral) external view returns(uint256, uint256, uint256) {
        UserInfo storage oracle = getUserInfo[_oracle];
        return (
            oracle.delegation[_collateral].stakedAmount,
            oracle.delegation[_collateral].shares,
            oracle.delegatorCount
        );
    }

    /**
     * @dev Get total stake to strategy: returns total reserve amount, total shares and total rewards
     * @param _strategy Address of strategy
     */
    function getStrategyStakes(address _strategy) external view returns(uint256, uint256, uint256) {
        return (
            strategies[_strategy].totalReserves, 
            strategies[_strategy].totalShares,
            strategies[_strategy].rewards
        );
    }

    /** 
     * @dev Get accumulated tokens per share
     * @param _oracle Oracle address
     * @param _collateral Collateral address
     * @param _dependsCollateral Depends collateral address
     */
    function getTokensPerShare(address _oracle, address _collateral, address _dependsCollateral) external view returns(uint256, uint256) {
        UserInfo storage oracle = getUserInfo[_oracle];
        return(
            oracle.accTokensPerShare[_collateral],
            oracle.dependsAccTokensPerShare[_dependsCollateral][_collateral]
        );
    }

    /**
     * @dev Gets oracle strategy deposit info
     * @param _oracle Oracle address
     * @param _strategy Strategy address
     */
    function getStrategyDepositInfo(address _oracle, address _strategy)
        external
        view
        returns(uint256, uint256)
    {
        return(
            getUserInfo[_oracle].strategyStake[_strategy][strategies[_strategy].stakeToken].stakedAmount,
            getUserInfo[_oracle].strategyStake[_strategy][strategies[_strategy].stakeToken].shares
        );
    }

    /**
     * @dev Gets delegator strategy deposit info
     * @param _oracle Oracle address
     * @param _delegator Delegator address
     * @param _strategy Strategy address
     */
    function getStrategyDepositInfo(address _oracle, address _delegator, address _strategy)
        external
        view
        returns(uint256, uint256)
    {
        return(
            getUserInfo[_oracle].delegators[_delegator].strategyStakes[_strategy][strategies[_strategy].stakeToken].stakedAmount,
            getUserInfo[_oracle].delegators[_delegator].strategyStakes[_strategy][strategies[_strategy].stakeToken].shares
        );
    }

    /* modifiers */

    function _isAuthorised() internal view {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "onlyAdmin");
    }

    modifier onlyAdmin() {
        _isAuthorised();
        _;
    }
}
