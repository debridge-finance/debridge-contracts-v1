// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

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
        bool exists; //Delegator exists in oracle mapping
    }

    struct StakeDepositInfo {
        uint256 stakedAmount; // total tokens staked by oracle/delegator
        uint256 shares; // total share of collateral tokens, or totalShares if oracle
    }

    struct UserInfo { // info of validator or delegator
        mapping(address => StakeDepositInfo) stake; // amount of stake and shares per collateral
        mapping(address => uint256) accTokensPerShare; // accumulated reward tokens per share
        mapping(address => uint256) passedRewards; // rewards per collateral address, calculated before stake
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
        mapping(address => uint256) totalDelegation; // total delegated to oracle per collateral
        uint256 delegatorCount; //delegator count
    }

    struct Collateral {
        uint256 confiscatedFunds; // total confiscated tokens
        uint256 totalLocked; // total staked tokens
        uint256 maxStakeAmount; // maximum stake for each collateral
        uint8 decimals;
        bool isSupported;
        bool isUSDStable;
        bool isEnabled;
        bool isEnabledMaxAmount;
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
        require(
            collateral.isEnabled,
            "stake: collateral is not enabled"
        );
        require(
            !collateral.isEnabledMaxAmount || 
            collateral.isEnabledMaxAmount && collateral.totalLocked+_amount <= collateral.maxStakeAmount, 
            "stake: amount of collateral staking is limited"
        );

        UserInfo storage sender = getUserInfo[msg.sender];
        if (!sender.isOracle && sender.admin == address(0)) 
            sender.admin = msg.sender;

        require(
            IERC20(_collateral).transferFrom(msg.sender, address(this), _amount),
            "stake: transfer failed"
        );
        collateral.totalLocked += _amount;
        if (!sender.isOracle && msg.sender != oracle.admin) {
            require(oracle.isOracle, "stake: only delegation to oracle");
            DelegatorInfo storage delegator = oracle.delegators[msg.sender];
            if (!oracle.delegators[msg.sender].exists) {
                oracle.delegatorAddresses[oracle.delegatorCount] = msg.sender;
                oracle.delegatorCount++;
                oracle.delegators[msg.sender].exists = true;
            } else {
                // add user's pending rewards if delegator already exists
                for (uint256 i = 0; i < collateralAddresses.length; i++) {
                    address rewardCollateral;
                    uint256 pending = delegator.stakes[rewardCollateral].shares
                    * (oracle.accTokensPerShare[rewardCollateral])
                    - (sender.passedRewards[rewardCollateral]);
                    if (pending != 0) {
                        sender.passedRewards[rewardCollateral] = delegator.stakes[rewardCollateral].shares
                            * (oracle.accTokensPerShare[rewardCollateral]);
                        uint256 pendingShares = (pending*oracle.stake[rewardCollateral].shares) 
                            / oracle.totalDelegation[rewardCollateral];
                        oracle.totalDelegation[rewardCollateral] += pending;
                        oracle.stake[rewardCollateral].shares += pendingShares;
                        sender.stake[rewardCollateral].stakedAmount += pending;
                        sender.stake[rewardCollateral].shares += pendingShares;
                        delegator.stakes[rewardCollateral].stakedAmount += pending;
                        delegator.stakes[rewardCollateral].shares += pendingShares;
                    }
                }
            }
            oracle.totalDelegation[_collateral] += _amount;
            delegator.stakes[_collateral].stakedAmount += _amount;
            sender.stake[_collateral].stakedAmount += _amount;
            uint256 shares = oracle.stake[_collateral].shares > 0
                ? (_amount*oracle.stake[_collateral].shares)/oracle.totalDelegation[_collateral]
                : _amount;
            oracle.stake[_collateral].shares += shares;
            delegator.stakes[_collateral].shares += shares;
            // recalculate passed rewards with new share amount
            sender.passedRewards[_collateral] = delegator.stakes[_collateral].shares
                            * (oracle.accTokensPerShare[_collateral]);
            emit Staked(_oracle, msg.sender, _collateral, _amount);
        }
        else {
            require(msg.sender == oracle.admin, "stake: only callable by admin");
            oracle.stake[_collateral].stakedAmount += _amount;
            emit Staked(_oracle, msg.sender, _collateral, _amount);
        }
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
        Collateral storage collateral = collaterals[_collateral];
        require(
            collateral.isEnabled,
            "requestUnstake: collateral is not enabled"
        );
        collateral.totalLocked -= _amount;
        UserInfo storage sender = getUserInfo[msg.sender];
        // TODO: this "if" oracle/delegator logic needs to be improved - difficult to test
        if (!sender.isOracle && msg.sender != oracle.admin) {
            DelegatorInfo storage delegator = oracle.delegators[msg.sender];
            require(delegator.exists, "requestUnstake: delegator does not exist");
            require(msg.sender == sender.admin, "requestUnstake: only callable by admin");
            require(delegator.stakes[_collateral].stakedAmount >= _amount, "requestUnstake: insufficient amount");
            delegator.stakes[_collateral].stakedAmount -= _amount;
            sender.stake[_collateral].stakedAmount -= _amount;
            uint256 shares = (_amount*oracle.stake[_collateral].shares)/
                oracle.totalDelegation[_collateral];
            // TODO: maybe also change _amount to be shares rather than tokens (as in withdrawFromStrategy)
            // TODO: then credit pending rewards, or withdraw if rewardCollateral == _collateral
            for (uint256 i = 0; i < collateralAddresses.length; i++) {
                address rewardCollateral = collateralAddresses[i];
                uint256 rewardAmount = (shares * oracle.accTokensPerShare[rewardCollateral]) 
                    - sender.passedRewards[rewardCollateral];
                if (rewardAmount != 0) {
                    sender.passedRewards[rewardCollateral] = delegator.stakes[rewardCollateral].shares
                            * (oracle.accTokensPerShare[rewardCollateral]);
                    uint256 rewardShares = (rewardAmount*oracle.stake[rewardCollateral].shares) 
                        / oracle.totalDelegation[rewardCollateral];
                    oracle.totalDelegation[rewardCollateral] += rewardAmount;
                    oracle.stake[rewardCollateral].shares += rewardShares;
                    sender.stake[rewardCollateral].stakedAmount += rewardAmount;
                    sender.stake[rewardCollateral].shares += rewardShares;
                    delegator.stakes[rewardCollateral].stakedAmount += rewardAmount;
                    delegator.stakes[rewardCollateral].shares += rewardShares;
                }
            }
            oracle.stake[_collateral].shares -= shares;
            delegator.stakes[_collateral].shares -= shares;
            sender.stake[_collateral].shares -= shares;
            oracle.totalDelegation[_collateral] -= _amount;

            // recalculate passed rewards with new share amount
            sender.passedRewards[_collateral] = delegator.stakes[_collateral].shares
                * (oracle.accTokensPerShare[_collateral]);

            sender.withdrawals[sender.withdrawalCount] = WithdrawalInfo(
                _amount,
                block.timestamp + timelock,
                _recipient,
                false,
                false,
                0,
                _collateral
            );
            sender.withdrawalCount++;
            emit UnstakeRequested(msg.sender, _collateral, _recipient, _amount);
        }
        else {
            require(msg.sender == oracle.admin, "requestUnstake: only callable by admin");
            require(
                oracle.stake[_collateral].stakedAmount >= _amount,
                "requestUnstake: insufficient withdrawable funds"
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
        UserInfo storage oracle = getUserInfo[_oracle];
        require(
            oracle.admin == msg.sender,
            "executeUnstake: only callable by admin"
        );
        require(
            _withdrawalId < oracle.withdrawalCount,
            "executeUnstake: withdrawal does not exist"
        );
        WithdrawalInfo storage withdrawal = oracle.withdrawals[_withdrawalId];
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
     * @param _amount Amount of collateral
     */
    function requestTransfer(address _oracleFrom, address _oracleTo, address _collateral, uint256 _amount) external {
        require(_amount > 0, "requestTransfer: cannot transfer 0 amount");
        UserInfo storage oracleFrom = getUserInfo[_oracleFrom];
        Collateral memory collateral = collaterals[_collateral];
        require(
            collateral.isEnabled,
            "requestTransfer: collateral is not enabled"
        );
        UserInfo storage sender = getUserInfo[msg.sender];
        DelegatorInfo storage delegator = oracleFrom.delegators[msg.sender];
        require(sender.isOracle == false, "requestTransfer: callable by delegator");
        require(oracleFrom.totalDelegation[_collateral] >= _amount, "transferAssets: Insufficient amount");
        require(delegator.stakes[_collateral].stakedAmount >= _amount, "transferAssets: Insufficient amount for delegator");
        uint256 sharesFrom = (_amount*oracleFrom.stake[_collateral].shares)/
            oracleFrom.totalDelegation[_collateral];
        // TODO: maybe change _amount to be shares here too
        // TODO: claim delegator share of oracleFrom rewards - duplicated in requestUnstake so pull out to function
        for (uint256 i = 0; i < collateralAddresses.length; i++) {
            address rewardCollateral = collateralAddresses[i];
            uint256 rewardAmount = (sharesFrom * oracleFrom.accTokensPerShare[rewardCollateral]) 
                - sender.passedRewards[rewardCollateral];
            if (rewardAmount != 0) {
                sender.passedRewards[rewardCollateral] = delegator.stakes[rewardCollateral].shares
                    * (oracleFrom.accTokensPerShare[rewardCollateral]);
                uint256 rewardShares = (rewardAmount*oracleFrom.stake[rewardCollateral].shares) 
                    / oracleFrom.totalDelegation[rewardCollateral];
                oracleFrom.stake[rewardCollateral].shares += rewardShares;
                oracleFrom.totalDelegation[rewardCollateral] += rewardAmount;
                sender.stake[rewardCollateral].stakedAmount += rewardAmount;
                sender.stake[rewardCollateral].shares += rewardShares;
                delegator.stakes[rewardCollateral].stakedAmount += rewardAmount;
                delegator.stakes[rewardCollateral].shares += rewardShares;
            }
        }
        oracleFrom.totalDelegation[_collateral] -= _amount;
        oracleFrom.stake[_collateral].shares -= sharesFrom;
        sender.stake[_collateral].shares -= sharesFrom;
        sender.stake[_collateral].stakedAmount -= _amount;
        delegator.stakes[_collateral].shares -= sharesFrom;
        delegator.stakes[_collateral].stakedAmount -= _amount;

        // recalculate passed rewards with new share amount
        sender.passedRewards[_collateral] = delegator.stakes[_collateral].shares
            * (oracleFrom.accTokensPerShare[_collateral]);
        
        sender.transfers[sender.transferCount] = TransferInfo(
            _amount,
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
            "executeTransfer: callable by delegator"
        );
        require(sender.transferCount > _transferId, "executeTransfer: transfer request does not exist");
        TransferInfo storage transfer = sender.transfers[_transferId];
        require(!transfer.executed, "executeTransfer: already executed");
        require(
            transfer.timelock < block.timestamp,
            "executeTransfer: too early"
        );
        transfer.executed = true;
        UserInfo storage oracleTo = getUserInfo[transfer.oracleTo];
        DelegatorInfo storage delegator = oracleTo.delegators[msg.sender];
        oracleTo.totalDelegation[transfer.collateral] += transfer.amount;
        uint256 sharesTo = oracleTo.stake[transfer.collateral].shares > 0
            ? (transfer.amount*oracleTo.stake[transfer.collateral].shares)/
                oracleTo.totalDelegation[transfer.collateral]
            : transfer.amount;
        // recalculate passed rewards with new share amount
        sender.passedRewards[transfer.collateral] = delegator.stakes[transfer.collateral].shares
            * (oracleTo.accTokensPerShare[transfer.collateral]);
        sender.stake[transfer.collateral].stakedAmount += transfer.amount;
        sender.stake[transfer.collateral].shares += sharesTo;
        delegator.stakes[transfer.collateral].stakedAmount += transfer.amount;
        delegator.stakes[transfer.collateral].shares += sharesTo;
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
        IStrategy strategyController = IStrategy(_strategy);
        require(strategy.isEnabled, "depositgetPricePerFullShareToStrategy: strategy is not enabled");
        require(strategy.totalShares > 0, "getPricePerFullShare: strategy has no shares");
        uint256 totalStrategyTokenReserves = strategyController.updateReserves(address(this), _token);
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
        require(oracle.isOracle, "getPricePerFullOracleShare: address is not oracle");
        require(oracle.stake[_token].shares > 0, "getPricePerFullOracleShare: oracle has no shares");
        return oracle.totalDelegation[_token]/oracle.stake[_token].shares;
    }

    /**
     * @dev Get USD amount of oracle collateral
     * @param _oracle Address of oracle
     * @param _collateral Address of collateral
     */
    function getPoolUSDAmount(address _oracle, address _collateral) internal view returns(uint256) {
        uint256 collateralPrice;
        if (collaterals[_collateral].isUSDStable)
            collateralPrice = 10 ** (18 - collaterals[_collateral].decimals);
        else collateralPrice = priceConsumer.getPriceOfToken(_collateral);
        return getUserInfo[_oracle].totalDelegation[_collateral]*collateralPrice;
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
        require(msg.sender == oracle.admin, "depositToStrategy: only callable by admin");
        Strategy storage strategy = strategies[_strategy];
        IStrategy strategyController = IStrategy(_strategy);
        require(strategy.isEnabled, "depositToStrategy: strategy is not enabled");
        Collateral storage stakeCollateral = collaterals[strategy.stakeToken];
        require(oracle.stake[strategy.stakeToken].stakedAmount >= _amount, 
            "depositToStrategy: Insufficient fund");
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
    function withdrawFromStrategy(address _oracle, uint256 _amount, address _strategy) external {
        Strategy storage strategy = strategies[_strategy];
        require(strategy.isEnabled, "withdrawFromStrategy: strategy is not enabled");
        IStrategy strategyController = IStrategy(_strategy);
        UserInfo storage oracle = getUserInfo[_oracle];
        UserInfo storage sender = getUserInfo[msg.sender];
        DelegatorInfo storage delegator = oracle.delegators[msg.sender];
        uint256 delegatorCollateral;
        bool isDelegator;
        uint256 beforeBalance = strategyController.updateReserves(address(this), strategy.stakeToken);
        StrategyDepositInfo storage depositInfo;
        if (oracle.isOracle) {
            require (msg.sender == oracle.admin, "withdrawFromStrategy: only callable by admin");
            depositInfo = oracle.strategyStake[_strategy][strategy.stakeToken];
        }
        else {
            require(delegator.exists, "withdrawFromStrategy: delegator does not exist");
            isDelegator = true;
            depositInfo = sender.strategyStake[_strategy][strategy.stakeToken];
            delegatorCollateral = _amount * beforeBalance / strategy.totalShares;
        }
        require(depositInfo.shares >= _amount, 
                "withdrawFromStrategy: Insufficient share");
        { // scope to avoid stack too deep errors
        uint256 strategyTokenAmount = (_amount*strategy.totalReserves)/strategy.totalShares; // block scope
        depositInfo.shares -= _amount;
        strategy.totalShares -= _amount;
        strategy.totalReserves = strategyController.updateReserves(address(this), strategy.strategyToken);
        strategyController.withdraw(strategy.strategyToken, strategyTokenAmount);
        }
        uint256 receivedAmount = strategyController.updateReserves(address(this), strategy.stakeToken) - beforeBalance;
        depositInfo.stakedAmount -= receivedAmount;
        collaterals[strategy.stakeToken].totalLocked += receivedAmount;
        if (isDelegator) {
            sender.stake[strategy.stakeToken].stakedAmount += receivedAmount;
            uint256 shares = ((receivedAmount - delegatorCollateral)*oracle.stake[strategy.stakeToken].shares)/
                oracle.totalDelegation[strategy.stakeToken];
            sender.stake[strategy.stakeToken].shares += shares;
            delegator.stakes[strategy.stakeToken].stakedAmount += receivedAmount;
            delegator.stakes[strategy.stakeToken].shares += shares;
            oracle.totalDelegation[strategy.stakeToken] += receivedAmount - delegatorCollateral;
            oracle.stake[strategy.stakeToken].shares += shares;
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
        require(strategy.isEnabled, "emergencyWithdrawFromStrategy: strategy is not enabled");
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
        require(!strategy.isEnabled, "recoverFromEmergency: strategy is still enabled");
        require(strategy.isRecoverable, "recoverFromEmergency: strategy funds are not recoverable");
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
        require(msg.sender == oracle.admin, "setProfitPercentage: only callable by admin");
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
     * @param _isEnabledMaxAmount bool of enable
     * @param _amount max amount
     */
    function updateCollateral(address _collateral, bool _isEnabledMaxAmount, uint256 _amount) external onlyAdmin() {
        collaterals[_collateral].isEnabledMaxAmount = _isEnabledMaxAmount;
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
            "executeUnstake: only callable by admin"
        );
        WithdrawalInfo storage withdrawal = oracle.withdrawals[_withdrawalId];
        require(!withdrawal.executed, "cancelUnstake: already executed");
        Collateral storage collateral = collaterals[withdrawal.collateral];
        withdrawal.executed = true;
        oracle.stake[withdrawal.collateral].stakedAmount += withdrawal.amount;
        collateral.totalLocked += withdrawal.amount;
        emit UnstakeCancelled(_oracle, _withdrawalId);
    }

    /// @dev Withdraws confiscated tokens.
    /// @param _oracle Oracle address.
    /// @param _collateral Index of collateral
    /// @param _amount Amount to withdraw.
    function liquidate(address _oracle, address _collateral, uint256 _amount) external onlyAdmin() {
        UserInfo storage oracle = getUserInfo[_oracle];
        require(oracle.stake[_collateral].stakedAmount >= _amount, "liquidate: insufficient balance");
        Collateral storage collateral = collaterals[_collateral];
        oracle.stake[_collateral].stakedAmount -= _amount;
        collateral.confiscatedFunds += _amount;
        collateral.totalLocked -= _amount;
        emit Liquidated(_oracle, _collateral, _amount);
    }

    /// @dev Withdraws confiscated tokens.
    /// @param _recipient Recepient reward.
    /// @param _amount Amount to withdraw.
    function withdrawFunds(address _recipient, address _collateral, uint256 _amount)
        external
        onlyAdmin()
    {
        Collateral storage collateral = collaterals[_collateral];
        require(
            uint256(collateral.confiscatedFunds) >= _amount,
            "withdrawFunds: insufficient reserve funds"
        );
        require(
            IERC20(_collateral).transfer(_recipient, _amount),
            "withdrawFunds: transfer failed"
        );
        collateral.confiscatedFunds -= _amount;
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
        require(
            collateral.isEnabled, 
            "distributeRewards: collateral is not enabled"
        );
        require(
            IERC20(_collateral).transferFrom(msg.sender, address(this), _amount),
            "distributeRewards: transfer failed"
        );
        collateral.totalLocked += _amount;
        UserInfo storage oracle = getUserInfo[_oracle];
        uint256 delegatorsAmount = _amount * oracle.profitSharing / 100;
        oracle.stake[_collateral].stakedAmount += _amount - delegatorsAmount;
        for (uint256 i = 0; i < collateralAddresses.length; i++) {
            uint256 accTokens = delegatorsAmount * 
                getPoolUSDAmount(_oracle, collateralAddresses[i]) / 
                getTotalUSDAmount(_oracle);
            oracle.accTokensPerShare[collateralAddresses[i]] += 
                accTokens/oracle.stake[collateralAddresses[i]].shares;
            if (address(collateralAddresses[i]) == _collateral) {
                // TODO: maybe don't increment here, wait until claimed in stake/unstake/requestTransfer
                // oracle.totalDelegation[_collateral] += delegatorsAmount;
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
     * @dev get stake property of oracle
     * @param _oracle address of oracle
     * @param _collateral Address of collateral
     */
    function getOracleStaking(address _oracle, address _collateral) public view returns (uint256) {
        return getUserInfo[_oracle].stake[_collateral].stakedAmount;
    }

    /**
     * @dev get delegator stakes
     * @param _oracle address of oracle
     * @param _delegator address of delegator
     * @param _collateral Address of collateral
     */
    function getDelegatorStakes(address _oracle, address _delegator, address _collateral) public view returns(uint256) {
        return getUserInfo[_oracle].delegators[_delegator].stakes[_collateral].stakedAmount;
    }

    /**
     * @dev Get delegator shares of oracle collateral
     * @param _oracle address of oracle
     * @param _delegator address of delegator
     * @param _collateral Address of collateral
     */
    function getDelegatorShares(address _oracle, address _delegator, address _collateral) 
        public 
        view 
        returns(uint256) 
    {
        return getUserInfo[_oracle].delegators[_delegator].stakes[_collateral].shares;
    }

    /**
     * @dev Get total delegation to oracle
     * @param _oracle Address of oracle
     * @param _collateral Address of collateral
     */
    function getTotalDelegation(address _oracle, address _collateral) public view returns(uint256) {
        return getUserInfo[_oracle].totalDelegation[_collateral];
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
