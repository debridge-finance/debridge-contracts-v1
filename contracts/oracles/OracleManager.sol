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
        uint256 collateralId; // collateral identifier
    }

    struct TransferInfo {
        uint256 amount; // amount of transfer token
        uint256 timelock; // time till the asset is locked
        address oracleFrom; // oracle that token is transferred from
        address oracleTo; // oracle that token is transferred to
        bool executed; // whether is executed
        uint256 collateralId; // collateral identifier
    }

    struct OracleInfo { // info of validator or delegator
        mapping(uint256 => uint256) stake; // amount of stake per collateral
        address admin; // current oracle admin
        uint256 withdrawalCount; // withdrawals count
        uint256 transferCount;
        mapping(uint256 => WithdrawalInfo) withdrawals; // list of withdrawal requests
        mapping(uint256 => TransferInfo) transfers;
        uint256 profitSharing;  // percentage of profit sharing.
        uint256 usdAmountOfDelegation;
        bool isOracle; // whether is oracles
        bool isAbleToDelegate;
        mapping(address => mapping(uint256 => uint256)) delegatorStakes; // delegator stakes per collateral
        mapping(uint256 => address) delegators; //delegator list
        uint256 delegatorCount; //delegator count
    }

    struct Collateral {
        IERC20 token;
        uint256 confiscatedFunds; // total confiscated tokens
        uint256 totalLocked; // total staked tokens
    }

    struct Strategy {
        address strategy;
        uint256 stakeToken;
        uint256 rewardToken;
    }

    mapping(address => OracleInfo) public getOracleInfo; // oracle address => oracle details
    uint256 public timelock; // duration of withdrawal timelock
    uint256 public timelockForDelegate = 2 weeks;
    Collateral[] public collaterals;
    Strategy[] public strategies;
    IStrategyController public strategyController;
    IPriceConsumer public priceConsumer;

    /* Events */
    event Staked(address oracle, uint256 collateralId, uint256 amount);
    event UnstakeRequested(address oracle, uint256 collateralId, address receipient, uint256 amount);
    event UnstakeExecuted(address oracle, uint256 withdrawalId);
    event UnstakeCancelled(address oracle, uint256 withdrawalId);
    event UnstakePaused(address oracle, uint256 withdrawalId, uint256 timestamp);
    event UnstakeResumed(address oracle, uint256 withdrawalId, uint256 timestamp);
    event Liquidated(address oracle, uint256 collateralId, uint256 amount);
    event DepositedToStrategy(address oracle, uint256 amount, uint256 strategy, uint256 collateralId);
    event WithdrawedFromStrategy(address oracle, uint256 amount, uint256 strategy, uint256 collateralId);
    event WithdrawedFunds(address recipient, uint256 collateralId, uint256 amount);
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
    /// @param _collateralId Index of collateral
    /// @param _amount Amount to withdraw.
    function stake(address _oracle, uint256 _collateralId, uint256 _amount) external {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        require(
            _collateralId < collaterals.length,
            "stake: undefined collateral"
        );
        Collateral storage collateral = collaterals[_collateralId];

        uint256 totalUSDAmount = 0;
        for (uint256 i = 0; i < oracle.delegatorCount; i ++) {
            address delegator = oracle.delegators[i];
            for (uint256 j = 0; j < collaterals.length; j ++) {
                uint256 price = priceConsumer.getPriceOfToken(address(collaterals[j].token));
                totalUSDAmount += oracle.delegatorStakes[delegator][j] * price;
            }
        }
        OracleInfo storage sender = getOracleInfo[msg.sender];
        if (sender.isOracle == false && msg.sender != oracle.admin) {
            uint256 collateralPrice = priceConsumer.getPriceOfToken(address(collateral.token));
            require(totalUSDAmount + collateralPrice * _amount <= oracle.usdAmountOfDelegation, "stake: amount of delegation is limited");
        }

        require(
            collateral.token.transferFrom(msg.sender, address(this), _amount),
            "stake: transfer failed"
        );
        oracle.stake[_collateralId] += _amount;
        collateral.totalLocked += _amount;
        if (sender.isOracle == false && msg.sender != oracle.admin) {
            oracle.delegators[oracle.delegatorCount] = msg.sender;
            oracle.delegatorCount ++;
            oracle.delegatorStakes[msg.sender][_collateralId] += _amount;
        }
        emit Staked(_oracle, _collateralId, _amount);
    }

    /// @dev Withdraws oracle reward.
    /// @param _oracle Oracle address.
    /// @param _collateralId Index of collateral
    /// @param _recipient Recepient reward.
    /// @param _amount Amount to withdraw.
    function requestUnstake(
        address _oracle,
        uint256 _collateralId,
        address _recipient,
        uint256 _amount
    ) external {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        if (_amount == 0) {
            return;
        }
        require(
            _collateralId < collaterals.length,
            "requestUnstake: undefined collateral"
        );
        uint256 available = oracle.stake[_collateralId];
        require(
            available >= _amount,
            "requestUnstake: insufficient withdrawable funds"
        );
        OracleInfo storage sender = getOracleInfo[msg.sender];
        if (sender.isOracle == false && msg.sender != oracle.admin) {
            require(oracle.delegatorStakes[msg.sender][_collateralId] >= _amount, "requestUnstake: insufficient amount");
            oracle.delegatorStakes[msg.sender][_collateralId] -= _amount;
        }
        else require(msg.sender == oracle.admin, "requestUnstake: only callable by admin");

        Collateral storage collateral = collaterals[_collateralId];
        oracle.stake[_collateralId] = available - _amount;
        collateral.totalLocked -= _amount;

        oracle.withdrawals[oracle.withdrawalCount] = WithdrawalInfo(
            _amount,
            block.timestamp + timelock,
            _recipient,
            false,
            false,
            0,
            _collateralId
        );
        oracle.withdrawalCount++;
        emit UnstakeRequested(_oracle, _collateralId, _recipient, _amount);
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
        Collateral memory collateral = collaterals[withdrawal.collateralId];
        require(
            collateral.token.transfer(withdrawal.receiver, withdrawal.amount),
            "executeUnstake: transfer failed"
        );

        emit UnstakeExecuted(_oracle, _withdrawalId);
    }
    /**
     * @dev request to move assets between oracles
     * @param _oracleFrom Address of oracle sender
     * @param _oracleTo Address of oracle receiver
     * @param _collateralId Id of collateral
     * @param _amount Amount of collateral
     */
    function requestTransfer(address _oracleFrom, address _oracleTo, uint256 _collateralId, uint256 _amount) external {
        OracleInfo storage oracleFrom = getOracleInfo[_oracleFrom];
        OracleInfo storage oracleTo = getOracleInfo[_oracleTo];

        require(
            _collateralId < collaterals.length,
            "requestUnstake: undefined collateral"
        );
        OracleInfo storage sender = getOracleInfo[msg.sender];
        require(sender.isOracle == false, "requestTransfer: callable by delegator");
        require(oracleFrom.stake[_collateralId] >= _amount, "transferAssets: Insufficient amount");
        require(oracleFrom.delegatorStakes[msg.sender][_collateralId] >= _amount, "transferAssets: Insufficient amount for delegator");
        oracleFrom.stake[_collateralId] -= _amount;
        oracleTo.stake[_collateralId] += _amount;
        oracleFrom.delegatorStakes[msg.sender][_collateralId] -= _amount;
        oracleTo.delegatorStakes[msg.sender][_collateralId] += _amount;
        sender.transfers[sender.transferCount] = TransferInfo(
            _amount,
            block.timestamp + timelockForDelegate,
            _oracleFrom,
            _oracleTo,
            false,
            _collateralId
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
    function depositToStrategy(address _oracle, uint256 _amount, uint256 _strategy) external {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        require(msg.sender == oracle.admin, "depositToStrategy: only callable by admin");
        Strategy memory strategy = strategies[_strategy];
        Collateral storage collateral = collaterals[strategy.stakeToken];
        require(oracle.stake[strategy.stakeToken] >= _amount, "depositToStrategy: Insufficient fund");
        // strategyController.deposit(_strategy, address(collateral.token), _amount);
        oracle.stake[strategy.stakeToken] -= _amount;
        emit DepositedToStrategy(_oracle, _amount, _strategy, strategy.stakeToken);
    }

    /**
     * @dev Earn from the strategy
     */
    function withdrawFromStrategy(address _oracle, uint256 _amount, uint256 _strategy) external {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        require(msg.sender == oracle.admin, "depositToStrategy: only callable by admin");
        Strategy memory strategy = strategies[_strategy];
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
    function addCollateral(IERC20 _token) external onlyOwner() {
        for (uint256 i = 0; i < collaterals.length; i ++) {
            if (address(collaterals[i].token) == address(_token))
                return;
        }
        collaterals.push(Collateral(_token, 0, 0));
    }

    /**
     * @dev Add a new strategy
     * @param _strategy address to strategy
     * @param _stakeToken collateralId of stakeToken
     * @param _rewardToken collateralId of rewardToken 
     */
    function addStrategy(address _strategy, uint256 _stakeToken, uint256 _rewardToken) external onlyOwner() {
        strategies.push(Strategy(_strategy, _stakeToken, _rewardToken));
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
        Collateral storage collateral = collaterals[withdrawal.collateralId];
        withdrawal.executed = true;
        oracle.stake[withdrawal.collateralId] += withdrawal.amount;
        collateral.totalLocked += withdrawal.amount;
        emit UnstakeCancelled(_oracle, _withdrawalId);
    }

    /// @dev Withdraws confiscated tokens.
    /// @param _oracle Oracle address.
    /// @param _collateralId Index of collateral
    /// @param _amount Amount to withdraw.
    function liquidate(address _oracle, uint256 _collateralId, uint256 _amount) external onlyOwner() {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        require(oracle.stake[_collateralId] >= _amount, "liquidate: insufficient balance");
        Collateral storage collateral = collaterals[_collateralId];
        oracle.stake[_collateralId] -= _amount;
        collateral.confiscatedFunds += _amount;
        collateral.totalLocked -= _amount;
        emit Liquidated(_oracle, _collateralId, _amount);
    }

    /// @dev Withdraws confiscated tokens.
    /// @param _recipient Recepient reward.
    /// @param _amount Amount to withdraw.
    function withdrawFunds(address _recipient, uint256 _collateralId, uint256 _amount)
        external
        onlyOwner()
    {
        Collateral storage collateral = collaterals[_collateralId];
        require(
            uint256(collateral.confiscatedFunds) >= _amount,
            "withdrawFunds: insufficient reserve funds"
        );
        require(
            collateral.token.transfer(_recipient, _amount),
            "withdrawFunds: transfer failed"
        );
        collateral.confiscatedFunds -= _amount;
        emit WithdrawedFunds(_recipient, _collateralId, _amount);
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
     * @param _collateralId collateralId oracle
     * @param _amount amount of token
     */
    function account_asset(address _oracle, uint256 _collateralId, uint256 _amount) public {
        OracleInfo storage oracle = getOracleInfo[_oracle];
        uint256 share = _amount * oracle.profitSharing / 100;

        uint256 totalUSDAmount = 0;
        uint256[] memory usdAmountPerDelegator = new uint256[](oracle.delegatorCount);
        for (uint256 i = 0; i < oracle.delegatorCount; i ++) {
            address delegator = oracle.delegators[i];
            for (uint256 j = 0; j < collaterals.length; j ++) {
                uint256 price = priceConsumer.getPriceOfToken(address(collaterals[j].token));
                usdAmountPerDelegator[i] += oracle.delegatorStakes[delegator][j] * price;
            }
            totalUSDAmount += usdAmountPerDelegator[i];
        }
        Collateral storage collateral = collaterals[_collateralId];
        collateral.totalLocked += _amount;
        oracle.stake[_collateralId] += _amount;
        if (totalUSDAmount != 0) {
            for (uint256 i = 0; i < oracle.delegatorCount; i ++) {
                address delegator = oracle.delegators[i];
                oracle.delegatorStakes[delegator][_collateralId] += share * usdAmountPerDelegator[i] / totalUSDAmount;
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
     * @param _collateralId Index of collateral
     */
    function getOracleStaking(address _oracle, uint256 _collateralId) public view returns (uint256) {
        return getOracleInfo[_oracle].stake[_collateralId];
    }

    /**
     * @dev get delegator stakes
     * @param _oracle address of oracle
     * @param _delegator address of delegator
     * @param _collateralId Index of collateral
     */
    function getDelegatorStakes(address _oracle, address _delegator, uint256 _collateralId) public view returns(uint256) {
        return getOracleInfo[_oracle].delegatorStakes[_delegator][_collateralId];
    }

    function min(uint256 a, uint256 b) internal pure returns(uint256) {
        return a < b ? a : b;
    }
}
