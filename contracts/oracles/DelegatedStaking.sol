// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IPriceConsumer.sol";

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

    struct TransferInfo {
        uint256 amount; // amount of transfer token
        uint256 timelock; // time till the asset is locked
        address oracleFrom; // oracle that token is transferred from
        address oracleTo; // oracle that token is transferred to
        bool executed; // whether is executed
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
        uint256 transferCount;
        mapping(uint256 => WithdrawalInfo) withdrawals; // list of withdrawal requests
        mapping(uint256 => TransferInfo) transfers;
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
    uint256 public timelockForDelegate = 2 weeks;
    uint256 public constant BPS_DENOMINATOR = 10000; // Basis points, or bps, equal to 1/10000 used to express relative value
    uint256 public minProfitSharingBPS = 5000;
    mapping(address => Collateral) public collaterals;
    address[] public collateralAddresses;
    mapping(address => uint256) public accumulatedProtocolRewards;
    mapping(address => Strategy) public strategies;
    address[] public strategyAddresses;
    IPriceConsumer public priceConsumer;

    /* Events */
    event Staked(address oracle, address staker, address collateral, uint256 amount);
    event UnstakeRequested(address oracle, address collateral, address receipient, uint256 amount);
    event UnstakeExecuted(address oracle, uint256 withdrawalId);
    event UnstakeCancelled(address oracle, uint256 withdrawalId);
    event UnstakePaused(address oracle, uint256 withdrawalId, uint256 timestamp);
    event UnstakeResumed(address oracle, uint256 withdrawalId, uint256 timestamp);
    event Liquidated(address oracle, address collateral, uint256 amount);
    event DepositedToStrategy(address oracle, address staker, uint256 amount, address strategy, address collateral);
    event WithdrawnFromStrategy(address oracle, address staker, uint256 amount, address strategy, address collateral);
    event EmergencyWithdrawnFromStrategy(uint256 amount, address strategy, address collateral);
    event RecoveredFromEmergency(address oracle, uint256 amount, address strategy, address collateral);
    event RewardsDistributed(address oracle, address collateral, uint256 amount);
    event WithdrawnFunds(address recipient, address collateral, uint256 amount);
    event TransferRequested(address delegator, uint256 transferId);
    event TransferExecuted(address delegator, uint256 transferId);

    /* PUBLIC */

    /// @dev Initializer that initializes the most important configurations.
    /// @param _timelock Duration of withdrawal timelock.
    function initialize(uint256 _timelock, IPriceConsumer _priceConsumer) public initializer {
        // Grant the contract deployer the default admin role: it will be able
        // to grant and revoke any roles
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        timelock = _timelock;
        priceConsumer = _priceConsumer;
    }

    /// @dev stake collateral to oracle.
    /// @param _oracle Oracle address.
    /// @param _collateral address of collateral
    /// @param _amount Amount to stake.
    function stake(address _oracle, address _collateral, uint256 _amount) external {
        UserInfo storage oracle = getUserInfo[_oracle];
        Collateral storage collateral = collaterals[_collateral];
        require(collateral.isEnabled, "stake: collateral disabled" );
        require(collateral.totalLocked+_amount <= collateral.maxStakeAmount,
            "stake: collateral staking limited"
        );

        UserInfo storage sender = getUserInfo[msg.sender];
        if (sender.admin == address(0))
            sender.admin = msg.sender;

        IERC20(_collateral).safeTransferFrom( msg.sender, address(this), _amount);

        collateral.totalLocked += _amount;
        if (msg.sender != oracle.admin) {
            DelegatorInfo storage delegator = oracle.delegators[msg.sender];
            if (!delegator.exists) {
                oracle.delegatorAddresses[oracle.delegatorCount] = msg.sender;
                oracle.delegatorCount++;
                delegator.exists = true;
            }

            uint256 shares = oracle.delegation[_collateral].stakedAmount > 0
                ? _calculateShares(_amount, oracle.delegation[_collateral].shares,
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
            delegator.passedRewards[_collateral] = delegator.stakes[_collateral].shares 
                            * oracle.accTokensPerShare[_collateral] 
                            / 1e18
                            + dependencyRewards;
        }
        else {
            oracle.stake[_collateral] += _amount;
        }
        emit Staked(_oracle, msg.sender, _collateral, _amount);
    }

    /// @dev Withdraws oracle reward.
    /// @param _oracle Oracle address.
    /// @param _collateral Index of collateral
    /// @param _recipient Recepient reward.
    /// @param _amount Amount to withdraw.
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
            require(delegator.exists, "requestUnstake: delegator !exist");
            require(
                delegator.stakes[_collateral].shares
                - delegator.stakes[_collateral].locked
                >= _amount,
                "requestUnstake: bad share"
            );
            
            uint256 dependencyRewards = _creditDelegatorRewards(_oracle, msg.sender, _collateral);
            // if called by delegator then _amount represents their share to withdraw
            uint256 delegatorCollateral = _calculateFromShares(_amount, oracle.delegation[_collateral].stakedAmount,
                oracle.delegation[_collateral].shares);
            collaterals[_collateral].totalLocked -= delegatorCollateral;
            delegator.stakes[_collateral].stakedAmount -= delegatorCollateral;
            delegator.stakes[_collateral].shares -= _amount;
            oracle.delegation[_collateral].shares -= _amount;
            oracle.delegation[_collateral].stakedAmount -= delegatorCollateral;
            
            // recalculate passed rewards with new share amount
            delegator.passedRewards[_collateral] = delegator.stakes[_collateral].shares 
                            * oracle.accTokensPerShare[_collateral] 
                            / 1e18
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
            emit UnstakeRequested(msg.sender, _collateral, _recipient, delegatorCollateral);
        }
        else {
            // if called by oracle then _amount represents their collateral to withdraw
            require(
                oracle.stake[_collateral] - oracle.locked[_collateral] >= _amount,
                "requestUnstake: bad amount"
            );
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
            emit UnstakeRequested(_oracle, _collateral, _recipient, _amount);
        }
    }

    /// @dev Withdraw stake.
    /// @param _oracle Oracle address.
    /// @param _withdrawalId Withdrawal identifier.
    function executeUnstake(address _oracle, uint256 _withdrawalId) external {
        UserInfo storage user = getUserInfo[_oracle];
        require(
            user.admin == msg.sender,
            "executeUnstake: only admin"
        );
        require(
            _withdrawalId < user.withdrawalCount,
            "execUnstake: withdrawal !exist"
        );
        WithdrawalInfo storage withdrawal = user.withdrawals[_withdrawalId];
        require(!withdrawal.executed, "executeUnstake: already executed");
        require(
            withdrawal.timelock < block.timestamp,
            "executeUnstake: too early"
        );
        withdrawal.executed = true;
        require(
            IERC20(withdrawal.collateral).transfer(withdrawal.receiver, withdrawal.amount),
            "executeUnstake: transfer failed"
        );

        emit UnstakeExecuted(_oracle, _withdrawalId);
    }
    /**
     * @dev request to move assets between oracles
     * @param _oracleFrom Address of oracle sender
     * @param _oracleTo Address of oracle receiver
     * @param _collateral address of collateral
     * @param _sharesFrom Share of collateral
     */
    function requestTransfer(address _oracleFrom, address _oracleTo, address _collateral, uint256 _sharesFrom) external {
        require(_sharesFrom > 0, "requestTransfer: bad shares == 0");
        UserInfo storage oracleFrom = getUserInfo[_oracleFrom];
        require(
            collaterals[_collateral].isEnabled,
            "reqTransfer: collateral !enabled"
        );
        UserInfo storage sender = getUserInfo[msg.sender];
        DelegatorInfo storage delegator = oracleFrom.delegators[msg.sender];
        require(sender.isOracle == false, "requestTransfer: delegator only");
        require(oracleFrom.delegation[_collateral].shares >= _sharesFrom, "transferAssets: bad oracle share");
        require(delegator.stakes[_collateral].shares >= _sharesFrom, "transferAssets: bad shares");

        uint256 dependencyRewards = _creditDelegatorRewards(_oracleFrom, msg.sender, _collateral);
        uint256 amountFrom = _calculateFromShares(_sharesFrom, oracleFrom.delegation[_collateral].stakedAmount,
            oracleFrom.delegation[_collateral].shares);

        oracleFrom.delegation[_collateral].stakedAmount -= amountFrom;
        oracleFrom.delegation[_collateral].shares -= _sharesFrom;
        delegator.stakes[_collateral].shares -= _sharesFrom;
        delegator.stakes[_collateral].stakedAmount -= amountFrom;

        // recalculate passed rewards with new share amount
        delegator.passedRewards[_collateral] = delegator.stakes[_collateral].shares 
                        * oracleFrom.accTokensPerShare[_collateral] 
                        / 1e18
                        + dependencyRewards;

        sender.transfers[sender.transferCount] = TransferInfo(
            amountFrom,
            block.timestamp + timelockForDelegate,
            _oracleFrom,
            _oracleTo,
            false,
            _collateral
        );
        sender.transferCount ++;
        emit TransferRequested(msg.sender, sender.transferCount - 1);
    }

    /**
     * @dev Execute transfer request
     * @param _transferId Identifier of transfer
     */
    function executeTransfer(uint256 _transferId) external {
        UserInfo storage sender = getUserInfo[msg.sender];

        require(
            sender.isOracle == false,
            "executeTransfer: delegator only"
        );
        require(sender.transferCount > _transferId, "executeTransfer: request !exist");
        TransferInfo storage transfer = sender.transfers[_transferId];
        require(!transfer.executed, "execTransfer: already executed");
        require(
            transfer.timelock < block.timestamp,
            "executeTransfer: too early"
        );
        transfer.executed = true;
        UserInfo storage oracleTo = getUserInfo[transfer.oracleTo];
        DelegatorInfo storage delegator = oracleTo.delegators[msg.sender];
        oracleTo.delegation[transfer.collateral].stakedAmount += transfer.amount;
        uint256 sharesTo = oracleTo.delegation[transfer.collateral].shares > 0
            ? _calculateShares(transfer.amount, oracleTo.delegation[transfer.collateral].shares,
                oracleTo.delegation[transfer.collateral].stakedAmount)
            : transfer.amount;
        uint256 dependencyRewards = _creditDelegatorRewards(transfer.oracleTo, msg.sender, transfer.collateral);
        delegator.stakes[transfer.collateral].stakedAmount += transfer.amount;
        delegator.stakes[transfer.collateral].shares += sharesTo;
        // recalculate passed rewards with new share amount
        delegator.passedRewards[transfer.collateral] = delegator.stakes[transfer.collateral].shares
                        * oracleTo.accTokensPerShare[transfer.collateral]
                        / 1e18
                        + dependencyRewards;
        emit TransferExecuted(msg.sender, _transferId);
    }

    /**
     * @dev Stake token to strategies to earn rewards
     * @param _oracle address of oracle
     * @param _amount Amount to be staked
     * @param _strategy strategy to stake into.
     */
    function depositToStrategy(address _oracle, uint256 _amount, address _strategy) external {
        Strategy storage strategy = strategies[_strategy];
        IStrategy strategyController = IStrategy(_strategy);
        require(strategy.isEnabled, "depositToStrategy: !enabled");
        Collateral storage stakeCollateral = collaterals[strategy.stakeToken];
        UserInfo storage oracle = getUserInfo[_oracle];
        DelegatorInfo storage delegator = oracle.delegators[msg.sender];
        StrategyDepositInfo storage depositInfo;

        if (msg.sender != oracle.admin) {
            require(delegator.exists, "depositToStrat: delegator !exist");
            depositInfo = delegator.strategyStakes[_strategy][strategy.stakeToken];
            uint256 delegatorShares = _calculateShares(
                _amount,
                oracle.delegation[strategy.stakeToken].shares,
                oracle.delegation[strategy.stakeToken].stakedAmount
            );
            require(
                delegator.stakes[strategy.stakeToken].shares
                - delegator.stakes[strategy.stakeToken].locked
                >= delegatorShares,
                "depositToStrategy: bad amount"
            );
            delegator.stakes[strategy.stakeToken].locked += delegatorShares;
        }
        else {
            require(msg.sender == oracle.admin, "depositToStrategy: only admin");
            depositInfo = oracle.strategyStake[_strategy][strategy.stakeToken];
            require(oracle.stake[strategy.stakeToken] - oracle.locked[strategy.stakeToken] >= _amount,
                "depositToStrategy: bad amount");
            oracle.locked[strategy.stakeToken] += _amount;
        }
        IERC20(strategy.stakeToken).safeApprove(address(strategyController), 0);
        IERC20(strategy.stakeToken).safeApprove(address(strategyController), _amount);
        strategy.totalReserves = strategyController.updateReserves(address(this), strategy.strategyToken);
        strategyController.deposit(strategy.stakeToken, _amount);
        uint256 afterBalance = strategyController.updateReserves(address(this), strategy.strategyToken);
        uint256 receivedAmount = afterBalance - strategy.totalReserves;
        uint256 shares = strategy.totalShares > 0
            ? _calculateShares(receivedAmount, strategy.totalShares, strategy.totalReserves)
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
        require(strategy.isEnabled, "withdrawFromStrategy: !enabled");
        IStrategy strategyController = IStrategy(_strategy);
        UserInfo storage oracle = getUserInfo[_oracle];
        DelegatorInfo storage delegator = oracle.delegators[msg.sender];
        bool isDelegator;
        uint256 beforeBalance = strategyController.updateReserves(address(this), strategy.stakeToken);
        uint256 stakeCollateral = _calculateFromShares(_shares, beforeBalance, strategy.totalShares);
        StrategyDepositInfo storage depositInfo;

        if (msg.sender != oracle.admin) {
            require(delegator.exists, "wFromStrategy: delegator !exist");
            isDelegator = true;
            depositInfo = delegator.strategyStakes[_strategy][strategy.stakeToken];
        }
        else {
            require (msg.sender == oracle.admin, "withdrawFromStrategy: only admin");
            depositInfo = oracle.strategyStake[_strategy][strategy.stakeToken];
        }
        
        require(depositInfo.shares >= _shares,
                "withdrawFromStrategy: bad share");
        { // scope to avoid stack too deep errors
            uint256 strategyTokenAmount = _calculateFromShares(_shares, strategy.totalReserves, strategy.totalShares); // block scope
            depositInfo.shares -= _shares;
            depositInfo.stakedAmount -= stakeCollateral;
            strategy.totalShares -= _shares;
            strategy.totalReserves = strategyController.updateReserves(address(this), strategy.strategyToken);
            strategyController.withdraw(strategy.strategyToken, strategyTokenAmount);
        }
        uint256 receivedAmount = strategyController.updateReserves(address(this), strategy.stakeToken) - beforeBalance;
        collaterals[strategy.stakeToken].totalLocked += receivedAmount;
        uint256 rewardAmount = receivedAmount - stakeCollateral;
        collaterals[strategy.stakeToken].rewards += rewardAmount;
        strategy.rewards += rewardAmount;
        accumulatedProtocolRewards[strategy.stakeToken] += rewardAmount;
        if (isDelegator) {
            uint256 shares = oracle.delegation[strategy.stakeToken].stakedAmount > 0
            ? _calculateShares(rewardAmount, oracle.delegation[strategy.stakeToken].shares,
                oracle.delegation[strategy.stakeToken].stakedAmount)
            : rewardAmount;
            delegator.stakes[strategy.stakeToken].stakedAmount += rewardAmount;
            delegator.stakes[strategy.stakeToken].shares += shares;
            delegator.stakes[strategy.stakeToken].locked -= _calculateShares(
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
     * @dev Withdraws all funds from the strategy.
     * @param _strategy Strategy to withdraw from.
     */
    function emergencyWithdrawFromStrategy(address _strategy)
        external
        onlyAdmin()
    {
        Strategy storage strategy = strategies[_strategy];
        IStrategy strategyController = IStrategy(_strategy);
        require(strategy.isEnabled, "emergencyWithdrawFromStrategy: strategy not enabled");
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
     * @dev Recovers user share of all funds emergency withdrawn from the strategy.
     * @param _strategy Strategy to recover from.
     * @param _oracles Array of oracle addresses.
     */
    function recoverFromEmergency(address _strategy, address[] calldata _oracles) external {
        Strategy storage strategy = strategies[_strategy];
        require(!strategy.isEnabled, "recoverFromEmergency: strategy still enabled");
        require(strategy.isRecoverable, "recoverFromEmergency: strategy funds not recoverable");
        Collateral storage stakeCollateral = collaterals[strategy.stakeToken];
        for (uint256 i=0; i<_oracles.length; i++) {
            UserInfo storage oracle = getUserInfo[_oracles[i]];
            require(oracle.isOracle, "recoverFromEmergency: only oracle");
            StrategyDepositInfo storage depositInfo = oracle.strategyStake[_strategy][strategy.stakeToken];
            uint256 amount = _calculateFromShares(depositInfo.shares, strategy.totalReserves, strategy.totalShares);
            strategy.totalShares -= depositInfo.shares;
            depositInfo.shares = 0;
            depositInfo.stakedAmount = 0;
            strategy.totalReserves -= amount;
            oracle.locked[strategy.stakeToken] = 0;

            stakeCollateral.totalLocked += amount;
            emit RecoveredFromEmergency(_oracles[i], amount, _strategy, strategy.stakeToken);
            
            for (uint256 k=0; k<oracle.delegatorCount; k++) {
                DelegatorInfo storage delegator = oracle.delegators[oracle.delegatorAddresses[k]];
                depositInfo = delegator.strategyStakes[_strategy][strategy.stakeToken];
                amount = _calculateFromShares(depositInfo.shares, strategy.totalReserves, strategy.totalShares);
                strategy.totalShares -= depositInfo.shares;
                depositInfo.shares = 0;
                depositInfo.stakedAmount = 0;
                strategy.totalReserves -= amount;
                delegator.stakes[strategy.stakeToken].locked = 0;
                
                stakeCollateral.totalLocked += amount;
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
        require(msg.sender == oracle.admin, "setProfitPercentage: only admin");
        require(_profitSharingBPS >= minProfitSharingBPS, "Must be greater than min bps");
        require(_profitSharingBPS<= BPS_DENOMINATOR, "Must be less than 10,000 BPS" );
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

        require(collateral.isEnabled, "collateral disabled");
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

            if(currentCollateral==_collateral){
                //Increase accumulated rewards per share
                oracle.accTokensPerShare[currentCollateral] += accTokens * 1e18 / oracle.delegation[currentCollateral].shares;
            } else {
                //Add a reward pool dependency
                oracle.dependsAccTokensPerShare[currentCollateral][_collateral] += accTokens * 1e18 / oracle.delegation[currentCollateral].shares;
            }
        }
        emit RewardsDistributed(_oracle, _collateral, _amount);
    }

    /* ADMIN */

    /// @dev Change withdrawal timelock.
    /// @param _newTimelock New timelock.
    function setTimelock(uint256 _newTimelock) external onlyAdmin() {
        timelock = _newTimelock;
    }

    /**
     * @dev Change timelock for delegate
     * @param _newTimelock new timelock for delegate
     */
    function setTimelockForTransfer(uint256 _newTimelock) external onlyAdmin() {
        timelockForDelegate = _newTimelock;
    }

    /**
     * @dev set min basis points of profit sharing
     * @param _profitSharingBPS profit sharing basis points
     */
    function setMinProfitSharing(uint256 _profitSharingBPS) external onlyAdmin() {
        require(_profitSharingBPS<= BPS_DENOMINATOR, "Must be less than 10,000 BPS" );
        minProfitSharingBPS = _profitSharingBPS;
    }

    /// @dev Add new oracle.
    /// @param _oracle Oracle address.
    /// @param _admin Admin address.
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
     * @dev Add a new strategy
     * @param _strategy address to strategy
     * @param _stakeToken collateralId of stakeToken
     * @param _rewardToken collateralId of rewardToken
     */
    function addStrategy(address _strategy, address _stakeToken, address _rewardToken) external onlyAdmin() {
        Strategy storage strategy = strategies[_strategy];
        require(!strategy.isSupported, "addStrategy: already exists");
        strategy.stakeToken = _stakeToken;
        strategy.rewardToken = _rewardToken;
        strategy.isSupported = true;
        strategy.isEnabled = true;
        strategyAddresses.push(_strategy);
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
     * @dev enable strategy
     * @param _strategy address of strategy
     * @param _isEnabled bool of enable
     */
    function updateStrategy(address _strategy, bool _isEnabled) external onlyAdmin() {
        strategies[_strategy].isEnabled = _isEnabled;
    }

    /// @dev Cancel unstake.
    /// @param _oracle Oracle address.
    /// @param _withdrawalId Withdrawal identifier.
    function cancelUnstake(address _oracle, uint256 _withdrawalId)
        external
    {
        UserInfo storage oracle = getUserInfo[_oracle];
        require(
            oracle.admin == msg.sender,
            "executeUnstake: only admin"
        );
        WithdrawalInfo storage withdrawal = oracle.withdrawals[_withdrawalId];
        require(!withdrawal.executed, "cancelUnstake: already executed");
        withdrawal.executed = true;
        oracle.stake[withdrawal.collateral] += withdrawal.amount;
        collaterals[withdrawal.collateral].totalLocked += withdrawal.amount;
        emit UnstakeCancelled(_oracle, _withdrawalId);
    }

    /// @dev Withdraws confiscated tokens.
    /// @param _oracle Oracle address.
    /// @param _collateral Index of collateral
    /// @param _amount Amount to withdraw.
    function liquidate(address _oracle, address _collateral, uint256 _amount) external onlyAdmin() {
        UserInfo storage oracle = getUserInfo[_oracle];
        require(oracle.stake[_collateral] >= _amount, "liquidate: insufficient balance");
        oracle.stake[_collateral] -= _amount;
        collaterals[_collateral].confiscatedFunds += _amount;
        collaterals[_collateral].totalLocked -= _amount;
        emit Liquidated(_oracle, _collateral, _amount);
    }

    /// @dev Withdraws confiscated tokens.
    /// @param _recipient Recepient reward.
    /// @param _amount Amount to withdraw.
    function withdrawFunds(address _recipient, address _collateral, uint256 _amount)
        external
        onlyAdmin()
    {
        require(
            uint256(collaterals[_collateral].confiscatedFunds) >= _amount,
            "withdrawFunds: insufficient reserve funds"
        );
        require(
            IERC20(_collateral).transfer(_recipient, _amount),
            "withdrawFunds: transfer failed"
        );
        collaterals[_collateral].confiscatedFunds -= _amount;
        emit WithdrawnFunds(_recipient, _collateral, _amount);
    }

    /**
     * @dev Pause unstaking request.
     * @param _oracle address of oracle
     */
    function pauseUnstake(address _oracle) external onlyAdmin() {
        UserInfo storage oracle = getUserInfo[_oracle];
        uint256 i;
        for (i = 0; i < oracle.withdrawalCount; i ++) {
            WithdrawalInfo storage withdrawal = oracle.withdrawals[i];
            if (withdrawal.paused == false && withdrawal.executed == false) {
                withdrawal.paused = true;
                withdrawal.pausedTime = block.timestamp;
                emit UnstakePaused(_oracle, i, block.timestamp);
            }
        }
    }

    /**
     * @dev Resume unstaking request.
     * @param _oracle address of oracle
     */
    function resumeUnstake(address _oracle) external onlyAdmin() {
        UserInfo storage oracle = getUserInfo[_oracle];
        uint256 i;
        for (i = 0; i < oracle.withdrawalCount; i ++) {
            WithdrawalInfo storage withdrawal = oracle.withdrawals[i];
            if (withdrawal.paused == true && withdrawal.executed == false) {
                withdrawal.paused = false;
                withdrawal.timelock += block.timestamp - withdrawal.pausedTime;
                emit UnstakeResumed(_oracle, i, block.timestamp);
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
                uint256 pendingShares = _calculateShares(pendingReward, oracle.delegation[rewardCollateral].shares,
                                            oracle.delegation[rewardCollateral].stakedAmount);
                oracle.delegation[rewardCollateral].stakedAmount += pendingReward;
                oracle.delegation[rewardCollateral].shares += pendingShares;
                sender.accumulatedRewards[rewardCollateral] += pendingReward;
                delegator.stakes[rewardCollateral].stakedAmount += pendingReward;
                delegator.stakes[rewardCollateral].shares += pendingShares;
            }

            // accumulated token per share for current collateral
            delegator.passedRewards[rewardCollateral] = delegator.stakes[rewardCollateral].shares 
                            * oracle.accTokensPerShare[rewardCollateral] 
                            / 1e18
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
     * @dev Get price per share
     * @param _strategy Address of strategy
     * @param _collateral Address of collateral
     */
    function getPricePerFullStrategyShare(address _strategy, address _collateral)
        external
        view
        returns (uint256)
    {
        Strategy memory strategy = strategies[_strategy];
        require(strategy.totalShares > 0, "getPPFS: strategy has no shares");
        uint256 totalStrategyTokenReserves = IStrategy(_strategy).updateReserves(address(this), _collateral);
        return totalStrategyTokenReserves/strategy.totalShares;
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
        require(oracle.isOracle, "getPPFOS: address is not oracle");
        require(oracle.delegation[_collateral].shares > 0, "getPPFOS: oracle has no shares");
        return oracle.delegation[_collateral].stakedAmount/oracle.delegation[_collateral].shares;
    }

    /**
     * @dev Get USD amount of oracle collateral
     * @param _oracle Address of oracle
     * @param _collateral Address of collateral
     */
    function getPoolUSDAmount(address _oracle, address _collateral) public view returns(uint256) {
        uint256 collateralPrice;
        if (collaterals[_collateral].isUSDStable)
            collateralPrice = 1e18; // We don't suppport decimals greater than 18
            //for decimals 6 will be 1e24
            //for decimals 18 will be 1e18
        else collateralPrice = priceConsumer.getPriceOfToken(_collateral);
        return getUserInfo[_oracle].delegation[_collateral].stakedAmount*collateralPrice
            * 10 ** (collaterals[_collateral].decimals % 18);
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
        public
        view
        returns (WithdrawalInfo memory)
    {
        return getUserInfo[_user].withdrawals[_withdrawalId];
    }

    /**
     * @dev Get transfer request
     * @param _user User address
     * @param _transferId Transfer identifier
     */
    function getTransferRequest(address _user, uint256 _transferId)
        public
        view
        returns (TransferInfo memory)
    {
        return getUserInfo[_user].transfers[_transferId];
    }

    /**
     * @dev get stake property of oracle
     * @param _oracle address of oracle
     * @param _collateral Address of collateral
     */
    function getOracleStaking(address _oracle, address _collateral) public view returns (uint256) {
        return getUserInfo[_oracle].stake[_collateral];
    }

    /**
     * @dev get delegator stakes
     * @param _oracle address of oracle
     * @param _delegator address of delegator
     * @param _collateral Address of collateral
     */
    function getDelegatorStakes(address _oracle, address _delegator, address _collateral)
        public
        view
        returns(uint256, uint256)
    {
        return (
            getUserInfo[_oracle].delegators[_delegator].stakes[_collateral].stakedAmount,
            getUserInfo[_oracle].delegators[_delegator].stakes[_collateral].shares
        );
    }

    /**
     * @dev get user rewards
     * @param _user address of account
     * @param _collateral Address of collateral
     */
    function getUserRewards(address _user, address _collateral)
        public
        view
        returns(uint256)
    {
        return getUserInfo[_user].accumulatedRewards[_collateral];
    }

    /**
     * @dev get strategy rewards
     * @param _strategy address of strategy
     */
    function getStrategyRewards(address _strategy)
        public
        view
        returns(uint256)
    {
        return strategies[_strategy].rewards;
    }

    /**
     * @dev get protocol rewards
     * @param _collateral Address of collateral
     */
    function getProtocolRewards(address _collateral)
        public
        view
        returns(uint256)
    {
        return accumulatedProtocolRewards[_collateral];
    }

    /**
     * @dev Get total delegation to oracle, returns total delegation amount and total shares
     * @param _oracle Address of oracle
     * @param _collateral Address of collateral
     */
    function getTotalDelegation(address _oracle, address _collateral) public view returns(uint256, uint256) {
        return (
            getUserInfo[_oracle].delegation[_collateral].stakedAmount,
            getUserInfo[_oracle].delegation[_collateral].shares
        );
    }

    /**
     * @dev Get total stake to strategy, returns total reserve amount and total shares
     * @param _strategy Address of strategy
     */
    function getStrategyStakes(address _strategy) public view returns(uint256, uint256) {
        return (
            strategies[_strategy].totalReserves, 
            strategies[_strategy].totalShares
        );
    }

    /**
     * @dev Get total delegation to oracle
     * @param _oracle Address of oracle
     */
    function getDelegatorCount(address _oracle) public view returns(uint256) {
        return getUserInfo[_oracle].delegatorCount;
    }

    /**
     * @dev Get total delegation to oracle
     * @param _oracle Address of oracle
     */
    function doesDelegatorExist(address _oracle, address _delegator) public view returns(bool) {
        return getUserInfo[_oracle].delegators[_delegator].exists;
    }

    /**
     * @dev Get account admin address
     * @param _account Address of account
     */
    function getAccountAdmin(address _account) public view returns(address) {
        return getUserInfo[_account].admin;
    }

    /**
     * @dev Get account transfer count
     * @param _account Address of account
     */
    function getAccountTransferCount(address _account) public view returns(uint256) {
        return getUserInfo[_account].transferCount;
    }

    /* modifiers */

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "onlyAdmin: bad role");
        _;
    }
}
