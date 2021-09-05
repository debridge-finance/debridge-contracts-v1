// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IPriceConsumer.sol";
import "hardhat/console.sol";

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
     * @param _shares number of shares
     * @param _totalAmount total amount of collateral
     * @param _totalShares total number of shares
     */
    function _calculateFromShares(uint256 _shares, uint256 _totalAmount, uint256 _totalShares)
        internal
        pure
        returns(uint256)
    {
        return _shares * _totalAmount / _totalShares;
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
        address admin;
        uint256 withdrawalCount;
        mapping(uint256 => WithdrawalInfo) withdrawals;
        bool exists; // delegator exists in validator mapping
    }

    struct DelegationInfo {
        uint256 shares; // delegator share of collateral tokens
        uint256 locked; // share locked by depositing to strategy
        mapping(address => uint256) strategyShares; // map strategy(aave/compound/yearn) for each collateral
        uint256 passedRewards; // rewards per collateral address, calculated before stake
        uint256 accumulatedRewards;
    }

    struct ValidatorCollateral {
        uint256 stakedAmount; // total tokens staked by delegators
        uint256 maxStakeAmount; // maximum stake for each collateral
        uint256 shares; // total share of collateral tokens
        uint256 locked; // total share locked by depositing to strategy
        mapping(address => uint256) strategyShares;
        mapping(address => DelegationInfo) delegation; // delegation info for each delegator
        uint256 accumulatedRewards;
        uint256 accTokensPerShare;
        mapping(address => uint256) dependsAccTokensPerShare;
    }

    struct ValidatorInfo {
        address admin;
        uint256 delegatorCount;
        mapping(uint256 => address) delegatorAddresses; // delegators staked to validator collateral
        mapping(address => DelegatorInfo) delegators;
        mapping(address => ValidatorCollateral) collateralPools; // collateral pools of validator
        uint256 rewardWeightCoefficient;
        uint256 profitSharingBPS;  // profit sharing basis points.
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

    mapping(address => ValidatorInfo) public getValidatorInfo; // validator address => validator details
    mapping(address => DelegatorInfo) public getDelegatorInfo; // delegator address => delegator details
    uint256 public timelock; // duration of withdrawal timelock
    uint256 public constant BPS_DENOMINATOR = 10000; // Basis points, or bps, equal to 1/10000 used to express relative value
    uint256 public constant MAX_COEFFICIENT = 100;
    uint256 public minProfitSharingBPS;
    uint256 public weightCoefficientDenominator;
    mapping(address => Collateral) public collaterals;
    address[] public validatorAddresses;
    address[] public collateralAddresses;
    mapping(address => uint256) public accumulatedProtocolRewards;
    mapping(address => mapping(address => Strategy)) public strategies;
    address[] public strategyControllerAddresses;
    mapping(address => bool) public strategyControllerExists;
    IPriceConsumer public priceConsumer;
    address slashingTreasury;

    /* ========== ERRORS ========== */

    error AdminBadRole();
    error WrongArgument();

    /* ========== MODIFIERS ========== */

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert AdminBadRole();
        _;
    }

    /* ========== Events ========== */

    event Staked(address validator, address delegator, address collateral, uint256 amount);
    event UnstakeRequested(address validator, address delegator, address collateral, address receipient, uint256 shares);
    event UnstakeExecuted(address delegator, uint256 withdrawalId);
    event UnstakeCancelled(address validator, address delegator, uint256 withdrawalId);
    event UnstakePaused(address delegator, uint256 withdrawalId, uint256 timestamp);
    event UnstakeResumed(address delegator, uint256 withdrawalId, uint256 timestamp);
    event Liquidated(address validator, address collateral, uint256 amount);
    event LiquidatedDelegator(address validator, address delegator, address collateral, uint256 amount);
    event DepositedToStrategy(address validator, address delegator, uint256 amount, address strategy, address collateral);
    event WithdrawnFromStrategy(address validator, address delegator, uint256 amount, address strategy, address collateral);
    event EmergencyWithdrawnFromStrategy(uint256 amount, address strategy, address collateral);
    event RecoveredFromEmergency(address validator, uint256 amount, address strategy, address collateral);
    event StrategyReset(address _strategy, address collateral);
    event RewardsDistributed(address validator, address collateral, uint256 amount);

    /* PUBLIC */

    /**
     * @dev Initializer that initializes the most important configurations.
     * @param _timelock Duration of withdrawal timelock.
     * @param _priceConsumer Price consumer contract.
     * @param _slashingTreasury Address of slashing treasury.
     */
    function initialize(uint256 _timelock, IPriceConsumer _priceConsumer, address _slashingTreasury) public initializer {
        // Grant the contract deployer the default admin role: it will be able
        // to grant and revoke any roles
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        timelock = _timelock;
        priceConsumer = _priceConsumer;
        slashingTreasury = _slashingTreasury;
        minProfitSharingBPS = 5000;
    }

    /**
     * @dev stake collateral to validator.
     * @param _validator Validator address.
     * @param _collateral address of collateral
     * @param _amount Amount to stake.
     */
    function stake(address _validator, address _collateral, uint256 _amount) external {
        ValidatorInfo storage validator = getValidatorInfo[_validator];
        Collateral storage collateral = collaterals[_collateral];
        ValidatorCollateral storage validatorCollateral = validator.collateralPools[_collateral];
        DelegatedStakingHelper._validateCollateral(collateral.isEnabled);
        require(collateral.totalLocked+_amount <= collateral.maxStakeAmount &&
            validatorCollateral.stakedAmount+_amount < validatorCollateral.maxStakeAmount,
            "collateral limited"
        );

        DelegatorInfo storage delegator = validator.delegators[msg.sender];
        DelegationInfo storage delegation = validatorCollateral.delegation[msg.sender];
        if (delegator.admin == address(0)) delegator.admin = msg.sender;

        IERC20(_collateral).safeTransferFrom(msg.sender, address(this), _amount);

        collateral.totalLocked += _amount;
        validatorCollateral.stakedAmount += _amount;
        if (!delegator.exists) {
            validator.delegatorAddresses[validator.delegatorCount] = msg.sender;
            validator.delegatorCount++;
            delegator.exists = true;
        }

        uint256 shares = validatorCollateral.shares > 0
            ? DelegatedStakingHelper._calculateShares(_amount, validatorCollateral.shares,
                validatorCollateral.stakedAmount)
            : _amount;
        //Update users passedRewards
        uint256 dependencyRewards = _creditDelegatorRewards(_validator, msg.sender, _collateral);
        //We need to sum _amount before to recalculate new passedRewards
        validatorCollateral.stakedAmount += _amount;
        validatorCollateral.shares += shares;
        delegation.shares += shares;
        // accumulated token per share for current collateral
        delegation.passedRewards = DelegatedStakingHelper._calculatePassedRewards(
                        delegation.shares,
                        validatorCollateral.accTokensPerShare)
                        + dependencyRewards;
        emit Staked(_validator, msg.sender, _collateral, _amount);
    }

    /**
     * @dev Withdraws validator reward.
     * @param _validator Validator address.
     * @param _collateral Index of collateral
     * @param _recipient Recepient reward.
     * @param _shares Shares to withdraw.
     */
    function requestUnstake(
        address _validator,
        address _collateral,
        address _recipient,
        uint256 _shares
    ) external {
        ValidatorInfo storage validator = getValidatorInfo[_validator];
        ValidatorCollateral storage validatorCollateral = getValidatorInfo[_validator].collateralPools[_collateral];
        DelegatorInfo storage delegator = validator.delegators[msg.sender];
        DelegatedStakingHelper._validateDelegator(delegator.exists);
        DelegationInfo storage delegation = validatorCollateral.delegation[msg.sender];
        DelegatedStakingHelper._validateAdmin(delegator.admin, msg.sender);
        DelegatedStakingHelper._validateGtE(
            delegation.shares
            - delegation.locked,
            _shares
        );

        uint256 dependencyRewards = _creditDelegatorRewards(_validator, msg.sender, _collateral);
        uint256 delegatorCollateral = DelegatedStakingHelper._calculateFromShares(
            _shares, validatorCollateral.stakedAmount,
            validatorCollateral.shares
        );
        collaterals[_collateral].totalLocked -= delegatorCollateral;
        delegation.shares -= _shares;
        validatorCollateral.stakedAmount -= delegatorCollateral;
        validatorCollateral.shares -= _shares;

        // recalculate passed rewards with new share amount
        delegation.passedRewards = DelegatedStakingHelper._calculatePassedRewards(
                        delegation.shares,
                        validatorCollateral.accTokensPerShare)
                        + dependencyRewards;
        delegator.withdrawals[delegator.withdrawalCount] = WithdrawalInfo(
            delegatorCollateral,
            block.timestamp + timelock,
            _recipient,
            false,
            false,
            0,
            _collateral
        );
        delegator.withdrawalCount++;
        emit UnstakeRequested(_validator, msg.sender, _collateral, _recipient, _shares);
    }

    /**
     * @dev Withdraw stake.
     * @param _delegator Delegator address.
     * @param _withdrawalId Withdrawal identifier.
     */
    function executeUnstake(address _delegator, uint256 _withdrawalId) external {
        DelegatorInfo storage delegator = getDelegatorInfo[msg.sender];
        DelegatedStakingHelper._validateAdmin(delegator.admin, msg.sender);
        DelegatedStakingHelper._validateRequestExists(bool(delegator.withdrawalCount > _withdrawalId));
        WithdrawalInfo storage withdrawal = delegator.withdrawals[_withdrawalId];
        DelegatedStakingHelper._validateNotExecuted(withdrawal.executed);
        DelegatedStakingHelper._validateTimelock(bool(withdrawal.timelock < block.timestamp));
        withdrawal.executed = true;
        IERC20(withdrawal.collateral).safeTransfer(withdrawal.receiver, withdrawal.amount);
        emit UnstakeExecuted(_delegator, _withdrawalId);
    }

    /**
     * @dev Cancel unstake.
     * @param _validator Validator address.
     * @param _withdrawalId Withdrawal identifier.
     */
    function cancelUnstake(address _validator, uint256 _withdrawalId) external {
        ValidatorInfo storage validator = getValidatorInfo[msg.sender];
        DelegatorInfo storage delegator = validator.delegators[msg.sender];
        WithdrawalInfo storage withdrawal = delegator.withdrawals[_withdrawalId];
        ValidatorCollateral storage validatorCollateral = validator.collateralPools[withdrawal.collateral];
        DelegatedStakingHelper._validateDelegator(delegator.exists);
        DelegationInfo storage delegation = validatorCollateral.delegation[msg.sender];
        DelegatedStakingHelper._validateNotExecuted(withdrawal.executed);
        withdrawal.executed = true;
        uint256 delegatorShares = DelegatedStakingHelper._calculateShares(
            withdrawal.amount,
            validatorCollateral.shares,
            validatorCollateral.stakedAmount
        );
        collaterals[withdrawal.collateral].totalLocked += withdrawal.amount;
        delegation.shares += delegatorShares;
        validatorCollateral.shares += delegatorShares;
        validatorCollateral.stakedAmount += withdrawal.amount;
        // recalculate passed rewards
        delegation.passedRewards = DelegatedStakingHelper._calculatePassedRewards(
                        delegation.shares,
                        validatorCollateral.accTokensPerShare);
        emit UnstakeCancelled(_validator, msg.sender, _withdrawalId);
    }

    /**
     * @dev Stake token to strategies to earn rewards
     * @param _validator address of validator
     * @param _shares Shares to be staked
     * @param _strategy strategy to stake into.
     */
    function depositToStrategy(address _validator, uint256 _shares, address _strategy, address _stakeToken) external {
        Strategy storage strategy = strategies[_strategy][_stakeToken];
        DelegatedStakingHelper._validateStrategy(strategy.isEnabled);
        IStrategy strategyController = IStrategy(_strategy);
        Collateral storage stakeCollateral = collaterals[strategy.stakeToken];
        ValidatorInfo storage validator = getValidatorInfo[_validator];
        ValidatorCollateral storage validatorCollateral = validator.collateralPools[_stakeToken];

        DelegatorInfo storage delegator = validator.delegators[msg.sender];
        DelegatedStakingHelper._validateDelegator(delegator.exists);
        DelegationInfo storage delegation = validatorCollateral.delegation[msg.sender];
        uint256 _amount = DelegatedStakingHelper._calculateFromShares(
            _shares,
            validatorCollateral.stakedAmount,
            validatorCollateral.shares
        );
        DelegatedStakingHelper._validateGtE(
            delegation.shares
            - delegation.locked,
            _shares
        );
        delegation.locked += _shares;
        validatorCollateral.locked += _shares;

        IERC20(strategy.stakeToken).safeApprove(address(strategyController), 0);
        IERC20(strategy.stakeToken).safeApprove(address(strategyController), _amount);
        strategy.totalReserves = strategyController.updateReserves(address(this), strategy.strategyToken);
        strategyController.deposit(strategy.stakeToken, _amount);
        uint256 afterBalance = strategyController.updateReserves(address(this), strategy.strategyToken);
        uint256 receivedAmount = afterBalance - strategy.totalReserves;
        strategy.totalReserves = strategyController.updateReserves(address(this), strategy.strategyToken);
        uint256 shares = strategy.totalShares > 0
            ? DelegatedStakingHelper._calculateShares(receivedAmount, strategy.totalShares, strategy.totalReserves)
            : receivedAmount;
        strategy.totalShares += shares;
        strategy.totalReserves = strategyController.updateReserves(address(this), strategy.strategyToken);
        delegation.strategyShares[_strategy] += shares;
        validatorCollateral.strategyShares[_strategy] += shares;
        stakeCollateral.totalLocked -= _amount;
        emit DepositedToStrategy(_validator, msg.sender, _amount, _strategy, strategy.stakeToken);
    }

    /**
     * @dev Withdraw token from strategies to claim rewards
     * @param _validator address of validator
     * @param _shares number of shares to redeem
     * @param _strategy strategy to withdraw from.
     */
    function withdrawFromStrategy(address _validator, uint256 _shares, address _strategy, address _stakeToken) external {
        Strategy storage strategy = strategies[_strategy][_stakeToken];
        DelegatedStakingHelper._validateStrategy(strategy.isEnabled);
        ValidatorInfo storage validator = getValidatorInfo[_validator];
        ValidatorCollateral storage validatorCollateral = validator.collateralPools[_stakeToken];
        DelegatorInfo storage delegator = validator.delegators[msg.sender];
        DelegatedStakingHelper._validateDelegator(delegator.exists);
        DelegationInfo storage delegation = validatorCollateral.delegation[msg.sender];
        uint256 beforeBalance = IERC20(strategy.stakeToken).balanceOf(address(this));
        strategy.totalReserves = IStrategy(_strategy).updateReserves(address(this), strategy.strategyToken);
        uint256 stakeTokenAmount = DelegatedStakingHelper._calculateFromShares(
            _shares, strategy.totalReserves, strategy.totalShares
        );

        { // scope to avoid stack too deep errors
            DelegatedStakingHelper._validateGtE(delegation.strategyShares[_strategy], _shares);
            delegation.strategyShares[_strategy] -= _shares;
            validatorCollateral.strategyShares[_strategy] -= _shares;
            strategy.totalShares -= _shares;
            IERC20(strategy.strategyToken).safeApprove(address(_strategy), 0);
            IERC20(strategy.strategyToken).safeApprove(address(_strategy), stakeTokenAmount);
            IStrategy(_strategy).withdraw(strategy.stakeToken, stakeTokenAmount);
        }
        uint256 receivedAmount = IERC20(strategy.stakeToken).balanceOf(address(this)) - beforeBalance;
        collaterals[strategy.stakeToken].totalLocked += receivedAmount;
        strategy.totalReserves = IStrategy(_strategy).updateReserves(address(this), strategy.strategyToken);
        uint256 rewardAmount = receivedAmount - stakeTokenAmount;
        collaterals[strategy.stakeToken].rewards += rewardAmount;
        strategy.rewards += rewardAmount;
        validatorCollateral.accumulatedRewards += rewardAmount;
        delegation.accumulatedRewards += rewardAmount;
        accumulatedProtocolRewards[strategy.stakeToken] += rewardAmount;
        uint256 rewardShares = validatorCollateral.shares > 0
        ? DelegatedStakingHelper._calculateShares(rewardAmount, validatorCollateral.shares,
            validatorCollateral.stakedAmount)
        : rewardAmount;
        uint256 stakeTokenShares = DelegatedStakingHelper._calculateShares(
            stakeTokenAmount,
            validatorCollateral.shares,
            validatorCollateral.stakedAmount
        );
        delegation.shares += rewardShares;
        delegation.locked -= stakeTokenShares;
        validatorCollateral.locked -= stakeTokenShares;
        validatorCollateral.stakedAmount += rewardAmount;
        validatorCollateral.shares += rewardShares;
        emit WithdrawnFromStrategy(_validator, msg.sender, receivedAmount, _strategy, strategy.stakeToken);
    }

    /**
     * @dev Recovers user share of all funds emergency withdrawn from the strategy.
     * @param _strategy Strategy to recover from.
     * @param _stakeToken Address of collateral.
     * @param _validators Array of validator addresses.
     */
    function recoverFromEmergency(address _strategy, address _stakeToken, address[] calldata _validators) external {
        _recoverFromEmergency(_strategy, _stakeToken, _validators);
    }

    /**
     * @dev Recovers user share of all funds emergency withdrawn from the strategy.
     * @param _strategy Strategy to recover from.
     * @param _stakeToken Address of collateral.
     * @param _validators Array of validator addresses.
     */
    function _recoverFromEmergency(address _strategy, address _stakeToken, address[] memory _validators) internal {
        Strategy storage strategy = strategies[_strategy][_stakeToken];
        require(!strategy.isEnabled, "strategy enabled");
        require(strategy.isRecoverable, "not recoverable");
        for (uint256 i=0; i<_validators.length; i++) {
            ValidatorInfo storage validator = getValidatorInfo[_validators[i]];
            ValidatorCollateral storage validatorCollateral = validator.collateralPools[_stakeToken];
            strategy.totalReserves = IStrategy(_strategy).updateReserves(address(this), strategy.strategyToken);
            uint256 amount = DelegatedStakingHelper._calculateFromShares(
                validatorCollateral.strategyShares[_strategy], strategy.totalReserves, strategy.totalShares
            );
            uint256 fullAmount = DelegatedStakingHelper._calculateFromShares(
                validatorCollateral.locked, validatorCollateral.stakedAmount, validatorCollateral.shares);
            uint256 lost = fullAmount - amount;
            strategy.totalShares -= validatorCollateral.strategyShares[_strategy];
            validatorCollateral.locked -= validatorCollateral.strategyShares[_strategy];
            validatorCollateral.stakedAmount -= lost;
            validatorCollateral.strategyShares[_strategy] = 0;
            strategy.totalReserves -= amount;

            for (uint256 k=0; k<validator.delegatorCount; k++) {
                DelegationInfo storage delegation = validatorCollateral.delegation[validator.delegatorAddresses[k]];
                if (delegation.strategyShares[_strategy] == 0) continue;
                delegation.locked -= delegation.strategyShares[_strategy];
                delegation.strategyShares[_strategy] = 0;
            }
            emit RecoveredFromEmergency(_validators[i], amount, _strategy, strategy.stakeToken);
        }
    }

    /**
     * @dev set basis points of profit sharing
     * @param _validator address of validator
     * @param _profitSharingBPS profit sharing basis points
     */
    function setProfitSharing(address _validator, uint256 _profitSharingBPS) external {
        ValidatorInfo storage validator = getValidatorInfo[_validator];
        DelegatedStakingHelper._validateAdmin(validator.admin, msg.sender);
        require(_profitSharingBPS >= minProfitSharingBPS, "bad min BPS");
        DelegatedStakingHelper._validateBPS(_profitSharingBPS, BPS_DENOMINATOR);
        validator.profitSharingBPS = _profitSharingBPS;
    }

    /**
     * @dev Distributes validator rewards to validator/delegators
     * @param _validator address of validator
     * @param _collateral address of collateral
     * @param _amount amount of token
     */
    function distributeRewards(address _validator, address _collateral, uint256 _amount) external {
        Collateral storage collateral = collaterals[_collateral];

        DelegatedStakingHelper._validateCollateral(collateral.isEnabled);
        IERC20(_collateral).safeTransferFrom(msg.sender, address(this), _amount);
        collateral.totalLocked += _amount;
        collateral.rewards +=_amount;
        accumulatedProtocolRewards[_collateral] += _amount;

        ValidatorInfo storage validator = getValidatorInfo[_validator];
        ValidatorCollateral storage validatorCollateral = validator.collateralPools[_collateral];
        uint256 delegatorsAmount = _amount * validator.profitSharingBPS / BPS_DENOMINATOR;

        validatorCollateral.stakedAmount += _amount - delegatorsAmount;
        validatorCollateral.accumulatedRewards += _amount - delegatorsAmount;

        _distributeDelegatorRewards(_validator, _collateral, delegatorsAmount);
        emit RewardsDistributed(_validator, _collateral, _amount);
    }

    /**
     * @dev Distributes validator rewards to delegators
     * @param _validator address of validator
     * @param _collateral address of collateral
     * @param _delegatorsAmount amount of token
     */
    function _distributeDelegatorRewards(address _validator, address _collateral, uint256 _delegatorsAmount) internal {
        ValidatorCollateral storage validatorCollateral = getValidatorInfo[_validator].collateralPools[_collateral];
        // All colaterals of the validator valued in usd
        uint256 totalUSDAmount = getTotalUSDAmount(_validator);
        for (uint256 i = 0; i < collateralAddresses.length; i++) {
            address currentCollateral = collateralAddresses[i];
            // How many rewards each collateral receives
            uint256 accTokens = _delegatorsAmount *
                getPoolUSDAmount(_validator, currentCollateral) /
                totalUSDAmount;

            uint256 accTokensPerShare = validatorCollateral.shares > 0
                ? accTokens * 1e18 / validatorCollateral.shares
                : 0;

            if(currentCollateral==_collateral){
                //Increase accumulated rewards per share
                validatorCollateral.accTokensPerShare += accTokensPerShare;
            } else {
                //Add a reward pool dependency
                validatorCollateral.dependsAccTokensPerShare[currentCollateral] += accTokensPerShare;
            }
        }
    }

    /**
     * @dev Distributes validator rewards to validators
     * @param _collateral address of collateral
     * @param _amount amount of token
     */
    function distributeValidatorRewards(address _collateral, uint256 _amount) external {
        Collateral storage collateral = collaterals[_collateral];

        DelegatedStakingHelper._validateCollateral(collateral.isEnabled);
        IERC20(_collateral).safeTransferFrom(msg.sender, address(this), _amount);
        collateral.totalLocked += _amount;
        collateral.rewards +=_amount;
        accumulatedProtocolRewards[_collateral] += _amount;

        for (uint256 i=0; i<validatorAddresses.length; i++) {
            address _validator = validatorAddresses[i];
            ValidatorInfo storage validator = getValidatorInfo[_validator];
            ValidatorCollateral storage validatorCollateral = validator.collateralPools[_collateral];
            uint256 validatorAmount =  validator.rewardWeightCoefficient/weightCoefficientDenominator * _amount;
            uint256 delegatorsAmount = validatorAmount * validator.profitSharingBPS / BPS_DENOMINATOR;

            validatorCollateral.stakedAmount += validatorAmount;
            validatorCollateral.accumulatedRewards += validatorAmount;

            // mint validatorAmount delegators[validator.admin]

            _distributeDelegatorRewards(_validator, _collateral, delegatorsAmount);
            emit RewardsDistributed(_validator, _collateral, _amount);
        }
    }

    /* ADMIN */

    /**
     * @dev Withdraws all funds from the strategy.
     * @param _strategy Strategy to withdraw from.
     */
    function emergencyWithdrawFromStrategy(address _strategy, address _stakeToken)
        external
        onlyAdmin()
    {
        Strategy storage strategy = strategies[_strategy][_stakeToken];
        DelegatedStakingHelper._validateStrategy(strategy.isEnabled);
        IStrategy strategyController = IStrategy(_strategy);
        Collateral storage stakeCollateral = collaterals[strategy.stakeToken];
        IERC20(strategy.strategyToken).safeApprove(address(_strategy), 0);
        IERC20(strategy.strategyToken).safeApprove(address(_strategy), type(uint256).max);
        uint256 beforeBalance = strategyController.updateReserves(address(this), strategy.stakeToken);
        strategyController.withdrawAll(strategy.stakeToken);
        uint256 afterBalance = strategyController.updateReserves(address(this), strategy.stakeToken);
        uint256 receivedAmount = afterBalance - beforeBalance;
        stakeCollateral.totalLocked += receivedAmount;
        strategy.totalReserves = receivedAmount;
        strategy.isEnabled = false;
        strategy.isRecoverable = true;
        emit EmergencyWithdrawnFromStrategy(receivedAmount, _strategy, strategy.stakeToken);
    }

    function resetStrategy(address _strategy, address _stakeToken)
        external
        onlyAdmin()
    {
        Strategy storage strategy = strategies[_strategy][_stakeToken];
        require(!strategy.isEnabled, "strategy enabled");
        _recoverFromEmergency(_strategy, _stakeToken, validatorAddresses);
        strategy.totalReserves = 0;
        strategy.totalShares = 0;
        strategy.isEnabled = true;
        strategy.isRecoverable = false;
        emit StrategyReset(_strategy, strategy.stakeToken);
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
     * @dev Confiscate collateral.
     * @param _validator Validator address.
     * @param _collaterals Collateral addresses.
     * @param _bpsAmount Basis points to slash.
     */
    function liquidate(address _validator, address[] calldata _collaterals, uint256 _bpsAmount) external onlyAdmin() {
        ValidatorInfo storage validator = getValidatorInfo[_validator];
        uint256 _delegatorBPS = validator.profitSharingBPS * _bpsAmount / BPS_DENOMINATOR;
        uint256 validatorBPS = _bpsAmount - _delegatorBPS;
        for (uint256 i=0; i<_collaterals.length; i++) {
            address _collateral = _collaterals[i];
            uint256 delegatorBPS = _delegatorBPS;
            ValidatorCollateral storage validatorCollateral = validator.collateralPools[_collateral];
            DelegatorInfo storage delegator = validator.delegators[validator.admin];
            DelegatedStakingHelper._validateDelegator(delegator.exists);
            DelegationInfo storage delegation = validatorCollateral.delegation[validator.admin];
            Collateral storage collateral = collaterals[_collateral];
            uint256 totalSlashed;
            if (delegation.shares/validatorCollateral.shares < validatorBPS) {
                liquidateDelegator(_validator, validator.admin, _collateral, BPS_DENOMINATOR);
                delegatorBPS += validatorBPS - delegation.shares/validatorCollateral.shares;
            } else {
                liquidateDelegator(_validator, validator.admin, _collateral, validatorBPS);
            }
            uint256 slashingFraction = delegatorBPS / BPS_DENOMINATOR;
            for (uint256 j=0; j<strategyControllerAddresses.length; j++) {
                address _strategyController = strategyControllerAddresses[j];
                Strategy storage strategy = strategies[_strategyController][_collateral];
                uint256 beforeBalance = IERC20(_collateral).balanceOf(address(this));
                strategy.totalReserves = IStrategy(_strategyController).updateReserves(address(this), strategy.strategyToken);
                uint256 _strategyShares = validatorCollateral.strategyShares[_strategyController] * slashingFraction;
                uint256 stakeTokenCollateral = DelegatedStakingHelper._calculateFromShares(
                    _strategyShares, strategy.totalReserves, strategy.totalShares
                );
                validatorCollateral.strategyShares[_strategyController] -= _strategyShares;
                strategy.totalShares -= _strategyShares;
                IERC20(strategy.strategyToken).safeApprove(_strategyController, 0);
                IERC20(strategy.strategyToken).safeApprove(_strategyController, _strategyShares);
                IStrategy(_strategyController).withdraw(_collateral, _strategyShares);
                uint256 receivedAmount = IERC20(_collateral).balanceOf(address(this)) - beforeBalance;
                strategy.totalReserves = IStrategy(_strategyController).updateReserves(address(this), strategy.strategyToken);
                uint256 rewardAmount = receivedAmount - stakeTokenCollateral;
                collateral.totalLocked += rewardAmount;
                collateral.rewards += rewardAmount;
                strategy.rewards += rewardAmount;
                accumulatedProtocolRewards[strategy.stakeToken] += rewardAmount;
                uint256 slashedStrategyShares = validatorCollateral.shares > 0
                    ? DelegatedStakingHelper._calculateShares(
                        stakeTokenCollateral,
                        validatorCollateral.shares,
                        validatorCollateral.stakedAmount)
                    : stakeTokenCollateral;
                validatorCollateral.stakedAmount -= stakeTokenCollateral;
                validatorCollateral.shares -= slashedStrategyShares;
                collateral.confiscatedFunds += stakeTokenCollateral;
                totalSlashed += stakeTokenCollateral;
            }
            uint256 _shares = (validatorCollateral.shares - validatorCollateral.locked) * slashingFraction;
            uint256 slashedAmount = DelegatedStakingHelper._calculateFromShares(
                _shares,
                validatorCollateral.stakedAmount,
                validatorCollateral.shares
            );
            validatorCollateral.shares -= _shares;
            validatorCollateral.stakedAmount -= slashedAmount;
            collateral.confiscatedFunds += slashedAmount;
            collateral.totalLocked -= slashedAmount;
            totalSlashed += slashedAmount;

            IERC20(_collateral).safeTransfer(slashingTreasury, totalSlashed);
            emit Liquidated(_validator, _collateral, totalSlashed);
        }
    }

    /**
     * @dev Confiscate delegator collateral.
     * @param _validator Validator address.
     * @param _delegator Delegator address.
     * @param _collateral Index of collateral.
     * @param _bpsAmount Basis points to slash.
     */
    function liquidateDelegator(address _validator, address _delegator, address _collateral, uint256 _bpsAmount) public onlyAdmin() {
        ValidatorInfo storage validator = getValidatorInfo[_validator];
        ValidatorCollateral storage validatorCollateral = validator.collateralPools[_collateral];
        DelegatorInfo storage delegator = validator.delegators[_delegator];
        DelegationInfo storage delegation = validatorCollateral.delegation[_delegator];
        DelegatedStakingHelper._validateDelegator(delegator.exists);
        Collateral storage collateral = collaterals[_collateral];
        uint256 slashingFraction = _bpsAmount/BPS_DENOMINATOR;
        uint256 totalSlashed;
        address _strategyController;
        for (uint i=0; i<strategyControllerAddresses.length; i++) {
            _strategyController = strategyControllerAddresses[i];
            Strategy storage strategy = strategies[_strategyController][_collateral];
            uint256 beforeBalance = IERC20(_collateral).balanceOf(address(this));
            strategy.totalReserves = IStrategy(_strategyController).updateReserves(address(this), strategy.strategyToken);
            uint256 _strategyShares = delegation.strategyShares[_strategyController] * slashingFraction;
            uint256 stakeTokenCollateral = DelegatedStakingHelper._calculateFromShares(
                _strategyShares, strategy.totalReserves, strategy.totalShares
            );
            validatorCollateral.strategyShares[_strategyController] -= _strategyShares;
            strategy.totalShares -= _strategyShares;
            IERC20(strategy.strategyToken).safeApprove(_strategyController, 0);
            IERC20(strategy.strategyToken).safeApprove(_strategyController, _strategyShares);
            IStrategy(_strategyController).withdraw(_collateral, _strategyShares);
            uint256 receivedAmount = IERC20(_collateral).balanceOf(address(this)) - beforeBalance;
            strategy.totalReserves = IStrategy(_strategyController).updateReserves(address(this), strategy.strategyToken);
            uint256 rewardAmount = receivedAmount - stakeTokenCollateral;
            collateral.totalLocked += rewardAmount;
            collateral.rewards += rewardAmount;
            strategy.rewards += rewardAmount;
            accumulatedProtocolRewards[strategy.stakeToken] += rewardAmount;
            uint256 rewardShares = validatorCollateral.shares > 0
                ? DelegatedStakingHelper._calculateShares(rewardAmount, validatorCollateral.shares, validatorCollateral.stakedAmount)
                : rewardAmount;
            delegation.shares += rewardShares;
            uint256 slashedStrategyShares = validatorCollateral.shares > 0
                ? DelegatedStakingHelper._calculateShares(
                    stakeTokenCollateral,
                    validatorCollateral.shares,
                    validatorCollateral.stakedAmount)
                : stakeTokenCollateral;
            delegation.shares -= slashedStrategyShares;
            delegation.locked -= slashedStrategyShares;
            validatorCollateral.stakedAmount -= stakeTokenCollateral;
            validatorCollateral.shares -= slashedStrategyShares;
            collateral.confiscatedFunds += stakeTokenCollateral;
            totalSlashed += stakeTokenCollateral;
        }
        uint256 _shares = (delegation.shares - delegation.locked) * slashingFraction;
        uint256 slashedAmount = DelegatedStakingHelper._calculateFromShares(
            _shares,
            validatorCollateral.stakedAmount,
            validatorCollateral.shares
        );
        delegation.shares -= _shares;
        validatorCollateral.shares -= _shares;
        validatorCollateral.stakedAmount -= slashedAmount;
        collateral.confiscatedFunds += slashedAmount;
        collateral.totalLocked -= slashedAmount;
        totalSlashed += slashedAmount;
        delegation.passedRewards = DelegatedStakingHelper._calculatePassedRewards(
                            delegation.shares,
                            validatorCollateral.accTokensPerShare
                        );


        IERC20(_collateral).safeTransfer(slashingTreasury, totalSlashed);
        emit LiquidatedDelegator(_validator, _delegator, _collateral, totalSlashed);
    }

    /**
     * @dev Updates slashing treasury address.
     * @param _newTreasury New slashing treasury address.
     */
    function updateSlashingTreasury(address _newTreasury) external onlyAdmin() {
        slashingTreasury = _newTreasury;
    }

    /**
     * @dev Add new validator.
     * @param _validator Validator address.
     * @param _admin Admin address.
     */
    function addValidator(
        address _validator,
        address _admin,
        uint256 _rewardWeightCoefficient,
        uint256 _profitSharingBPS
    )   external
        onlyAdmin()
    {
        ValidatorInfo storage validator = getValidatorInfo[_validator];
        validator.admin = _admin;
        validator.rewardWeightCoefficient = _rewardWeightCoefficient;
        weightCoefficientDenominator += _rewardWeightCoefficient;
        validator.profitSharingBPS = _profitSharingBPS;
        validatorAddresses.push(_validator);
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
     * @dev update validator collateral max amount
     * @param _collateral address of collateral
     * @param _amount max amount
     */
    function updateValidatorCollateral(address _validator, address _collateral, uint256 _amount) external onlyAdmin() {
        ValidatorCollateral storage validatorCollateral = getValidatorInfo[_validator].collateralPools[_collateral];
        require(_amount <= collaterals[_collateral].maxStakeAmount, "collateral limited");
        validatorCollateral.maxStakeAmount = _amount;
    }

    /**
     * @dev update validator reward weight coefficient
     * @param _validator address of validator
     * @param _amount reward weight coefficient
     */
    function updateRewardWeight(address _validator, uint256 _amount) external onlyAdmin() {
        ValidatorInfo storage validator = getValidatorInfo[_validator];
        require(_amount <= MAX_COEFFICIENT, "bad coefficient");
        weightCoefficientDenominator -= validator.rewardWeightCoefficient;
        validator.rewardWeightCoefficient = _amount;
        weightCoefficientDenominator += _amount;
    }

    /**
     * @dev Add a new strategy controller
     * @param _strategyController Strategy controller address
     */
    function addStrategyController(address _strategyController) external onlyAdmin() {
        require(!strategyControllerExists[_strategyController], "already exists");
        strategyControllerAddresses.push(_strategyController);
        strategyControllerExists[_strategyController] = true;
    }

    /**
     * @dev Add a new strategy
     * @param _strategyController address to strategy
     * @param _stakeToken collateralId of stakeToken
     * @param _rewardToken collateralId of rewardToken
     */
    function addStrategy(address _strategyController, address _stakeToken, address _rewardToken) external onlyAdmin() {
        Strategy storage strategy = strategies[_strategyController][_stakeToken];
        require(!strategy.isSupported, "already exists");
        strategy.stakeToken = _stakeToken;
        strategy.strategyToken = IStrategy(_strategyController).strategyToken(_stakeToken);
        strategy.rewardToken = _rewardToken;
        strategy.isSupported = true;
        strategy.isEnabled = true;
    }

    /**
     * @dev enable strategy
     * @param _strategy address of strategy
     * @param _stakeToken address of token
     * @param _isEnabled bool of enable
     */
    function updateStrategy(address _strategy, address _stakeToken, bool _isEnabled) external onlyAdmin() {
        strategies[_strategy][_stakeToken].isEnabled = _isEnabled;
    }

    /**
     * @dev enable strategy recoverable
     * @param _strategy address of strategy
     * @param _stakeToken address of token
     * @param _isRecoverable bool of recoverable
     */
    function updateStrategyRecoverable(address _strategy, address _stakeToken, bool _isRecoverable) external onlyAdmin() {
        strategies[_strategy][_stakeToken].isRecoverable = _isRecoverable;
    }

    /**
     * @dev Pause unstaking request.
     * @param _delegator address of delegator
     */
    function pauseUnstake(address _delegator) external onlyAdmin() {
        DelegatorInfo storage delegator = getDelegatorInfo[_delegator];
        for (uint256 i = 0; i < delegator.withdrawalCount; i ++) {
            WithdrawalInfo storage withdrawal = delegator.withdrawals[i];
            if (withdrawal.paused == false && withdrawal.executed == false) {
                withdrawal.paused = true;
                withdrawal.pausedTime = block.timestamp;
                emit UnstakePaused(_delegator, i, block.timestamp);
            }
        }
    }

    /**
     * @dev Resume unstaking request.
     * @param _delegator address of delegator
     */
    function resumeUnstake(address _delegator) external onlyAdmin() {
        DelegatorInfo storage delegator = getDelegatorInfo[_delegator];
        uint256 i;
        for (i = 0; i < delegator.withdrawalCount; i ++) {
            WithdrawalInfo storage withdrawal = delegator.withdrawals[i];
            if (withdrawal.paused == true && withdrawal.executed == false) {
                withdrawal.paused = false;
                withdrawal.timelock += block.timestamp - withdrawal.pausedTime;
                emit UnstakeResumed(_delegator, i, block.timestamp);
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
     * @dev checks strategy reserves
     * @param _strategyController Strategy controller address
     * @param _validator Validator address
     * @param _collateral Collateral address
     */
    // NOTE: this doesnt work for multiple validators staked to same strategy as the gain/loss needs to be shared between them
    // function _checkReserves(address _strategyController, address _validator, address _collateral) internal {
    //     Strategy storage strategy = strategies[_strategyController][_collateral];
    //     ValidatorCollateral storage validatorCollateral = getValidatorInfo[_validator].collateralPools[_collateral];
    //     uint256 cachedReserves = strategy.totalReserves;
    //     strategy.totalReserves = IStrategy(_strategyController).updateReserves(address(this), strategy.strategyToken);
    //     if (strategy.totalReserves > cachedReserves) {
    //        uint256 additionalShares = DelegatedStakingHelper._calculateShares(
    //            strategy.totalReserves - cachedReserves,
    //            strategy.totalShares,
    //            strategy.totalReserves
    //        );
    //        validatorCollateral.strategyShares[_strategyController] += additionalShares;
    //        strategy.totalShares += additionalShares;
    //        validatorCollateral.locked += additionalShares;
    //     } else {
    //         uint256 reducedShares = DelegatedStakingHelper._calculateShares(
    //             cachedReserves - strategy.totalReserves,
    //             strategy.totalShares,
    //             strategy.totalReserves
    //         );
    //         validatorCollateral.strategyShares[_strategyController] -= reducedShares;
    //         strategy.totalShares -= reducedShares;
    //         validatorCollateral.locked -= reducedShares;
    //     }
    // }

    /**
     * @dev Credits delegator share of validator rewards and updated passed rewards
     * @param _validator address of validator
     * @param _delegator address of delegator
     */
    function _creditDelegatorRewards(address _validator, address _delegator, address _collateral) internal returns(uint256) {
        uint256 collateralDependencyRewards;

        for (uint256 i = 0; i < collateralAddresses.length; i++) {
            address rewardCollateral = collateralAddresses[i];
            ValidatorCollateral storage validatorCollateral = getValidatorInfo[_validator].collateralPools[rewardCollateral];
            DelegationInfo storage delegation = validatorCollateral.delegation[_delegator];
            uint256 pendingReward = delegation.shares
                                * validatorCollateral.accTokensPerShare
                                / 1e18;

            // accumulated token per share for collateral that exists reward in rewardCollateral
            uint256 dependencyRewards = _calculateDependencyRewards(_validator, _delegator, rewardCollateral);
            pendingReward = pendingReward + dependencyRewards - delegation.passedRewards;
            if (pendingReward > 0) {
                uint256 pendingShares = DelegatedStakingHelper._calculateShares(
                                            pendingReward, validatorCollateral.shares,
                                            validatorCollateral.stakedAmount
                                        );
                validatorCollateral.stakedAmount += pendingReward;
                validatorCollateral.shares += pendingShares;
                delegation.accumulatedRewards += pendingReward;
                delegation.shares += pendingShares;
            }

            // accumulated token per share for current collateral
            delegation.passedRewards = DelegatedStakingHelper._calculatePassedRewards(
                            delegation.shares,
                            validatorCollateral.accTokensPerShare)
                            + dependencyRewards;

            if (rewardCollateral == _collateral)
                collateralDependencyRewards = dependencyRewards;
        }
        return collateralDependencyRewards;
    }

    /**
     * @dev Calculates accumulated tokens per share for collateral that has rewards in rewardCollateral
     * @param _validator address of validator
     * @param _delegator address of delegator
     * @param _rewardCollateral address of rewardCollateral
     */
    function _calculateDependencyRewards(address _validator, address _delegator, address _rewardCollateral)
        internal
        view
        returns(uint256)
    {
        ValidatorCollateral storage validatorCollateral = getValidatorInfo[_validator].collateralPools[_rewardCollateral];
        DelegationInfo storage delegation = validatorCollateral.delegation[_delegator];

        // accumulated token per share for collateral that exists reward in rewardCollateral
        uint256 dependencyRewards;
        for(uint256 k = 0; k < collateralAddresses.length; k++) {
            address collateral = collateralAddresses[k];
                if(collateral != _rewardCollateral) {
                    dependencyRewards +=
                            delegation.shares
                            * validatorCollateral.dependsAccTokensPerShare[collateral]
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
    function getPricePerFullStrategyShare(address _strategy, address _stakeToken, address _collateral)
        external
        view
        returns (uint256)
    {
        DelegatedStakingHelper._validateShares(strategies[_strategy][_stakeToken].totalShares);
        uint256 totalStrategyTokenReserves = IStrategy(_strategy).updateReserves(address(this), _collateral);
        return totalStrategyTokenReserves/strategies[_strategy][_stakeToken].totalShares;
    }

    /**
     * @dev Get price per validator share
     * @param _validator Address of validator
     * @param _collateral Address of collateral
     */
    function getPricePerFullValidatorShare(address _validator, address _collateral)
        external
        view
        returns (uint256)
    {
        ValidatorCollateral storage validatorCollateral = getValidatorInfo[_validator].collateralPools[_collateral];
        DelegatedStakingHelper._validateShares(validatorCollateral.shares);
        return validatorCollateral.stakedAmount/validatorCollateral.shares;
    }

    /**
     * @dev Get USD amount of validator collateral
     * @param _validator Address of validator
     * @param _collateral Address of collateral
     * @return USD amount with decimals 18
     */
    function getPoolUSDAmount(address _validator, address _collateral) public view returns(uint256) {
        uint256 collateralPrice;
        Collateral memory collateral = collaterals[_collateral];
        if (collateral.isUSDStable)
            collateralPrice = 1e18;
        else collateralPrice = priceConsumer.getPriceOfToken(_collateral);
        return getValidatorInfo[_validator].collateralPools[_collateral].stakedAmount * collateralPrice
                / (10 ** collateral.decimals);
    }

    /**
     * @dev Get total USD amount of validator collateral
     * @param _validator Address of validator
     */
    function getTotalUSDAmount(address _validator) public view returns(uint256) {
        uint256 totalUSDAmount = 0;
        for (uint256 i = 0; i < collateralAddresses.length; i++) {
            totalUSDAmount += getPoolUSDAmount(_validator, collateralAddresses[i]);
        }
        return totalUSDAmount;
    }

    /**
     * @dev Get withdrawal request.
     * @param _delegator Delegator address.
     * @param _withdrawalId Withdrawal identifier.
     */
    function getWithdrawalRequest(address _delegator, uint256 _withdrawalId)
        external
        view
        returns (WithdrawalInfo memory)
    {
        return getDelegatorInfo[_delegator].withdrawals[_withdrawalId];
    }

    /**
     * @dev Get strategy info
     * @param _strategy Strategy address
     * @param _stakeToken Stake token address
     */
    function getStrategy(address _strategy, address _stakeToken) external view returns (Strategy memory) {
        return strategies[_strategy][_stakeToken];
    }

    /**
     * @dev get stake property of validator
     * @param _validator address of validator
     * @param _collateral Address of collateral
     */
    function getValidatorStaking(address _validator, address _collateral) external view returns (uint256, uint256) {
        ValidatorCollateral storage validatorCollateral = getValidatorInfo[_validator].collateralPools[_collateral];
        return(
            validatorCollateral.stakedAmount,
            validatorCollateral.locked
        );
    }

    /**
     * @dev get delegator stakes: returns whether delegator exists, shares, locked shares and passed rewards
     * @param _validator address of validator
     * @param _delegator address of delegator
     * @param _collateral Address of collateral
     */
    function getDelegatorStakes(address _validator, address _delegator, address _collateral)
        external
        view
        returns(bool, uint256, uint256, uint256)
    {
        DelegationInfo storage delegation = getValidatorInfo[_validator].collateralPools[_collateral].delegation[_delegator];
        return (
            getValidatorInfo[_validator].delegators[_delegator].exists,
            delegation.shares,
            delegation.locked,
            delegation.passedRewards
        );
    }

    /**
     * @dev get delegator, collateral and protocol rewards
     * @param _validator address of validator
     * @param _collateral Address of collateral
     */
    function getRewards(address _validator, address _collateral)
        external
        view
        returns(uint256, uint256, uint256)
    {
        return(
            getValidatorInfo[_validator].collateralPools[_collateral].accumulatedRewards,
            collaterals[_collateral].rewards,
            accumulatedProtocolRewards[_collateral]
        );
    }

    /**
     * @dev Get delegation info to validator: returns total delegation amount, total shares, delegator count
     * @param _validator Address of validator
     * @param _collateral Address of collateral
     */
    function getDelegationInfo(address _validator, address _collateral) external view returns(uint256, uint256, uint256) {
        ValidatorInfo storage validator = getValidatorInfo[_validator];
        return (
            validator.collateralPools[_collateral].stakedAmount,
            validator.collateralPools[_collateral].shares,
            validator.delegatorCount
        );
    }

    /**
     * @dev Get total stake to strategy: returns total reserve amount, total shares and total rewards
     * @param _strategy Address of strategy
     */
    function getStrategyStakes(address _strategy, address _stakeToken) external view returns(uint256, uint256, uint256) {
        return (
            strategies[_strategy][_stakeToken].totalReserves,
            strategies[_strategy][_stakeToken].totalShares,
            strategies[_strategy][_stakeToken].rewards
        );
    }

    /**
     * @dev Get accumulated tokens per share
     * @param _validator Validator address
     * @param _collateral Collateral address
     * @param _dependsCollateral Depends collateral address
     */
    function getTokensPerShare(address _validator, address _collateral, address _dependsCollateral) external view returns(uint256, uint256) {
        ValidatorCollateral storage validatorCollateral = getValidatorInfo[_validator].collateralPools[_collateral];
        return(
            validatorCollateral.accTokensPerShare,
            validatorCollateral.dependsAccTokensPerShare[_dependsCollateral]
        );
    }

    /**
     * @dev Gets total strategy shares for validator
     * @param _validator Validator address
     * @param _strategy Strategy address
     */
    function getStrategyDepositInfo(address _validator, address _strategy, address _stakeToken)
        external
        view
        returns(uint256)
    {
        return getValidatorInfo[_validator].collateralPools[_stakeToken].strategyShares[_strategy];
    }

    /**
     * @dev Gets delegator strategy shares
     * @param _validator Validator address
     * @param _delegator Delegator address
     * @param _strategy Strategy address
     */
    function getStrategyDepositInfo(address _validator, address _delegator, address _strategy, address _stakeToken)
        external
        view
        returns(uint256)
    {
        return getValidatorInfo[_validator].collateralPools[_stakeToken].delegation[_delegator].strategyShares[_strategy];
    }


}
