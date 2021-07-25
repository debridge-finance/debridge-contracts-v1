// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
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
        mapping(address => uint256) passedRewards; // rewards per collateral address, calculated before stake
        bool exists; //Delegator exists in oracle mapping
    }

    struct StakeDepositInfo {
        uint256 stakedAmount; // total tokens staked by oracle/delegator
        uint256 shares; // total share of collateral tokens
    }

    struct UserInfo { // info of validator or delegator
        //TODO: we don't need stake. We can't sum shares from different oracles!
        mapping(address => StakeDepositInfo) stake; // amount of stake and shares per collateral
        mapping(address => uint256) accTokensPerShare; // accumulated reward tokens per share
        // mapping(address => uint256) passedRewards; // rewards per collateral address, calculated before stake
        mapping(address => mapping(address => StrategyDepositInfo)) strategyStake;
        address admin; // current oracle admin
        uint256 withdrawalCount; // withdrawals count
        uint256 transferCount;
        mapping(uint256 => WithdrawalInfo) withdrawals; // list of withdrawal requests
        mapping(uint256 => TransferInfo) transfers;
        uint256 profitSharing;  // percentage of profit sharing.
        bool isOracle; // whether is oracles
        mapping(address => DelegatorInfo) delegators;
        mapping(uint256 => address) delegatorAddresses; //delegator list
        mapping(address => StakeDepositInfo) delegation; // total delegated to oracle and total shares per collateral
        uint256 delegatorCount; //delegator count

        // Collateral has reward in other collateral
        // mapping(address => mapping(address => uint256)) dependsReward;
        // Collateral's accumulated reward per shares in other collateral
        mapping(address => mapping(address => uint256)) dependsAccTokensPerShare;
        //TODO: can add rewards(address => uint256) just to show user full rewards accumulated, also can add global (show all protocol rewards)
    }

    struct Collateral {
        uint256 confiscatedFunds; // total confiscated tokens
        uint256 totalLocked; // total staked tokens
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
    }

    struct StrategyDepositInfo {
        uint256 stakedAmount; // total tokens deposited by user
        uint256 shares; // total share of strategy tokens (e.g. aToken)
    }

    mapping(address => UserInfo) public getUserInfo; // oracle address => oracle details
    uint256 public timelock; // duration of withdrawal timelock
    uint256 public timelockForDelegate = 2 weeks;
    mapping(address => Collateral) public collaterals;
    address[] public collateralAddresses;
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
    event DepositedToStrategy(address oracle, uint256 amount, address strategy, address collateral);
    event WithdrawnFromStrategy(address oracle, uint256 amount, address strategy, address collateral);
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

    /// @dev stack collateral to oracle.
    /// @param _oracle Oracle address.
    /// @param _collateral address of collateral
    /// @param _amount Amount to withdraw.
    function stake(address _oracle, address _collateral, uint256 _amount) external {
        UserInfo storage oracle = getUserInfo[_oracle];
        Collateral storage collateral = collaterals[_collateral];
        require( collateral.isEnabled, "Collateral disabled" );
        require(collateral.totalLocked+_amount <= collateral.maxStakeAmount,
            "Collateral staking limited"
        );

        UserInfo storage sender = getUserInfo[msg.sender];
        if (//!sender.isOracle &&
            sender.admin == address(0))
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
                ? (_amount * oracle.delegation[_collateral].shares) / oracle.delegation[_collateral].stakedAmount
                : _amount;

            //Update users passedRewards
            for (uint256 i = 0; i < collateralAddresses.length; i++) {
                address rewardCollateral = collateralAddresses[i];

                uint256 pendingReward = delegator.stakes[rewardCollateral].shares
                                    * oracle.accTokensPerShare[rewardCollateral]
                                    / 1e18;
                                    // minus in 184 line
                                    // - delegator.passedRewards[rewardCollateral];
                uint256 dependencyRewards;
                //Find dependency rewards
                for(uint256 k = 0; k < collateralAddresses.length; k++)
                {
                    if(k != i) {
                          dependencyRewards +=
                                delegator.stakes[collateralAddresses[k]].shares
                                * oracle.dependsAccTokensPerShare[collateralAddresses[k]][rewardCollateral]
                                / 1e18; //TODO: check decimals in contract. we need to set 1e6 for USDT
                    }
                }
                pendingReward = pendingReward + dependencyRewards - delegator.passedRewards[rewardCollateral];
                if (pendingReward > 0) {
                    uint256 pendingShares = pendingReward
                                            * oracle.delegation[rewardCollateral].shares
                                            / oracle.delegation[rewardCollateral].stakedAmount;
                    oracle.delegation[rewardCollateral].stakedAmount += pendingReward;
                    oracle.delegation[rewardCollateral].shares += pendingShares;
                    //TODO: we don't need stake. We can't sum shares from different oracles!
                    // sender.stake[rewardCollateral].stakedAmount += pendingReward;
                    // sender.stake[rewardCollateral].shares += pendingShares;
                    delegator.stakes[rewardCollateral].stakedAmount += pendingReward;
                    delegator.stakes[rewardCollateral].shares += pendingShares;
                }

                //We need to sum _amount before to recalculate new passedRewards
                if(rewardCollateral == _collateral)
                {
                    oracle.delegation[_collateral].stakedAmount += _amount;
                    delegator.stakes[_collateral].stakedAmount += _amount;
                    // sender.stake[_collateral].stakedAmount += _amount;

                    oracle.delegation[_collateral].shares += shares;
                    delegator.stakes[_collateral].shares += shares;
                }

                // accumulated token per share for current collateral
                delegator.passedRewards[rewardCollateral] = delegator.stakes[rewardCollateral].shares 
                                * oracle.accTokensPerShare[rewardCollateral] 
                                / 1e18
                                + dependencyRewards;
                // calculated dependencyRewards before
                // // accumulated token per share for collateral that exists reward in rewardCollateral
                // for(uint256 k = 0; k < collateralAddresses.length; k++)
                // {
                //     if(k != i) {
                //         delegator.passedRewards[rewardCollateral] +=
                //                 delegator.stakes[collateralAddresses[k]].shares
                //                 * oracle.dependsAccTokensPerShare[collateralAddresses[k]][rewardCollateral]
                //                 / 1e18;
                //     }
                // }
            }
        }
        else {
            oracle.stake[_collateral].stakedAmount += _amount;
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
        collaterals[_collateral].totalLocked -= _amount;
        UserInfo storage sender = getUserInfo[msg.sender];
        if (msg.sender != oracle.admin) {
            DelegatorInfo storage delegator = oracle.delegators[msg.sender];
            require(delegator.exists, "requestUnstake: delegator !exist");
            require(msg.sender == sender.admin, "requestUnstake: only admin");
            require(delegator.stakes[_collateral].shares >= _amount, "requestUnstake: bad share");
            // if called by delegator then _amount represents their share to withdraw
            uint256 delegatorCollateral = _amount * oracle.delegation[_collateral].stakedAmount
                / oracle.delegation[_collateral].shares;
            sender.stake[_collateral].stakedAmount -= delegatorCollateral;
            sender.stake[_collateral].shares -= _amount;
            delegator.stakes[_collateral].stakedAmount -= delegatorCollateral;
            delegator.stakes[_collateral].shares -= _amount;
            oracle.delegation[_collateral].shares -= _amount;
            oracle.delegation[_collateral].stakedAmount -= delegatorCollateral;
            uint256 _shares;
            for (uint256 i = 0; i < collateralAddresses.length; i++) {
                address rewardCollateral = collateralAddresses[i];
                _shares = rewardCollateral == _collateral
                    ? _amount
                    : delegator.stakes[rewardCollateral].shares;
                uint256 rewardAmount = (_shares * oracle.accTokensPerShare[rewardCollateral])
                    - sender.passedRewards[rewardCollateral];
                if (rewardAmount != 0) {
                    sender.passedRewards[rewardCollateral] = delegator.stakes[rewardCollateral].shares
                            * (oracle.accTokensPerShare[rewardCollateral]);
                    uint256 rewardShares = (rewardAmount*oracle.delegation[rewardCollateral].shares)
                        / oracle.delegation[rewardCollateral].stakedAmount;
                    if (rewardCollateral == _collateral) {
                        delegatorCollateral += rewardAmount;
                    } else {
                        oracle.delegation[rewardCollateral].stakedAmount += rewardAmount;
                        oracle.delegation[rewardCollateral].shares += rewardShares;
                        sender.stake[rewardCollateral].stakedAmount += rewardAmount;
                        sender.stake[rewardCollateral].shares += rewardShares;
                        delegator.stakes[rewardCollateral].stakedAmount += rewardAmount;
                        delegator.stakes[rewardCollateral].shares += rewardShares;
                        // recalculate passed rewards with new share amount
                        sender.passedRewards[rewardCollateral] = delegator.stakes[_collateral].shares
                            * (oracle.accTokensPerShare[_collateral]);
                    }
                }
            }

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
                oracle.stake[_collateral].stakedAmount >= _amount,
                "requestUnstake: bad amount"
            );
            oracle.stake[_collateral].stakedAmount -= _amount;

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
        require(oracleFrom.stake[_collateral].shares >= _sharesFrom, "transferAssets: bad oracle share");
        require(delegator.stakes[_collateral].shares >= _sharesFrom, "transferAssets: bad shares");
        uint256 amountFrom = _sharesFrom * oracleFrom.delegation[_collateral].stakedAmount
            / oracleFrom.stake[_collateral].shares;
        uint256 _shares;
        for (uint256 i = 0; i < collateralAddresses.length; i++) {
            address rewardCollateral = collateralAddresses[i];
            _shares = rewardCollateral == _collateral
                ? _sharesFrom
                : delegator.stakes[rewardCollateral].shares;
            uint256 rewardAmount = (_shares * oracleFrom.accTokensPerShare[rewardCollateral])
                - sender.passedRewards[rewardCollateral];
            if (rewardAmount != 0) {
                sender.passedRewards[rewardCollateral] = delegator.stakes[rewardCollateral].shares
                    * (oracleFrom.accTokensPerShare[rewardCollateral]);
                uint256 rewardShares = (rewardAmount*oracleFrom.stake[rewardCollateral].shares)
                    / oracleFrom.delegation[rewardCollateral].stakedAmount;
                if (rewardCollateral == _collateral) {
                        amountFrom += rewardAmount;
                } else {
                    oracleFrom.delegation[rewardCollateral].stakedAmount += rewardAmount;
                    oracleFrom.stake[rewardCollateral].shares += rewardShares;
                    sender.stake[rewardCollateral].stakedAmount += rewardAmount;
                    sender.stake[rewardCollateral].shares += rewardShares;
                    delegator.stakes[rewardCollateral].stakedAmount += rewardAmount;
                    delegator.stakes[rewardCollateral].shares += rewardShares;
                    // recalculate passed rewards with new share amount
                    sender.passedRewards[rewardCollateral] = delegator.stakes[_collateral].shares
                        * (oracleFrom.accTokensPerShare[_collateral]);
                }
            }
        }
        oracleFrom.delegation[_collateral].stakedAmount -= amountFrom;
        oracleFrom.stake[_collateral].shares -= _sharesFrom;
        sender.stake[_collateral].shares -= _sharesFrom;
        sender.stake[_collateral].stakedAmount -= amountFrom;
        delegator.stakes[_collateral].shares -= _sharesFrom;
        delegator.stakes[_collateral].stakedAmount -= amountFrom;

        // recalculate passed rewards with new share amount
        sender.passedRewards[_collateral] = delegator.stakes[_collateral].shares
            * (oracleFrom.accTokensPerShare[_collateral]);

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
        uint256 sharesTo = oracleTo.stake[transfer.collateral].shares > 0
            ? (transfer.amount*oracleTo.stake[transfer.collateral].shares)/
                oracleTo.delegation[transfer.collateral].stakedAmount
            : transfer.amount;
        sender.stake[transfer.collateral].stakedAmount += transfer.amount;
        sender.stake[transfer.collateral].shares += sharesTo;
        delegator.stakes[transfer.collateral].stakedAmount += transfer.amount;
        delegator.stakes[transfer.collateral].shares += sharesTo;
        // recalculate passed rewards with new share amount
        sender.passedRewards[transfer.collateral] = delegator.stakes[transfer.collateral].shares
            * (oracleTo.accTokensPerShare[transfer.collateral]);
        emit TransferExecuted(msg.sender, _transferId);
    }

    /**
     * @dev Get price per share
     * @param _strategy Address of strategy
     * @param _token Address of token
     */
    function getPricePerFullShare(address _strategy, address _token)
    external
    view
    returns (uint256)
    {
        Strategy memory strategy = strategies[_strategy];
        require(strategy.totalShares > 0, "getPPFS: strategy has no shares");
        uint256 totalStrategyTokenReserves = IStrategy(_strategy).updateReserves(address(this), _token);
        return totalStrategyTokenReserves/strategy.totalShares;
    }

    /**
     * @dev Get price per oracle share
     * @param _oracle Address of oracle
     * @param _token Address of token
     */
    function getPricePerFullOracleShare(address _oracle, address _token)
    external
    view
    returns (uint256)
    {
        UserInfo storage oracle = getUserInfo[_oracle];
        require(oracle.isOracle, "getPPFOS: address is not oracle");
        require(oracle.delegation[_token].shares > 0, "getPPFOS: oracle has no shares");
        return oracle.delegation[_token].stakedAmount/oracle.delegation[_token].shares;
    }

    /**
     * @dev Get USD amount of oracle collateral
     * @param _oracle Address of oracle
     * @param _collateral Address of collateral
     */
    function getPoolUSDAmount(address _oracle, address _collateral) internal view returns(uint256) {
        uint256 collateralPrice;
        if (collaterals[_collateral].isUSDStable)
            collateralPrice =  10 ** (18+(18 - collaterals[_collateral].decimals));//We don't suppport decimals greater then 18
            //for decimals 6 will be 1e24
            //for decimals 18 will be 1e18
        else collateralPrice = priceConsumer.getPriceOfToken(_collateral);//TODO: check that decimals is 18
        return getUserInfo[_oracle].delegation[_collateral].stakedAmount*collateralPrice/1e18;//TODO: check decimals (added /1e18)
    }

    /**
     * @dev Get total USD amount of oracle collateral
     * @param _oracle Address of oracle
     */
    function getTotalUSDAmount(address _oracle) internal view returns(uint256) {
        uint256 totalUSDAmount = 0;
        for (uint256 i = 0; i < collateralAddresses.length; i++) {
            totalUSDAmount += getPoolUSDAmount(_oracle, collateralAddresses[i]);
        }
        return totalUSDAmount;
    }

    /**
     * @dev Stake token to strategies to earn rewards
     * @param _oracle address of oracle
     * @param _amount Amount to be staked
     * @param _strategy strategy to stake into.
     */
    function depositToStrategy(address _oracle, uint256 _amount, address _strategy) external {
        UserInfo storage oracle = getUserInfo[_oracle];
        require(msg.sender == oracle.admin, "depositToStrategy: only admin");
        Strategy storage strategy = strategies[_strategy];
        IStrategy strategyController = IStrategy(_strategy);
        require(strategy.isEnabled, "depositToStrategy: !enabled");
        Collateral storage stakeCollateral = collaterals[strategy.stakeToken];
        require(oracle.stake[strategy.stakeToken].stakedAmount >= _amount,
            "depositToStrategy: bad amount");
        IERC20(strategy.stakeToken).safeApprove(address(strategyController), 0);
        IERC20(strategy.stakeToken).safeApprove(address(strategyController), _amount);
        oracle.stake[strategy.stakeToken].stakedAmount -= _amount;
        strategy.totalReserves = strategyController.updateReserves(address(this), strategy.strategyToken);
        strategyController.deposit(strategy.stakeToken, _amount);
        uint256 afterBalance = strategyController.updateReserves(address(this), strategy.strategyToken);
        uint256 receivedAmount = afterBalance - strategy.totalReserves;
        uint256 shares = strategy.totalShares > 0
            ? (receivedAmount*strategy.totalShares)/strategy.totalReserves
            : receivedAmount;
        strategy.totalShares += shares;
        strategy.totalReserves = strategyController.updateReserves(address(this), strategy.strategyToken);
        StrategyDepositInfo storage depositInfo = oracle.strategyStake[_strategy][strategy.stakeToken];
        depositInfo.stakedAmount += _amount;
        depositInfo.shares += shares;
        stakeCollateral.totalLocked -= _amount;
        emit DepositedToStrategy(_oracle, _amount, _strategy, strategy.stakeToken);
    }

    /**
     * @dev Earn from the strategy
     */
    function withdrawFromStrategy(address _oracle, uint256 _shares, address _strategy) external {
        Strategy storage strategy = strategies[_strategy];
        require(strategy.isEnabled, "withdrawFromStrategy: !enabled");
        IStrategy strategyController = IStrategy(_strategy);
        UserInfo storage oracle = getUserInfo[_oracle];
        UserInfo storage sender = getUserInfo[msg.sender];
        DelegatorInfo storage delegator = oracle.delegators[msg.sender];
        uint256 delegatorCollateral;
        bool isDelegator;
        uint256 beforeBalance = strategyController.updateReserves(address(this), strategy.stakeToken);
        StrategyDepositInfo storage depositInfo;
        if (oracle.isOracle) {
            require (msg.sender == oracle.admin, "withdrawFromStrategy: only admin");
            depositInfo = oracle.strategyStake[_strategy][strategy.stakeToken];
        }
        else {
            require(delegator.exists, "wFromStrategy: delegator !exist");
            isDelegator = true;
            depositInfo = sender.strategyStake[_strategy][strategy.stakeToken];
            delegatorCollateral = _shares * beforeBalance / strategy.totalShares;
        }
        require(depositInfo.shares >= _shares,
                "withdrawFromStrategy: bad share");
        { // scope to avoid stack too deep errors
            uint256 strategyTokenAmount = (_shares*strategy.totalReserves)/strategy.totalShares; // block scope
            depositInfo.shares -= _shares;
            strategy.totalShares -= _shares;
            strategy.totalReserves = strategyController.updateReserves(address(this), strategy.strategyToken);
            strategyController.withdraw(strategy.strategyToken, strategyTokenAmount);
        }
        uint256 receivedAmount = strategyController.updateReserves(address(this), strategy.stakeToken) - beforeBalance;
        depositInfo.stakedAmount -= receivedAmount;
        collaterals[strategy.stakeToken].totalLocked += receivedAmount;
        if (isDelegator) {
            sender.stake[strategy.stakeToken].stakedAmount += receivedAmount;
            uint256 shares = ((receivedAmount - delegatorCollateral)*oracle.delegation[strategy.stakeToken].shares)/
                oracle.delegation[strategy.stakeToken].stakedAmount;
            sender.stake[strategy.stakeToken].shares += shares;
            delegator.stakes[strategy.stakeToken].stakedAmount += receivedAmount;
            delegator.stakes[strategy.stakeToken].shares += shares;
            oracle.delegation[strategy.stakeToken].stakedAmount += receivedAmount - delegatorCollateral;
            oracle.delegation[strategy.stakeToken].shares += shares;
            emit WithdrawnFromStrategy(msg.sender, receivedAmount, _strategy, strategy.stakeToken);
        }
        else emit WithdrawnFromStrategy(_oracle, receivedAmount, _strategy, strategy.stakeToken);
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

    function recoverFromEmergency(address _strategy, address[] calldata _oracles) external {
        Strategy storage strategy = strategies[_strategy];
        require(!strategy.isEnabled, "recoverFromEmergency: strategy still enabled");
        require(strategy.isRecoverable, "recoverFromEmergency: strategy funds not recoverable");
        Collateral storage stakeCollateral = collaterals[strategy.stakeToken];
        for (uint256 i=0; i<_oracles.length; i++) {
            UserInfo storage oracle = getUserInfo[_oracles[i]];
            StrategyDepositInfo storage depositInfo = oracle.strategyStake[_strategy][strategy.stakeToken];
            uint256 amount = strategy.totalReserves*(depositInfo.shares/strategy.totalShares);
            strategy.totalShares -= depositInfo.shares;
            depositInfo.shares = 0;
            depositInfo.stakedAmount = 0;
            strategy.totalReserves -= amount;
            oracle.stake[strategy.stakeToken].stakedAmount += amount;
            stakeCollateral.totalLocked += amount;
            emit RecoveredFromEmergency(_oracles[i], amount, _strategy, strategy.stakeToken);
        }
    }

    /**
     * @dev set percentage of profit sharing
     * @param _profitSharing percentage of profit sharing
     */
    function setProfitSharing(address _oracle, uint256 _profitSharing) external {
        UserInfo storage oracle = getUserInfo[_oracle];
        require(msg.sender == oracle.admin, "setProfitPercentage: only admin");
        require(_profitSharing<= 100, "Must be less then 100%" );
        oracle.profitSharing = _profitSharing;
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
     * @dev enable collateral max amount
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
        oracle.stake[withdrawal.collateral].stakedAmount += withdrawal.amount;
        collaterals[withdrawal.collateral].totalLocked += withdrawal.amount;
        emit UnstakeCancelled(_oracle, _withdrawalId);
    }

    /// @dev Withdraws confiscated tokens.
    /// @param _oracle Oracle address.
    /// @param _collateral Index of collateral
    /// @param _amount Amount to withdraw.
    function liquidate(address _oracle, address _collateral, uint256 _amount) external onlyAdmin() {
        UserInfo storage oracle = getUserInfo[_oracle];
        require(oracle.stake[_collateral].stakedAmount >= _amount, "liquidate: insufficient balance");
        oracle.stake[_collateral].stakedAmount -= _amount;
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
        //TODO: we can keep reward separately
        collateral.totalLocked += _amount;
        //collateral.rewards +=_amount;

        UserInfo storage oracle = getUserInfo[_oracle];
        uint256 delegatorsAmount = _amount * oracle.profitSharing / 100;

        //Add rewards to oracle
        oracle.stake[_collateral].stakedAmount += _amount - delegatorsAmount;

        // // rewards collateral mint shares
        // uint256 mintRewardShares = oracle.delegation[_collateral].stakedAmount > 0
        //         ? (delegatorsAmount*oracle.delegation[_collateral].shares)/oracle.delegation[_collateral].stakedAmount
        //         : delegatorsAmount;

        // //Add delegators amount in oracles collateral pool
        // oracle.delegation[_collateral].stakedAmount += delegatorsAmount;
        // //Add shares in oracles collateral pool
        // oracle.delegation[_collateral].shares += mintRewardShares;


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
                oracle.accTokensPerShare[currentCollateral] += accTokens * 1e18 / oracle.delegation[currentCollateral].shares; //TODO: check decimals (added *1e18)
            } else {
                //Add a reward pool dependency
                // oracle.dependsReward[currentCollateral][_collateral] += accTokens;
                oracle.dependsAccTokensPerShare[currentCollateral][_collateral] += accTokens * 1e18 / oracle.delegation[currentCollateral].shares; //TODO: check decimals (added *1e18)
            }
        }
        emit RewardsDistributed(_oracle, _collateral, _amount);
    }

    /// @dev Get withdrawal request.
    /// @param _oracle Oracle address.
    /// @param _withdrawalId Withdrawal identifier.
    function getWithdrawalRequest(address _oracle, uint256 _withdrawalId)
        public
        view
        returns (WithdrawalInfo memory)
    {
        return getUserInfo[_oracle].withdrawals[_withdrawalId];
    }

    /**
     * @dev Get transfer request
     * @param _oracle Oracle address
     * @param _transferId Transfer identifier
     */
    function getTransferRequest(address _oracle, uint256 _transferId)
        public
        view
        returns (TransferInfo memory)
    {
        return getUserInfo[_oracle].transfers[_transferId];
    }

    /**
     * @dev get stake property of oracle, returns stakedAmount and shares
     * @param _oracle address of oracle
     * @param _collateral Address of collateral
     */
    function getOracleStaking(address _oracle, address _collateral) public view returns (uint256, uint256) {
        return (
            getUserInfo[_oracle].stake[_collateral].stakedAmount,
            getUserInfo[_oracle].stake[_collateral].shares
        );
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

    function min(uint256 a, uint256 b) internal pure returns(uint256) {
        return a < b ? a : b;
    }

    /* modifiers */

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "onlyAdmin: bad role");
        _;
    }
}
