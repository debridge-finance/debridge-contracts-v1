// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStrategyController.sol";
import "../interfaces/IPriceConsumer.sol";

contract OracleManager is Ownable {

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

    struct OracleInfo { // info of validator or delegator
        mapping(address => uint256) stake; // amount of stake per collateral
        address admin; // current oracle admin
        uint256 withdrawalCount; // withdrawals count
        uint256 transferCount;
        mapping(uint256 => WithdrawalInfo) withdrawals; // list of withdrawal requests
        mapping(uint256 => TransferInfo) transfers;
        uint256 profitSharing;  // percentage of profit sharing.
        uint256 usdAmountOfDelegation;
        bool isOracle; // whether is oracles
        bool isAbleToDelegate;
        mapping(address => mapping(address => uint256)) delegatorStakes; // delegator stakes per collateral
        mapping(address => uint256) delegatorUSDAmounts;
        mapping(uint256 => address) delegators; //delegator list
        uint256 delegatorCount; //delegator count
    }

    struct Collateral {
        uint256 confiscatedFunds; // total confiscated tokens
        uint256 totalLocked; // total staked tokens
        bool isSupported;
        bool isUSDStable;
        bool isEnabled;
    }

    struct Strategy {
        bool isSupported;
        bool isEnabled;
        address stakeToken;
        address rewardToken;
    }

    mapping(address => OracleInfo) public getOracleInfo; // oracle address => oracle details
    uint256 public timelock; // duration of withdrawal timelock
    uint256 public timelockForDelegate = 2 weeks;
    mapping(address => Collateral) public collaterals;
    address[] public collateralAddresses;
    mapping(address => Strategy) public strategies;
    address[] public strategyAddresses;
    IStrategyController public strategyController;
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
    event WithdrawedFromStrategy(address oracle, uint256 amount, address strategy, address collateral);
    event WithdrawedFunds(address recipient, address collateral, uint256 amount);
    event TransferRequested(address delegator, uint256 transferId);
    event TransferExecuted(address delegator, uint256 transferId);

    /* PUBLIC */

    /// @dev Constructor that initializes the most important configurations.
    /// @param _timelock Duration of withdrawal timelock.
    constructor(uint256 _timelock, IStrategyController _strategyController, IPriceConsumer _priceConsumer) Ownable() {
        timelock = _timelock;
        strategyController = _strategyController;
        priceConsumer = _priceConsumer;
    }

    /// @dev Withdraws oracle reward.
    /// @param _oracle Oracle address.
    /// @param _collateral address of collateral
    /// @param _amount Amount to withdraw.
    function stake(address _oracle, address _collateral, uint256 _amount) external {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        Collateral storage collateral = collaterals[_collateral];
        require(
            collateral.isSupported,
            "stake: undefined collateral"
        );

        uint256 totalUSDAmount = 0;
        for (uint256 i = 0; i < oracle.delegatorCount; i ++) {
            address delegator = oracle.delegators[i];
            totalUSDAmount += oracle.delegatorUSDAmounts[delegator];
        }
        OracleInfo storage sender = getOracleInfo[msg.sender];
        if (sender.isOracle == false && msg.sender != oracle.admin) {
            uint256 collateralPrice;
            if (collaterals[_collateral].isUSDStable)
                collateralPrice = 1;
            else collateralPrice = priceConsumer.getPriceOfToken(_collateral);
            require(totalUSDAmount + collateralPrice * _amount <= oracle.usdAmountOfDelegation, "stake: amount of delegation is limited");
        }

        require(
            IERC20(_collateral).transferFrom(msg.sender, address(this), _amount),
            "stake: transfer failed"
        );
        oracle.stake[_collateral] += _amount;
        collateral.totalLocked += _amount;
        if (sender.isOracle == false && msg.sender != oracle.admin) {
            oracle.delegators[oracle.delegatorCount] = msg.sender;
            oracle.delegatorCount ++;
            oracle.delegatorStakes[msg.sender][_collateral] += _amount;
            uint256 price;
            if (collateral.isUSDStable)
                price = 1;
            else price = priceConsumer.getPriceOfToken(_collateral);
            oracle.delegatorUSDAmounts[msg.sender] += _amount * price;
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
        OracleInfo storage oracle = getOracleInfo[_oracle];
        if (_amount == 0) {
            return;
        }
        Collateral storage collateral = collaterals[_collateral];
        require(
            collateral.isSupported,
            "requestUnstake: undefined collateral"
        );
        uint256 available = oracle.stake[_collateral];
        require(
            available >= _amount,
            "requestUnstake: insufficient withdrawable funds"
        );
        OracleInfo storage sender = getOracleInfo[msg.sender];
        if (sender.isOracle == false && msg.sender != oracle.admin) {
            require(oracle.delegatorStakes[msg.sender][_collateral] >= _amount, "requestUnstake: insufficient amount");
            oracle.delegatorStakes[msg.sender][_collateral] -= _amount;
            uint256 price;
            if (collateral.isUSDStable)
                price = 1;
            else price = priceConsumer.getPriceOfToken(_collateral);
            oracle.delegatorUSDAmounts[msg.sender] = price * _amount;
        }
        else require(msg.sender == oracle.admin, "requestUnstake: only callable by admin");

        oracle.stake[_collateral] = available - _amount;
        collateral.totalLocked -= _amount;

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
        OracleInfo storage oracleFrom = getOracleInfo[_oracleFrom];
        OracleInfo storage oracleTo = getOracleInfo[_oracleTo];

        Collateral memory collateral = collaterals[_collateral];
        require(
            collateral.isSupported,
            "requestUnstake: undefined collateral"
        );
        OracleInfo storage sender = getOracleInfo[msg.sender];
        require(sender.isOracle == false, "requestTransfer: callable by delegator");
        require(oracleFrom.stake[_collateral] >= _amount, "transferAssets: Insufficient amount");
        require(oracleFrom.delegatorStakes[msg.sender][_collateral] >= _amount, "transferAssets: Insufficient amount for delegator");
        oracleFrom.stake[_collateral] -= _amount;
        oracleTo.stake[_collateral] += _amount;
        oracleFrom.delegatorStakes[msg.sender][_collateral] -= _amount;
        oracleTo.delegatorStakes[msg.sender][_collateral] += _amount;
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
        OracleInfo storage sender = getOracleInfo[msg.sender];

        require(
            sender.isOracle == false,
            "executeTransfer: callable by delegator"
        );
        require(sender.transferCount > _transferId, "executeTransfer: transfer request not exist");
        TransferInfo storage transfer = sender.transfers[_transferId];
        require(!transfer.executed, "executeTransfer: already executed");
        require(
            transfer.timelock < block.timestamp,
            "executeTransfer: too early"
        );
        transfer.executed = true;
        emit TransferExecuted(msg.sender, _transferId);
    }

    /**
     * @dev Stake token to strategies to earn rewards
     * @param _oracle address of oracle
     * @param _amount Amount to be staked
     * @param _strategy strategy to stake into.
     */
    function depositToStrategy(address _oracle, uint256 _amount, address _strategy) external {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        require(msg.sender == oracle.admin, "depositToStrategy: only callable by admin");
        Strategy memory strategy = strategies[_strategy];
        require(strategy.isSupported, "depositToStrategy: strategy is not supported");
        Collateral storage stakeCollateral = collaterals[strategy.stakeToken];
        require(oracle.stake[strategy.stakeToken] >= _amount, "depositToStrategy: Insufficient fund");
        // strategyController.deposit(_strategy, address(collateral.token), _amount);
        oracle.stake[strategy.stakeToken] -= _amount;
        emit DepositedToStrategy(_oracle, _amount, _strategy, strategy.stakeToken);
    }

    /**
     * @dev Earn from the strategy
     */
    function withdrawFromStrategy(address _oracle, uint256 _amount, address _strategy) external {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        require(msg.sender == oracle.admin, "depositToStrategy: only callable by admin");
        Strategy memory strategy = strategies[_strategy];
        require(strategy.isSupported, "depositToStrategy: strategy is not supported");
        Collateral storage collateral = collaterals[strategy.rewardToken];
        // strategyController.withdraw(_strategy, address(collateral.token), _amount);
        oracle.stake[strategy.rewardToken] += _amount;
        emit WithdrawedFromStrategy(_oracle, _amount, _strategy, strategy.rewardToken);
    }

    /**
     * @dev set percentage of profit sharing
     * @param _profitSharing percentage of profit sharing
     */
    function setProfitSharing(address _oracle, uint256 _profitSharing) external {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        require(msg.sender == oracle.admin, "setProfitPercentage: only callable by admin");
        oracle.profitSharing = _profitSharing;
    }

    /**
     * @dev set usd amount of delegation
     * @param _oracle address of oracle
     * @param _usdAmountOfDelegation usd amount of delegation
     */
    function setUsdAmountOfDelegation(address _oracle, uint256 _usdAmountOfDelegation) external {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        require(msg.sender == oracle.admin, "setProfitPercentage: only callable by admin");
        oracle.usdAmountOfDelegation = _usdAmountOfDelegation;
    }

    /* ADMIN */

    /// @dev Change withdrawal timelock.
    /// @param _newTimelock New timelock.
    function setTimelock(uint256 _newTimelock) external onlyOwner() {
        timelock = _newTimelock;
    }

    /**
     * @dev Change timelock for delegate
     * @param _newTimelock new timelock for delegate
     */
    function setTimelockForTransfer(uint256 _newTimelock) external onlyOwner() {
        timelockForDelegate = _newTimelock;
    }

    /// @dev Add new oracle.
    /// @param _oracle Oracle address.
    /// @param _admin Admin address.
    function addOracle(address _oracle, address _admin) external onlyOwner() {
        getOracleInfo[_oracle].admin = _admin;
        getOracleInfo[_oracle].isOracle = true;
    }

    /// @dev Add new delegator.
    /// @param _delegator Oracle address.
    function addDelegator(address _delegator) external onlyOwner() {
        getOracleInfo[_delegator].admin = _delegator;
        getOracleInfo[_delegator].isOracle = false;
    }

    /**
     * @dev Add a new collateral
     * @param _token Address of token
     */
    function addCollateral(address _token, bool _isUSDStable) external onlyOwner() {
        if (!collaterals[_token].isSupported){
            collaterals[_token].isSupported = true;
            collaterals[_token].isEnabled = true;
            collaterals[_token].isUSDStable = _isUSDStable;
            collateralAddresses.push(_token);
        }
    }

    /**
     * @dev Add a new strategy
     * @param _strategy address to strategy
     * @param _stakeToken collateralId of stakeToken
     * @param _rewardToken collateralId of rewardToken 
     */
    function addStrategy(address _strategy, address _stakeToken, address _rewardToken) external onlyOwner() {
        Strategy storage strategy = strategies[_strategy];
        require(!strategy.isSupported, "addStrategy: already exist");
        strategy.stakeToken = _stakeToken;
        strategy.rewardToken = _rewardToken;
        strategy.isSupported = true;
        strategy.isEnabled = true;
        strategyAddresses.push(_strategy);
    }

    /**
     * @dev enable collateral
     * @param _collateral address of collateral
     */
    function enableCollateral(address _collateral) external onlyOwner() {
        collaterals[_collateral].isEnabled = true;
    }

    /**
     * @dev disable collateral
     * @param _collateral address of collateral
     */
    function disableCollateral(address _collateral) external onlyOwner() {
        collaterals[_collateral].isEnabled = false;
    }

    /**
     * @dev enable strategy
     * @param _strategy address of strategy
     */
    function enableStrategy(address _strategy) external onlyOwner() {
        strategies[_strategy].isEnabled = true;
    }

    /**
     * @dev enable collateral
     * @param _strategy address of strategy
     */
    function disableStrategy(address _strategy) external onlyOwner() {
        collaterals[_strategy].isEnabled = false;
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
        Collateral storage collateral = collaterals[withdrawal.collateral];
        withdrawal.executed = true;
        oracle.stake[withdrawal.collateral] += withdrawal.amount;
        collateral.totalLocked += withdrawal.amount;
        emit UnstakeCancelled(_oracle, _withdrawalId);
    }

    /// @dev Withdraws confiscated tokens.
    /// @param _oracle Oracle address.
    /// @param _collateral Index of collateral
    /// @param _amount Amount to withdraw.
    function liquidate(address _oracle, address _collateral, uint256 _amount) external onlyOwner() {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        require(oracle.stake[_collateral] >= _amount, "liquidate: insufficient balance");
        Collateral storage collateral = collaterals[_collateral];
        oracle.stake[_collateral] -= _amount;
        collateral.confiscatedFunds += _amount;
        collateral.totalLocked -= _amount;
        emit Liquidated(_oracle, _collateral, _amount);
    }

    /// @dev Withdraws confiscated tokens.
    /// @param _recipient Recepient reward.
    /// @param _amount Amount to withdraw.
    function withdrawFunds(address _recipient, address _collateral, uint256 _amount)
        external
        onlyOwner()
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
        emit WithdrawedFunds(_recipient, _collateral, _amount);
    }

    /**
     * @dev Pause unstaking request.
     * @param _oracle address of oracle
     * @param _withdrawalId withdrawal identifier
     */
    function pauseUnstake(address _oracle, uint256 _withdrawalId) external onlyOwner() {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        uint256 i;
        for (i = 0; i < oracle.withdrawalCount; i ++) {
            WithdrawalInfo storage withdrawal = oracle.withdrawals[i];
            if (withdrawal.paused == false && withdrawal.executed == false) {
                withdrawal.paused = true;
                withdrawal.pausedTime = block.timestamp;
                emit UnstakePaused(_oracle, _withdrawalId, block.timestamp);
            }
        }
    }

    /**
     * @dev Resume unstaking request.
     * @param _oracle address of oracle
     * @param _withdrawalId withdrawal identifier
     */
    function resumeUnstake(address _oracle, uint256 _withdrawalId) external onlyOwner() {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        uint256 i;
        for (i = 0; i < oracle.withdrawalCount; i ++) {
            WithdrawalInfo storage withdrawal = oracle.withdrawals[_withdrawalId];
            if (withdrawal.paused == true && withdrawal.executed == false) {
                withdrawal.paused = false;
                withdrawal.timelock += block.timestamp - withdrawal.pausedTime;
                emit UnstakeResumed(_oracle, _withdrawalId, block.timestamp);
            }
        }
    }

    /**
     * @dev Set strategy controller
     * @param _strategyController address of strategy controller
     */
    function setStrategyController(IStrategyController _strategyController) external onlyOwner() {
        strategyController = _strategyController;
    }

    /**
     * @dev Set Price Consumer
     * @param _priceConsumer address of price consumer
     */
    function setPriceConsumer(IPriceConsumer _priceConsumer) external onlyOwner() {
        priceConsumer = _priceConsumer;
    }

    /**
     * @dev accounts add assets to oracle
     * @param _oracle address of oracle
     * @param _collateral collateralId oracle
     * @param _amount amount of token
     */
    function account_asset(address _oracle, address _collateral, uint256 _amount) public {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        uint256 share = _amount * oracle.profitSharing / 100;

        uint256 totalUSDAmount = 0;
        for (uint256 i = 0; i < oracle.delegatorCount; i ++) {
            address delegator = oracle.delegators[i];
            totalUSDAmount += oracle.delegatorUSDAmounts[delegator];
        }
        Collateral storage collateral = collaterals[_collateral];
        collateral.totalLocked += _amount;
        oracle.stake[_collateral] += _amount;
        if (totalUSDAmount != 0) {
            for (uint256 i = 0; i < oracle.delegatorCount; i ++) {
                address delegator = oracle.delegators[i];
                oracle.delegatorStakes[delegator][_collateral] += share * oracle.delegatorUSDAmounts[delegator] / totalUSDAmount;
            }
        }
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
     * @dev Get transfer request
     * @param _oracle Oracle address
     * @param _transferId Transfer identifier
     */
    function getTransferRequest(address _oracle, uint256 _transferId) 
        public
        view
        returns (TransferInfo memory)
    {
        return getOracleInfo[_oracle].transfers[_transferId];
    }

    /** 
     * @dev get stake property of oracle
     * @param _oracle address of oracle
     * @param _collateral Address of collateral
     */
    function getOracleStaking(address _oracle, address _collateral) public view returns (uint256) {
        return getOracleInfo[_oracle].stake[_collateral];
    }

    /**
     * @dev get delegator stakes
     * @param _oracle address of oracle
     * @param _delegator address of delegator
     * @param _collateral Address of collateral
     */
    function getDelegatorStakes(address _oracle, address _delegator, address _collateral) public view returns(uint256) {
        return getOracleInfo[_oracle].delegatorStakes[_delegator][_collateral];
    }

    function min(uint256 a, uint256 b) internal pure returns(uint256) {
        return a < b ? a : b;
    }
}
