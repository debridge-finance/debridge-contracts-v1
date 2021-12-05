// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/ISwapProxy.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IPriceConsumer.sol";

library DelegatedStakingHelper {
    /**
     * @dev Calculates shares
     * @param _amount amount of collateral
     * @param _totalShares total number of shares
     * @param _totalAmount total amount of collateral
     */
    function _calculateShares(
        uint256 _amount,
        uint256 _totalShares,
        uint256 _totalAmount
    ) internal pure returns (uint256) {
        if (_totalAmount > 0) {
            return (_amount * _totalShares) / _totalAmount;
        } else {
            return _amount;
        }
    }

    /**
     * @dev Calculates amount from shares
     * @param _shares number of shares
     * @param _totalAmount total amount of collateral
     * @param _totalShares total number of shares
     */
    function _calculateFromShares(
        uint256 _shares,
        uint256 _totalAmount,
        uint256 _totalShares
    ) internal pure returns (uint256) {
        if (_totalShares == 0) {
            return 0;
        }
        return (_shares * _totalAmount) / _totalShares;
    }
}

contract DelegatedStaking is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    uint256 public constant UINT_MAX_VALUE =
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct RewardInfo {
        uint256 totalAmount; // total rewards
        uint256 distributed; // distributed rewards
    }

    struct WithdrawalInfo {
        address delegator;
        uint256 amount; // amount of withdrawn token
        uint256 slashingAmount; // slashing amount by governance
        uint256 timelock; // time till the asset is locked
        address receiver; // token receiver
        address collateral; // collateral identifier
        bool executed; // whether is executed
        bool paused; // whether is paused
    }

    struct WithdrawalRequests {
        mapping(uint256 => WithdrawalInfo) withdrawals;
        uint256 count; // counter of withdrawals from specific validator
    }

    struct DelegatorsInfo {
        uint256 shares; // delegator share of collateral tokens
        uint256 locked; // share locked by depositing to strategy
        uint256 accumulatedRewards; // info how many reward tokens were earned
    }

    struct ValidatorCollateral {
        uint256 stakedAmount; // total tokens staked by delegators
        uint256 shares; // total share of collateral tokens
        uint256 locked; // total share locked by depositing to strategy
        mapping(address => DelegatorsInfo) delegators; // delegation info for each delegator
        uint256 accumulatedRewards; // how many reward tokens were earned
        uint256 rewardsForWithdrawal; // how many reward tokens validator can withdrawal
    }

    struct ValidatorInfo {
        address admin;
        mapping(address => ValidatorCollateral) collateralPools; // collateral pools of validator
        uint256 rewardWeightCoefficient;
        uint256 delegatorCount;
        uint256 profitSharingBPS; // profit sharing basis points.
        bool delegatorActionPaused; // paused stake/unstake for this validator
        bool isEnabled;
        bool exists;
    }

    struct Collateral {
        uint256 slashedAmount; // balance of slashing treasury of this assets
        uint256 totalLocked; // total staked tokens
        uint256 rewards; // total accumulated rewards
        uint256 maxStakeAmount; // maximum stake for each validator's collateral
        uint8 decimals;
        bool isEnabled;
        bool exists;
    }

    mapping(address => RewardInfo) public getRewardsInfo;
    mapping(address => ValidatorInfo) public getValidatorInfo; // validator address => validator details
    mapping(address => WithdrawalRequests) public getWithdrawalRequests; // validators address => withdrawal requests

    uint256 public withdrawTimelock; // duration of withdrawal timelock
    uint256 public constant BPS_DENOMINATOR = 1e4; // Basis points, or bps, equal to 1/10000 used to express relative value
    uint256 public constant PPM_DENOMINATOR = 1e6; // parts per million, equal to 1/1000000 used
    uint256 public minProfitSharingBPS;
    uint256 public weightCoefficientDenominator;
    mapping(address => Collateral) public collaterals;
    address[] public validatorAddresses;
    address[] public collateralAddresses;
    address[] public strategyControllerAddresses;
    mapping(address => bool) public strategyControllerExists;
    IPriceConsumer public priceConsumer;
    ISwapProxy public swapProxy; // proxy to convert the collected rewards into other collaterals
    address public slashingTreasury;

    /* ========== ERRORS ========== */

    error AdminBadRole();
    error CollateralDisabled();
    error CollateralLimited();
    error WrongArgument();
    error WrongRequest(uint256 id);
    error AlreadyExecuted(uint256 id);
    error AccessDenied();

    error DelegatorActionPaused();
    error RequestPaused(uint256 id);
    error Timelock();
    error AlreadyExists();
    error NotExists();
    error ZeroAmount();
    error ZeroAddress();
    error WrongAmount();

    /* ========== MODIFIERS ========== */

    modifier onlyAdmin() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert AdminBadRole();
        _;
    }

    modifier collateralEnabled(address _collateral) {
        if (!collaterals[_collateral].isEnabled) revert CollateralDisabled();
        _;
    }

    modifier notZeroAddress(address _address) {
        if (_address == address(0)) revert ZeroAddress();
        _;
    }
    /* ========== Events ========== */

    event Staked(
        address sender,
        address receiver,
        address validator,
        address collateral,
        uint256 stakeAmount,
        uint256 receivedShares
    );
    event UnstakeRequested(
        address delegator,
        address validator,
        address collateral,
        address receipient,
        uint256 timelock,
        uint256 shares,
        uint256 tokenAmount,
        uint256 index
    );

    event ValidatorRewardsExchanged(
        address _validator,
        address _admin,
        address _collateral,
        uint256 _rewardAmount
    );

    event SlashedUnstakeRequest(
        address delegator,
        address validator,
        address collateral,
        uint256 slashedAmount,
        uint256 index
    );

    event SlashedValidatorCollateral(address validator, address collateral, uint256 slashedAmount);

    event SlashedValidatorRewards(address validator, address collateral, uint256 slashedAmount);

    event UnstakeExecuted(
        address delegator,
        address validator,
        address collateral,
        uint256 amount,
        uint256 withdrawalId
    );
    event UnstakeCancelled(address delegator, address validator, uint256 withdrawalId);
    event UnstakePaused(address validator, uint256 withdrawalId, bool paused);
    event Liquidated(address validator, address collateral, uint256 amount);
    event SlashedDelegator(
        address delegator,
        address validator,
        address collateral,
        uint256 shares,
        uint256 amount
    );

    event LiquidatedDelegator(
        address delegator,
        address validator,
        address collateral,
        uint256 amount
    );
    event DepositedToStrategy(
        address validator,
        address delegator,
        uint256 amount,
        address strategy,
        address collateral
    );
    event WithdrawnFromStrategy(
        address validator,
        address delegator,
        uint256 amount,
        address strategy,
        address collateral
    );
    
    event RecoveredFromEmergency(
        address validator,
        uint256 amount,
        address strategy,
        address collateral
    );
    event RewardsReceived(address token, uint256 amount);
    event RewardsDistributed(address rewardToken, uint256 rewardAmount);
    event WithdrawSlashingTreasury(address collateral, uint256 amount);
    event UpdateSlashingTreasury(address newTreasury);
    event WithdrawTimelockUpdated(uint256 newTimelock);

    event UpdateCollateralEnabled(address collateral, bool isEnabled);
    event UpdateCollateral(address collateral, uint256 maxStakeAmount);
    event UpdateRewardWeight(address validator, uint256 value);
    event EnableValidator(address validator, bool isEnabled);

    /* PUBLIC */

    /**
     * @dev Initializer that initializes the most important configurations.
     * @param _withdrawTimelock Duration of withdrawal timelock.
     * @param _priceConsumer Price consumer contract.
     * @param _slashingTreasury Address of slashing treasury.
     */
    function initialize(
        uint256 _withdrawTimelock,
        IPriceConsumer _priceConsumer,
        ISwapProxy _swapProxy,
        address _slashingTreasury
    ) public initializer {
        // Grant the contract deployer the default admin role: it will be able
        // to grant and revoke any roles
        if (
            _slashingTreasury == address(0) ||
            address(_swapProxy) == address(0) ||
            address(_priceConsumer) == address(0)
        ) revert ZeroAddress();
        if (_withdrawTimelock == 0) revert WrongAmount();

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        withdrawTimelock = _withdrawTimelock;
        priceConsumer = _priceConsumer;
        swapProxy = _swapProxy;
        slashingTreasury = _slashingTreasury;
        minProfitSharingBPS = 5000;

        __ReentrancyGuard_init();
    }

    /**
     * @dev stake collateral to validator.
     * @param _receiver Delegator receiver address.
     * @param _validator Validator address.
     * @param _collateral address of collateral
     * @param _amount Amount to stake.
     */
    function stake(
        address _receiver,
        address _validator,
        address _collateral,
        uint256 _amount
    ) external nonReentrant whenNotPaused collateralEnabled(_collateral) notZeroAddress(_receiver) {
        ValidatorInfo storage validator = getValidatorInfo[_validator];
        if (validator.delegatorActionPaused) revert DelegatorActionPaused();
        ValidatorCollateral storage validatorCollateral = validator.collateralPools[_collateral];
        if (validatorCollateral.stakedAmount + _amount > collaterals[_collateral].maxStakeAmount)
            revert CollateralLimited();
        DelegatorsInfo storage delegator = validatorCollateral.delegators[_receiver];

        IERC20Upgradeable(_collateral).safeTransferFrom(msg.sender, address(this), _amount);

        // Calculate amount of shares to be issued to delegator
        uint256 shares = DelegatedStakingHelper._calculateShares(
            _amount,
            validatorCollateral.shares,
            validatorCollateral.stakedAmount
        );

        //Increase total collateral of the protocol for this asset
        collaterals[_collateral].totalLocked += _amount;
        //Increase total collateral of the validator for this asset
        validatorCollateral.stakedAmount += _amount;
        validatorCollateral.shares += shares;
        delegator.shares += shares;

        emit Staked(msg.sender, _receiver, _validator, _collateral, _amount, shares);
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
    ) external nonReentrant whenNotPaused notZeroAddress(_recipient) {
        ValidatorInfo storage validator = getValidatorInfo[_validator];
        if (validator.delegatorActionPaused) revert DelegatorActionPaused();
        WithdrawalRequests storage withdrawalRequests = getWithdrawalRequests[_validator];
        uint256 delegatorShares = validator.collateralPools[_collateral].delegators[msg.sender].shares;

        //if amount is equal to uint(-1), the user wants to redeem everything
        if (_shares == type(uint256).max) {
            _shares = delegatorShares;
        } else if (_shares > delegatorShares) {
            revert WrongAmount();
        }

        // TODO: handle locked shares to strategy

        uint256 withdrawTokenAmount = getAmountByShares(_validator, _collateral, _shares);

        if (withdrawTokenAmount == 0) revert ZeroAmount();

        changeVirtualBalances(_validator, _collateral, msg.sender, withdrawTokenAmount, _shares, false);

        uint256 withdrawIndex = withdrawalRequests.count;
        uint256 timelock = block.timestamp + withdrawTimelock;
        WithdrawalInfo storage withdraw = withdrawalRequests.withdrawals[withdrawIndex];
        withdraw.delegator = msg.sender;
        withdraw.amount = withdrawTokenAmount;
        withdraw.timelock = timelock;
        withdraw.receiver = _recipient;
        withdraw.collateral = _collateral;
        //TODO: we can start from 1. If will be changed change everywhere 'currentWithdrawId >= maxCount' to 'currentWithdrawId > maxCount'
        withdrawalRequests.count++;
        emit UnstakeRequested(
            msg.sender,
            _validator,
            _collateral,
            _recipient,
            timelock,
            _shares,
            withdrawTokenAmount,
            withdrawIndex
        );
    }

    /**
     * @dev Execute withdrawal requests.
     * @param _validator Validator address.
     * @param _withdrawIds Withdrawal identifiers.
     */
    function executeUnstake(address _validator, uint256[] calldata _withdrawIds)
        external
        nonReentrant
        whenNotPaused
    {
        if (getValidatorInfo[_validator].delegatorActionPaused) revert DelegatorActionPaused();
        WithdrawalRequests storage withdrawalRequests = getWithdrawalRequests[_validator];
        uint256 maxCount = withdrawalRequests.count;
        for (uint256 i = 0; i < _withdrawIds.length; i++) {
            uint256 currentWithdrawId = _withdrawIds[i];
            if (currentWithdrawId >= maxCount) revert WrongRequest(currentWithdrawId);
            WithdrawalInfo storage withdrawal = withdrawalRequests.withdrawals[currentWithdrawId];
            if (withdrawal.executed) revert AlreadyExecuted(currentWithdrawId);
            if (withdrawal.paused) revert RequestPaused(currentWithdrawId);
            if (withdrawal.timelock > block.timestamp) revert Timelock();

            withdrawal.executed = true;
            uint256 withdrawAmount = withdrawal.amount - withdrawal.slashingAmount; // I think this is already accounted for on L#428
            IERC20Upgradeable(withdrawal.collateral).safeTransfer(withdrawal.receiver, withdrawAmount);
            emit UnstakeExecuted(
                withdrawal.delegator,
                _validator,
                withdrawal.collateral,
                withdrawAmount,
                currentWithdrawId
            );
        }
    }

    /**
     * @dev Cancel unstake.
     * @param _validator Validator address.
     * @param _withdrawIds Withdrawal identifiers.
     */
    function cancelUnstake(address _validator, uint256[] calldata _withdrawIds)
        external
        nonReentrant
        whenNotPaused
    {
        if (getValidatorInfo[_validator].delegatorActionPaused) revert DelegatorActionPaused();
        WithdrawalRequests storage withdrawalRequests = getWithdrawalRequests[_validator];
        // uint256 maxCount = withdrawalRequests.count;
        for (uint256 i = 0; i < _withdrawIds.length; i++) {
            uint256 currentWithdrawId = _withdrawIds[i];
            //We will check 'msg.sender != withdrawal.delegator' this extra check
            // if (currentWithdrawId >= maxCount) revert WrongRequest(currentWithdrawId);
            WithdrawalInfo storage withdrawal = withdrawalRequests.withdrawals[currentWithdrawId];
            if (withdrawal.executed) revert AlreadyExecuted(currentWithdrawId);
            if (withdrawal.paused) revert RequestPaused(currentWithdrawId);
            if (msg.sender != withdrawal.delegator) revert AccessDenied();
            withdrawal.executed = true;

            changeVirtualBalances(_validator, withdrawal.collateral, withdrawal.delegator, withdrawal.amount, 0, true);
            emit UnstakeCancelled(withdrawal.delegator, _validator, currentWithdrawId);
        }
    }

    /**
    * @dev Slash validator rewards.
    * @param _validator Validator address.
    * @param _collateral Collateral address.
    * @param _bpsAmount Basis points to be slashed.
    */
    function slashValidatorRewards(
        address _validator,
        address _collateral,
        uint256 _bpsAmount
    ) public onlyAdmin {
        Collateral storage collateral = collaterals[_collateral];
        uint256 slashingFraction = _bpsAmount/BPS_DENOMINATOR;
        uint256 _slashAmount = getValidatorInfo[_validator].collateralPools[_collateral].rewardsForWithdrawal * slashingFraction;
        //TODO: a strange sense, which only increases slashedAmount
        collateral.slashedAmount += _slashAmount;
        emit SlashedValidatorRewards(_validator, _collateral, _slashAmount);
    }

    /**
     * @dev Stake token to strategies to earn rewards
     * @param _validator address of validator
     * @param _shares Shares to be staked
     * @param _strategy strategy to stake into.
     */
    function depositToStrategy(address _validator, uint256 _shares, address _strategy, address _stakeToken)
        external
        nonReentrant
        whenNotPaused
    {   
        // TODO: getStrategyControllerByValidator and Underlying Protocol function
        IStrategy strategyController = IStrategy(_strategy);
        ValidatorCollateral storage validatorCollateral = getValidatorInfo[_validator].collateralPools[_stakeToken];
        DelegatorsInfo storage delegation = validatorCollateral.delegators[msg.sender];
        if ((delegation.shares - delegation.locked) < _shares) revert WrongAmount();

        uint256 _amount = getAmountByShares(_validator, _stakeToken, _shares);
        delegation.locked += _shares;
        validatorCollateral.locked += _shares;
        collaterals[_stakeToken].totalLocked -= _amount;

        IERC20(_stakeToken).safeApprove(address(strategyController), 0);
        IERC20(_stakeToken).safeApprove(address(strategyController), _amount);
        strategyController.deposit(_stakeToken, _validator, msg.sender, _amount);


        emit DepositedToStrategy(_validator, msg.sender, _amount, _strategy, _stakeToken);
    }

    /**
     * @dev Withdraw token from strategies to claim rewards
     * @param _validator address of validator
     * @param _lockedShares number of shares to redeem
     * @param _strategy strategy to withdraw from.
     */
    function withdrawFromStrategy(address _validator, uint256 _lockedShares, address _strategy, address _stakeToken)
        external
        nonReentrant
        whenNotPaused
    {
        IStrategy strategyController = IStrategy(_strategy);
        ValidatorCollateral storage validatorCollateral = getValidatorInfo[_validator].collateralPools[_stakeToken];
        DelegatorsInfo storage delegation = validatorCollateral.delegators[msg.sender];
        if (_lockedShares > delegation.locked) revert WrongAmount();
        
        uint256 beforeBalance = IERC20(_stakeToken).balanceOf(address(this));
        (bool hasProfit, uint256 protfitLossAmount) = strategyController.withdraw(_stakeToken, _validator, msg.sender, _lockedShares);
        uint256 receivedAmount = IERC20(_stakeToken).balanceOf(address(this)) - beforeBalance;
        uint256 profitLossShares = getSharesByAmount(_validator, _stakeToken, protfitLossAmount);

        if (hasProfit) {
            changeVirtualBalances(_validator, _stakeToken, msg.sender, protfitLossAmount, profitLossShares, true);
            delegation.accumulatedRewards += protfitLossAmount;
            validatorCollateral.accumulatedRewards += protfitLossAmount;
            collaterals[_stakeToken].rewards += protfitLossAmount;
        } else {
            changeVirtualBalances(_validator, _stakeToken, msg.sender, protfitLossAmount, profitLossShares, false);
            delegation.accumulatedRewards -= protfitLossAmount;
            validatorCollateral.accumulatedRewards -= protfitLossAmount;
            collaterals[_stakeToken].rewards -= protfitLossAmount;
        }

        collaterals[_stakeToken].totalLocked += receivedAmount;        
        delegation.locked -= _lockedShares;
        validatorCollateral.locked -= _lockedShares;

        emit WithdrawnFromStrategy(_validator, msg.sender, receivedAmount, _strategy, _stakeToken);
    }

    // /**
    //  * @dev Recovers user share of all funds emergency withdrawn from the strategy.
    //  * @param _strategy Strategy to recover from.
    //  * @param _stakeToken Address of collateral.
    //  * @param _validators Array of validator addresses.
    //  */
    // function recoverFromEmergency(address _strategy, address _stakeToken, address[] calldata _validators)
    //     external
    //     nonReentrant
    //     whenNotPaused
    // {
    //     _recoverFromEmergency(_strategy, _stakeToken, _validators);
    // }

    // /**
    //  * @dev Recovers user share of all funds emergency withdrawn from the strategy.
    //  * @param _strategy Strategy to recover from.
    //  * @param _stakeToken Address of collateral.
    //  * @param _validators Array of validator addresses.
    //  */
    // function _recoverFromEmergency(address _strategy, address _stakeToken, address[] memory _validators) internal {
    //     IStrategy strategyController = IStrategy(_strategy);
    //     bool strategyEnabled;
    //     bool strategyRecoverable;
    //     (strategyEnabled, strategyRecoverable) = strategyController.strategyInfo(_stakeToken);
    //     if (!strategyEnabled || !strategyRecoverable) revert StrategyDisabled();
    //     for (uint256 i=0; i<_validators.length; i++) {
    //         ValidatorInfo storage validator = getValidatorInfo[_validators[i]];
    //         ValidatorCollateral storage validatorCollateral = validator.collateralPools[_stakeToken];

    //         uint256 fullAmount = DelegatedStakingHelper._calculateFromShares(
    //             validatorCollateral.locked, validatorCollateral.stakedAmount, validatorCollateral.shares);
    //         uint256 strategyAmount = strategyController.calculateFromShares(_stakeToken, validatorCollateral.locked);
    //         // TODO 1: can be negative if strategy profits. Need to check it
    //         // TODO 2: нужно уточнить как это вообще должно работать:) Мы тут вычитаем все что было залокано в стратегии, считая это утерянным или что?
    //         uint256 lost = fullAmount - strategyAmount;
    //         validatorCollateral.locked -= strategyController.validatorShares(_stakeToken, _validators[i]);
    //         validatorCollateral.stakedAmount -= lost;

    //         // for (uint256 k=0; k<validator.delegatorCount; k++) {
    //         //     DelegatorsInfo storage delegation = validatorCollateral.delegators[validator.delegatorAddresses[k]];
    //         //     if (delegation.strategyShares[_strategy] == 0) continue;
    //         //     delegation.locked -= delegation.strategyShares[_strategy];
    //         //     delegation.strategyShares[_strategy] = 0;
    //         // }
    //         emit RecoveredFromEmergency(_validators[i], lost, _strategy, _stakeToken);
    //     }
    // }

    /**
     * @dev Receive protocol rewards.
     * @param _rewardToken Address of reward token.
     * @param _amount Amount of reward tokem.
     */
    function sendRewards(address _rewardToken, uint256 _amount)
        external
        nonReentrant
        whenNotPaused
        collateralEnabled(_rewardToken)
    {
        IERC20Upgradeable(_rewardToken).safeTransferFrom(msg.sender, address(this), _amount);
        getRewardsInfo[_rewardToken].totalAmount += _amount;

        emit RewardsReceived(_rewardToken, _amount);
    }

    /**
     * @dev Calculates rewards to swapped and credited to validators collateral
     * @param _rewardToken address of reward token
     * @param _rewardAmount amount of reward token
     */
    function _calculateAndUpdateValidatorRewards(address _rewardToken, uint256 _rewardAmount)
        internal
        returns (uint256[] memory, uint256[][] memory)
    {
        uint256 collateralLength = collateralAddresses.length;
        uint256[] memory collectedRewards = new uint256[](collateralLength);
        uint256[][] memory validatorRewards = new uint256[][](validatorAddresses.length);
        //TODO: avoid Stack too deep
        address rewardToken = _rewardToken;
        for (uint256 v = 0; v < validatorAddresses.length; v++) {
            address validatorAddress = validatorAddresses[v];
            ValidatorInfo storage validator = getValidatorInfo[validatorAddress];
            uint256 validatorAmount = (validator.rewardWeightCoefficient * _rewardAmount) /
                weightCoefficientDenominator;
            uint256 delegatorsAmount = (validatorAmount * validator.profitSharingBPS) /
                BPS_DENOMINATOR;

            (uint256[] memory poolsETHAmounts, uint256 totalETHAmount) = getTotalETHAmount(
                validatorAddress
            );

            uint256[] memory tempValidatorRewards = new uint256[](collateralLength);
            for (uint256 c = 0; c < collateralLength; c++) {
                uint256 delegatorReward = (delegatorsAmount * poolsETHAmounts[c]) / totalETHAmount;
                if (rewardToken == collateralAddresses[c]) {
                    ValidatorCollateral storage validatorRewardCollateral = validator
                        .collateralPools[rewardToken];
                    validatorRewardCollateral.stakedAmount += delegatorReward;
                    validatorRewardCollateral.accumulatedRewards += validatorAmount;
                    validatorRewardCollateral.rewardsForWithdrawal +=
                        validatorAmount -
                        delegatorsAmount;

                    collaterals[rewardToken].totalLocked += delegatorReward;
                    collaterals[rewardToken].rewards += delegatorReward;
                    // tempValidatorRewards[c] = 0;
                    // collectedRewards[c] += 0;
                } else {
                    tempValidatorRewards[c] = delegatorReward;
                    collectedRewards[c] += delegatorReward;
                }
            }
            validatorRewards[v] = tempValidatorRewards;
        }
        return (collectedRewards, validatorRewards);
    }

    /**
     * @dev Distributes validator rewards to validator/delegators
     * @param _rewardToken address of reward token
     */
    function distributeValidatorRewards(address _rewardToken)
        external
        nonReentrant
        whenNotPaused
        collateralEnabled(_rewardToken)
    {
        RewardInfo storage rewardInfo = getRewardsInfo[_rewardToken];
        uint256 _rewardAmount = rewardInfo.totalAmount - rewardInfo.distributed;
        if (_rewardAmount == 0) revert ZeroAmount();
        rewardInfo.distributed += _rewardAmount;

        // we need to know how much tokens to swap for each pool;
        // Sample
        //         bob			        david			        sarah
        //        LINK	USDC	USDT	LINK	USDC	USDT	LINK	USDC	USDT

        // ALICE  2000	10000	10000	1000	10000	10000	1000	10000	10000

        // EVE	  1000	10000	10000	1000	20000	10000	1000	10000	10000

        // SAM	  1000	10000	10000	1000	10000	10000	1000	10000	20000
        // profitSharingBPS 50          75                      100
        // we distrubute reward 1800 USDT (600 USDT for each validator)
        // bob will have 300 usdt and his validators 300 usdt
        // link price 25 usd
        // bob                  LINK	                    USDC	            USDT
        // Pool cost in USD     4000*25=100000                      30000               30000
        // will receive usdt    100000*300/160000=187,5     56,25               56,25
        // we need to swap  187,5 usdt to link and just increment link collateral.totalStaked += receivedLinkAmount;
        // we need to swap  56,25 usdt to usdc and just increment usdc collateral.totalStaked += receivedUSDCAmount;
        // We don't need to create swap for each validators pool. Firs we need to calulate total Link to swap

        // uint256[] memory collectedRewards = new uint256[](collateralAddresses.length);
        // uint256[][] memory validatorRewards = new uint256[][](validatorAddresses.length);
        (
            uint256[] memory collectedRewards,
            uint256[][] memory validatorRewards
        ) = _calculateAndUpdateValidatorRewards(_rewardToken, _rewardAmount);

        for (uint256 cc = 0; cc < collateralAddresses.length; cc++) {
            address currentCollateral = collateralAddresses[cc];
            uint256 tokenRewardAmount = collectedRewards[cc];

            if (currentCollateral == _rewardToken || tokenRewardAmount == 0) {
                continue;
            }

            // transfer direct to our swap contract
            IERC20Upgradeable(_rewardToken).safeTransfer(address(swapProxy), tokenRewardAmount);

            uint256 balanceBefore = IERC20Upgradeable(currentCollateral).balanceOf(address(this));
            swapProxy.swap(_rewardToken, currentCollateral, address(this));
            uint256 balanceAfter = IERC20Upgradeable(currentCollateral).balanceOf(address(this));
            // override amount to received swapped tokens
            tokenRewardAmount = balanceAfter - balanceBefore;
            collaterals[currentCollateral].totalLocked += tokenRewardAmount;
            collaterals[currentCollateral].rewards += tokenRewardAmount;

            // now we need to split amountOut for each current collateral between validator pools
            for (uint256 vv = 0; vv < validatorAddresses.length; vv++) {
                uint256 postSwapRewardAmount =
                    (validatorRewards[vv][cc] * tokenRewardAmount) /
                    collectedRewards[cc];
                ValidatorCollateral storage validatorCollateral = getValidatorInfo[
                    validatorAddresses[vv]
                ].collateralPools[currentCollateral];
                validatorCollateral.stakedAmount += postSwapRewardAmount;
                validatorCollateral.accumulatedRewards += postSwapRewardAmount;
            }
        }
        emit RewardsDistributed(_rewardToken, _rewardAmount);
    }

    function exchangeValidatorRewards(address _validator, address _collateral)
        external
        nonReentrant
        whenNotPaused
    {
        ValidatorInfo storage validator = getValidatorInfo[_validator];
        if (validator.delegatorActionPaused) revert DelegatorActionPaused();
        ValidatorCollateral storage validatorCollateral = validator.collateralPools[_collateral];
        DelegatorsInfo storage admin = validatorCollateral.delegators[validator.admin];
        uint256 rewardAmount = validatorCollateral.rewardsForWithdrawal;
        uint256 rewardShares = getSharesByAmount(_validator, _collateral, rewardAmount);
        if (rewardShares == 0) revert ZeroAmount();

        validatorCollateral.rewardsForWithdrawal -= rewardAmount;
        collaterals[_collateral].totalLocked += rewardAmount;
        validatorCollateral.stakedAmount += rewardAmount;
        validatorCollateral.shares += rewardShares;
        admin.accumulatedRewards += rewardAmount;
        admin.shares += rewardShares;
        emit ValidatorRewardsExchanged(_validator, validator.admin, _collateral, rewardAmount);
    }

    /* ========== VALIDATOR SETTINGS ========== */

    /**
     * @dev set basis points of profit sharing
     * @param _validator address of validator
     * @param _profitSharingBPS profit sharing basis points
     */
    function setProfitSharing(address _validator, uint256 _profitSharingBPS)
        external
        nonReentrant
        whenNotPaused
    {
        ValidatorInfo storage validator = getValidatorInfo[_validator];
        if (validator.admin != msg.sender) revert AdminBadRole();
        if (_profitSharingBPS < minProfitSharingBPS || _profitSharingBPS > BPS_DENOMINATOR)
            revert WrongArgument();
        validator.profitSharingBPS = _profitSharingBPS;
    }

    /* ========== ADMIN ========== */

    /**
     * @dev Withdraws all funds from the strategy.
     * @param _strategy Strategy to withdraw from.
     */
    function emergencyWithdrawFromStrategy(address _strategy, address _stakeToken)
        external
        onlyAdmin
    {
        uint256 beforeBalance = IERC20(_stakeToken).balanceOf(address(this));
        IStrategy(_strategy).withdrawAll(_stakeToken);
        uint256 receivedAmount = IERC20(_stakeToken).balanceOf(address(this)) - beforeBalance;
        collaterals[_stakeToken].totalLocked += receivedAmount;
    }

    /**
     * @dev Confiscate collateral.
     * @param _validator Validator address.
     * @param _collaterals Collateral addresses.
     * @param _slashPPM Slashing ppm (1e6 DENOMINATOR)
     */
    function liquidate(address _validator, address[] calldata _collaterals, uint256 _slashPPM) external onlyAdmin { //TODO:_bpsAmount to ppmNumerator
        ValidatorInfo storage validator = getValidatorInfo[_validator];
        //TODO: removed
         uint256 _delegatorBPS = validator.profitSharingBPS * _slashPPM / BPS_DENOMINATOR;
         uint256 validatorBPS = _slashPPM - _delegatorBPS;

         //slashUnstakeRequests(_validator, , , _delegatorBPS * (10 ** (18 - BPS_DENOMINATOR))); TODO

        for (uint256 i=0; i<_collaterals.length; i++) {
            address _collateral = _collaterals[i];
            uint256 delegatorBPS = _delegatorBPS;
            ValidatorCollateral storage validatorCollateral = validator.collateralPools[_collateral];
            uint256 adminCollateralShares = validatorCollateral.delegators[validator.admin].shares;
            Collateral storage collateral = collaterals[_collateral];
            uint256 totalSlashed;
            // slash admin start
            if (adminCollateralShares/validatorCollateral.shares < validatorBPS) {
                _liquidateDelegator(_validator, validator.admin, _collateral, BPS_DENOMINATOR);
                delegatorBPS += validatorBPS - adminCollateralShares/validatorCollateral.shares;
            } else {
                _liquidateDelegator(_validator, validator.admin, _collateral, validatorBPS);
            }
            slashValidatorRewards(_validator, _collateral, validatorBPS);
            // slash admin end
            
            // slash strategy deposits
            address validatorAddress = _validator; // re-assigning to avoid 'stack too deep'
            for (uint256 j=0; j<strategyControllerAddresses.length; j++) {
                uint256 receivedAmount = IStrategy(strategyControllerAddresses[j]).slashValidatorDeposits(validatorAddress, _collateral, delegatorBPS / BPS_DENOMINATOR);
                validatorCollateral.stakedAmount -= receivedAmount;
                // TODO: receivedAmount change to shares
                validatorCollateral.locked -= receivedAmount;
                collateral.slashedAmount += receivedAmount;
                totalSlashed += receivedAmount;
            }

            // slash unlocked collateral
            uint256 slashedAmount = getAmountByShares(validatorAddress, _collateral, (validatorCollateral.shares - validatorCollateral.locked) * delegatorBPS / BPS_DENOMINATOR);

            validatorCollateral.stakedAmount -= slashedAmount;
            collateral.slashedAmount += slashedAmount;
            collateral.totalLocked -= slashedAmount;
            totalSlashed += slashedAmount;

            IERC20(_collateral).safeTransfer(slashingTreasury, totalSlashed);
            emit Liquidated(validatorAddress, _collateral, totalSlashed);
        }
    }

    /**
     * @dev Confiscate delegator collateral.
     * @param _validator Validator address.
     * @param _delegator Delegator address.
     * @param _collateral Index of collateral.
     * @param _bpsAmount Basis points to slash.
     */
    function _liquidateDelegator(address _validator, address _delegator, address _collateral, uint256 _bpsAmount) internal {
        ValidatorCollateral storage validatorCollateral = getValidatorInfo[_validator].collateralPools[_collateral];
        Collateral storage collateral = collaterals[_collateral];
        uint256 slashingFraction = _bpsAmount/BPS_DENOMINATOR;
        uint256 totalSlashed;

        // slash strategy deposits
        for (uint i=0; i<strategyControllerAddresses.length; i++) {
            IStrategy strategyController = IStrategy(strategyControllerAddresses[i]);
            uint256 beforeBalance = IERC20(_collateral).balanceOf(address(this));
            strategyController.slashDelegatorDeposits(_validator, _delegator, _collateral, slashingFraction);
            uint256 receivedAmount = IERC20(_collateral).balanceOf(address(this)) - beforeBalance;
            uint256 slashedStrategyShares = changeVirtualBalances(_validator, _collateral, _delegator, receivedAmount, 0, false);

            validatorCollateral.delegators[_delegator].locked -= slashedStrategyShares;
            validatorCollateral.locked -= slashedStrategyShares;
            collateral.slashedAmount += receivedAmount;
        }

        // slash delegation collateral start
        uint256 _shares = (validatorCollateral.shares - validatorCollateral.locked) * slashingFraction;
        uint256 slashedAmount = getAmountByShares(_validator, _collateral, _shares); 
        changeVirtualBalances(_validator, _collateral, _delegator, slashedAmount, _shares, false);
        collateral.slashedAmount += slashedAmount;
        totalSlashed += slashedAmount;
        // slash delegation collateral end

        IERC20(_collateral).safeTransfer(slashingTreasury, totalSlashed);
        emit LiquidatedDelegator(_delegator, _validator, _collateral, totalSlashed);
    }

    function liquidateDelegator(address _validator, address _delegator, address _collateral, uint256 _bpsAmount) external onlyAdmin {
        _liquidateDelegator(_validator, _delegator, _collateral, _bpsAmount);
    }

    /**
     * @dev Updates slashing treasury address.
     * @param _newTreasury New slashing treasury address.
     */
    function updateSlashingTreasury(address _newTreasury)
        external
        onlyAdmin
        notZeroAddress(_newTreasury)
    {
        slashingTreasury = _newTreasury;
        emit UpdateSlashingTreasury(_newTreasury);
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
    ) external onlyAdmin notZeroAddress(_validator) notZeroAddress(_admin) {
        if (_profitSharingBPS < minProfitSharingBPS || _profitSharingBPS > BPS_DENOMINATOR)
            revert WrongArgument();

        ValidatorInfo storage validator = getValidatorInfo[_validator];
        if (!validator.exists) {
            validatorAddresses.push(_validator);
        }
        validator.admin = _admin;
        validator.rewardWeightCoefficient = _rewardWeightCoefficient;
        weightCoefficientDenominator += _rewardWeightCoefficient;
        validator.profitSharingBPS = _profitSharingBPS;
        validator.exists = true;
        validator.isEnabled = true;
    }

    /**
     * @dev Update validator enabled status.
     * @param _validator Validator address.
     * @param _isEnabled Is validator enabled.
     */
    function setValidatorEnabled(address _validator, bool _isEnabled) external onlyAdmin {
        ValidatorInfo storage validator = getValidatorInfo[_validator];
        if (!validator.exists || validator.isEnabled == _isEnabled) revert WrongArgument();
        // If we enable validator
        if (_isEnabled) {
            validatorAddresses.push(_validator);
        }
        // If we disable validator
        else {
            for (uint256 i = 0; i < validatorAddresses.length; i++) {
                if (validatorAddresses[i] == _validator) {
                    validatorAddresses[i] = validatorAddresses[validatorAddresses.length - 1];
                    validatorAddresses.pop();
                }
            }
        }
        validator.isEnabled = _isEnabled;
        emit EnableValidator(_validator, _isEnabled);
    }

    /**
     * @dev Add a new collateral
     * @param _token Address of token
     */
    function addCollateral(address _token, uint256 _maxStakeAmount)
        external
        onlyAdmin
        notZeroAddress(_token)
    {
        Collateral storage collateral = collaterals[_token];
        if (collateral.exists) revert AlreadyExists();

        collateral.exists = true;
        collateral.isEnabled = true;
        collateral.decimals = ERC20(_token).decimals();
        collateral.maxStakeAmount = _maxStakeAmount;
        collateralAddresses.push(_token);
    }

    /**
     * @dev Update collateral enabled
     * @param _collateral address of collateral
     * @param _isEnabled bool of enable
     */
    function updateCollateralEnabled(address _collateral, bool _isEnabled) external onlyAdmin {
        Collateral storage collateral = collaterals[_collateral];
        if (!collateral.exists || collateral.isEnabled == _isEnabled) revert WrongArgument();
        if (_isEnabled) {
            collateralAddresses.push(_collateral);
        } else {
            for (uint256 i = 0; i < collateralAddresses.length; i++) {
                if (collateralAddresses[i] == _collateral) {
                    collateralAddresses[i] = collateralAddresses[collateralAddresses.length - 1];
                    collateralAddresses.pop();
                }
            }
        }
        collateral.isEnabled = _isEnabled;
        emit UpdateCollateralEnabled(_collateral, _isEnabled);
    }

    /**
     * @dev update collateral max amount
     * @param _collateral address of collateral
     * @param _maxStakeAmount max amount
     */
    function updateCollateral(address _collateral, uint256 _maxStakeAmount) external onlyAdmin {
        collaterals[_collateral].maxStakeAmount = _maxStakeAmount;
        emit UpdateCollateral(_collateral, _maxStakeAmount);
    }

    /**
     * @dev update validator reward weight coefficient
     * @param _validator address of validator
     * @param _value reward weight coefficient
     */
    function updateRewardWeight(address _validator, uint256 _value) external onlyAdmin {
        ValidatorInfo storage validator = getValidatorInfo[_validator];
        if (!validator.exists) revert NotExists();
        if (_value == 0) revert WrongAmount();
        weightCoefficientDenominator -= validator.rewardWeightCoefficient;
        validator.rewardWeightCoefficient = _value;
        weightCoefficientDenominator += _value;
        emit UpdateRewardWeight(_validator, _value);
    }

    /**
     * @dev Add a new strategy controller
     * @param _strategyController Strategy controller address
     */
    function addStrategyController(address _strategyController) external onlyAdmin {
        if (strategyControllerExists[_strategyController]) revert AlreadyExists();
        strategyControllerAddresses.push(_strategyController);
        strategyControllerExists[_strategyController] = true;
    }

    /**
     * @dev Pause/unpause unstaking request.
     * @param _validator Validator address.
     * @param _withdrawIds Withdraw requests ids.
     * @param _paused pause/unpause.
     */
    function pauseUnstakeRequests(
        address _validator,
        uint256[] memory _withdrawIds,
        bool _paused
    ) external onlyAdmin {
        WithdrawalRequests storage withdrawalRequests = getWithdrawalRequests[_validator];
        uint256 maxCount = withdrawalRequests.count;
        for (uint256 i = 0; i < _withdrawIds.length; i++) {
            uint256 currentWithdrawId = _withdrawIds[i];
            if (currentWithdrawId >= maxCount) revert WrongRequest(currentWithdrawId);
            WithdrawalInfo storage withdrawal = withdrawalRequests.withdrawals[currentWithdrawId];
            if (!withdrawal.executed) {
                withdrawal.paused = _paused;
                emit UnstakePaused(_validator, currentWithdrawId, _paused);
            }
        }
    }

    /**
     * @dev Set Price Consumer
     * @param _priceConsumer address of price consumer
     */
    function setPriceConsumer(IPriceConsumer _priceConsumer)
        external
        onlyAdmin
        notZeroAddress(address(_priceConsumer))
    {
        priceConsumer = _priceConsumer;
    }

    /**
     * @dev Set swap converter proxy.
     * @param _swapProxy Swap proxy address.
     */
    function setSwapProxy(ISwapProxy _swapProxy)
        external
        onlyAdmin
        notZeroAddress(address(_swapProxy))
    {
        if (address(_swapProxy) == address(0)) revert ZeroAddress();
        swapProxy = _swapProxy;
    }

    /**
     * @dev Change withdrawal timelock.
     * @param _newTimelock New timelock.
     */
    function setWithdrawTimelock(uint256 _newTimelock) external onlyAdmin {
        if (_newTimelock == 0) revert WrongAmount();
        withdrawTimelock = _newTimelock;
        emit WithdrawTimelockUpdated(_newTimelock);
    }

    /**
     * @dev set min basis points of profit sharing
     * @param _profitSharingBPS profit sharing basis points
     */
    function setMinProfitSharing(uint256 _profitSharingBPS) external onlyAdmin {
        if (_profitSharingBPS > BPS_DENOMINATOR) revert WrongArgument();
        for (uint256 i = 0; i < validatorAddresses.length; i++) {
            ValidatorInfo storage validator = getValidatorInfo[validatorAddresses[i]];
            if (validator.profitSharingBPS < _profitSharingBPS) {
                validator.profitSharingBPS = _profitSharingBPS;
            }
        }
        minProfitSharingBPS = _profitSharingBPS;
    }

    /* ========== SLASHING ========== */

    /**
     * @dev Slash withdrawal requests.
     * @param _validator Validator address.
     * @param _fromWithdrawId Starting from withdrawal identifier.
     * @param _toWithdrawId Up to withdrawal identifier.
     * @param _slashPPM Slashing ppm (1e6 DENOMINATOR)
     */
    function slashUnstakeRequests(
        address _validator,
        uint256 _fromWithdrawId,
        uint256 _toWithdrawId,
        uint256 _slashPPM
    ) public onlyAdmin {
        WithdrawalRequests storage withdrawalRequests = getWithdrawalRequests[_validator];
        if (_toWithdrawId >= withdrawalRequests.count) revert WrongArgument();
        //TODO: write test Do we have gas optimization when load to variable?
        address[] memory collateralAddresses_ = collateralAddresses;
        uint256[] memory slashingAmounts = new uint256[](collateralAddresses.length);
        for (
            uint256 currentWithdrawId = _fromWithdrawId;
            currentWithdrawId <= _toWithdrawId;
            currentWithdrawId++
        ) {
            WithdrawalInfo storage withdrawal = withdrawalRequests.withdrawals[currentWithdrawId];
            if (!withdrawal.executed) {
                uint256 slashingAmount = (withdrawal.amount * _slashPPM) / PPM_DENOMINATOR;
                withdrawal.amount = withdrawal.amount - slashingAmount;
                withdrawal.slashingAmount = slashingAmount;
                address collateralAddress = withdrawal.collateral;
                uint256 collateralIndex;
                // Find collateral index
                for (uint256 i = 0; i < collateralAddresses_.length; i++) {
                    if (collateralAddresses_[i] == collateralAddress) {
                        collateralIndex = i;
                        break;
                    }
                }
                // Increase slashing amount in local variable
                slashingAmounts[collateralIndex] += slashingAmount;

                emit SlashedUnstakeRequest(
                    withdrawal.delegator,
                    _validator,
                    withdrawal.collateral,
                    slashingAmount,
                    currentWithdrawId
                );
            }
        }

        for (uint256 i = 0; i < slashingAmounts.length; i++) {
            if (slashingAmounts[i] > 0) {
                collaterals[collateralAddresses_[i]].slashedAmount += slashingAmounts[i];
            }
        }
    }

    /**
     * @dev Slash validator.
     * @param _validator Validator address.
     * @param _collaterals Collaterals addresses.
     * @param _slashAmounts Amounts to be slashed.
     */
    function slashValidator(
        address _validator,
        address[] calldata _collaterals,
        uint256[] calldata _slashAmounts
    ) external onlyAdmin {
        if (_collaterals.length != _slashAmounts.length) revert WrongArgument();
        for (uint256 i = 0; i < _collaterals.length; i++) {
            address collateralAddress = _collaterals[i];
            uint256 slashAmount = _slashAmounts[i];
            Collateral storage collateral = collaterals[collateralAddress];
            //Decrease total collateral of the protocol for this asset
            collateral.totalLocked -= slashAmount;
            collateral.slashedAmount += slashAmount;
            //Decrease total collateral of the validator for this asset
            getValidatorInfo[_validator]
                .collateralPools[collateralAddress]
                .stakedAmount -= slashAmount;
            emit SlashedValidatorCollateral(_validator, collateralAddress, slashAmount);
        }
    }

    /**
     * @dev Slash delegator.
     * @param _delegator Delegator address.
     * @param _validator Validator address.
     * @param _collaterals Collaterals addresses.
     * @param _slashShares Shares to be confiscated.
     */
    function slashDelegator(
        address _delegator,
        address _validator,
        address[] calldata _collaterals,
        uint256[] calldata _slashShares
    ) external onlyAdmin {
        if (_collaterals.length != _slashShares.length) revert WrongArgument();
        for (uint256 i = 0; i < _collaterals.length; i++) {
            address collateralAddress = _collaterals[i];
            uint256 slashShare = _slashShares[i];
            uint256 slashedAmount = getAmountByShares(_validator, collateralAddress, slashShare); 

            changeVirtualBalances(_validator, collateralAddress, _delegator, slashedAmount, slashShare, false);
            collaterals[collateralAddress].slashedAmount += slashedAmount;

            emit SlashedDelegator(
                _delegator,
                _validator,
                collateralAddress,
                slashShare,
                slashedAmount
            );
        }
    }

    /**
     * @dev Withdraw collected slashed amounts of all assets to protocol slashing treasury address
     */
    function withdrawSlashingTreasury() external onlyAdmin {
        for (uint256 i = 0; i < collateralAddresses.length; i++) {
            address collateralAddress = collateralAddresses[i];
            Collateral storage currentCollateral = collaterals[collateralAddress];
            uint256 slashedAmount = currentCollateral.slashedAmount;
            if (slashedAmount > 0) {
                currentCollateral.slashedAmount = 0;
                IERC20Upgradeable(collateralAddress).safeTransfer(slashingTreasury, slashedAmount);
                emit WithdrawSlashingTreasury(collateralAddress, slashedAmount);
            }
        }
    }

    /* ========== INTERNAL ========== */

    /* ========== VIEW ========== */

    // /**
    //  * @dev Get price per share
    //  * @param _strategy Address of strategy
    //  * @param _collateral Address of collateral
    //  */
    // function getPricePerFullStrategyShare(address _strategy, address _stakeToken, address _collateral)
    //     external
    //     view
    //     returns (uint256)
    // {
    //     if (strategies[_strategy][_stakeToken].totalShares == 0) revert ZeroAmount();
    //     uint256 totalStrategyTokenReserves = IStrategy(_strategy).updateReserves(address(this), _collateral);
    //     return totalStrategyTokenReserves/strategies[_strategy][_stakeToken].totalShares;
    // }

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
        ValidatorCollateral storage validatorCollateral = getValidatorInfo[_validator]
            .collateralPools[_collateral];
        return
            (validatorCollateral.stakedAmount * 10 ** collaterals[_collateral].decimals) /
            validatorCollateral.shares;
    }

    /**
     * @dev Get ETH amount of validator collateral
     * @param _validator Address of validator
     * @param _collateral Address of collateral
     * @return ETH amount with decimals 18
     */
    function getPoolETHAmount(address _validator, address _collateral)
        public
        view
        returns (uint256)
    {
        return
            (getValidatorInfo[_validator].collateralPools[_collateral].stakedAmount *
                10**(18 - collaterals[_collateral].decimals) *
                priceConsumer.getPriceOfTokenInWETH(_collateral)) / 10**18;
    }

    /**
     * @dev Get total ETH amount of validator collateral
     * @param _validator Address of validator
     */
    function getTotalETHAmount(address _validator)
        public
        view
        returns (uint256[] memory poolsAmounts, uint256 totalAmount)
    {
        poolsAmounts = new uint256[](collateralAddresses.length);
        for (uint256 i = 0; i < collateralAddresses.length; i++) {
            uint256 poolAmount = getPoolETHAmount(_validator, collateralAddresses[i]);
            totalAmount += poolAmount;
            poolsAmounts[i] = poolAmount;
        }
        return (poolsAmounts, totalAmount);
    }

    /**
     * @dev Get withdrawal request.
     * @param _validator Validator address.
     * @param _withdrawalId Withdrawal identifier.
     */
    function getWithdrawalRequest(address _validator, uint256 _withdrawalId)
        external
        view
        returns (WithdrawalInfo memory)
    {
        return getWithdrawalRequests[_validator].withdrawals[_withdrawalId];
    }

    // /**
    //  * @dev Get strategy info
    //  * @param _strategy Strategy address
    //  * @param _stakeToken Stake token address
    //  */
    // function getStrategy(address _strategy, address _stakeToken) external view returns (Strategy memory) {
    //     return strategies[_strategy][_stakeToken];
    // }

    /**
     * @dev get delegator, collateral and protocol rewards
     * @param _validator address of validator
     * @param _collateral Address of collateral
     */
    function getRewards(address _validator, address _collateral)
        external
        view
        returns (uint256, uint256)
    {
        return (
            getValidatorInfo[_validator].collateralPools[_collateral].accumulatedRewards,
            collaterals[_collateral].rewards
        );
    }

    function getValidatorCollateral(address _validator, address _collateral)
        external
        view
        returns (
            uint256 stakedAmount,
            uint256 shares,
            uint256 locked,
            uint256 accumulatedRewards,
            uint256 rewardsForWithdrawal
        )
    {
        ValidatorCollateral storage item = getValidatorInfo[_validator].collateralPools[
            _collateral
        ];
        return (
            item.stakedAmount, // total tokens staked by delegators
            item.shares, // total share of collateral tokens
            item.locked, // total share locked by depositing to strategy
            item.accumulatedRewards, // how many reward tokens was earned
            item.rewardsForWithdrawal // how many reward tokens validator can withdrawal
        );
    }

    /**
     * @dev get delegator stakes: returns whether shares, locked shares and passed rewards
     * @param _validator address of validator
     * @param _collateral Address of collateral
     * @param _delegator address of delegator
     */
    function getDelegatorsInfo(
        address _validator,
        address _collateral,
        address _delegator
    )
        external
        view
        returns (
            uint256 shares, // delegator share of collateral tokens
            uint256 locked, // share locked by depositing to strategy
            // uint256 passedRewards, // rewards per collateral address, calculated before stake
            uint256 accumulatedRewards //info how many reward tokens were earned
        )
    {
        DelegatorsInfo storage item = getValidatorInfo[_validator]
            .collateralPools[_collateral]
            .delegators[_delegator];
        return (
            item.shares, // delegator share of collateral tokens
            item.locked, // share locked by depositing to strategy
            // item.passedRewards, // rewards per collateral address, calculated before stake
            item.accumulatedRewards //info how many reward tokens were earned
        );
    }

    function getAmountByShares(address _validator, address _collateral, uint256 shares) internal returns (uint256) {
        return DelegatedStakingHelper._calculateFromShares(
            shares,
            getValidatorInfo[_validator].collateralPools[_collateral].stakedAmount,
            getValidatorInfo[_validator].collateralPools[_collateral].shares
        );
    }

    function getSharesByAmount(address _validator, address _collateral, uint256 amount) internal returns (uint256) {
        return DelegatedStakingHelper._calculateShares(
            amount,
            getValidatorInfo[_validator].collateralPools[_collateral].shares,
            getValidatorInfo[_validator].collateralPools[_collateral].stakedAmount
        );
    }

    function changeVirtualBalances(address _validator, address _collateral, address _delegator, uint256 _amount, uint256 _shares, bool increase) internal returns (uint256) {
        ValidatorCollateral storage validatorCollateral = getValidatorInfo[_validator].collateralPools[_collateral];
        Collateral storage collateral = collaterals[_collateral];
        uint256 shares = _shares == 0
            ? DelegatedStakingHelper._calculateShares(
                _amount,
                validatorCollateral.shares,
                validatorCollateral.stakedAmount)
            : _shares;

        if (increase) {
            validatorCollateral.stakedAmount += _amount;
            collateral.totalLocked += _amount;
            validatorCollateral.shares += shares;
            validatorCollateral.delegators[_delegator].shares += shares;
        } else {
            validatorCollateral.stakedAmount -= _amount;
            collateral.totalLocked -= _amount;
            validatorCollateral.shares -= shares;
            validatorCollateral.delegators[_delegator].shares -= shares;
        }

        return shares;
    }

    // /**
    //  * @dev Get total stake to strategy: returns total reserve amount, total shares and total rewards
    //  * @param _strategy Address of strategy
    //  */
    // function getStrategyStakes(address _strategy, address _stakeToken) external view returns(uint256, uint256, uint256) {
    //     IStrategy strategyController = IStrategy(_strategy);
    //     return (
    //         strategyController.totalReserves(_stakeToken),
    //         strategyController.totalShares(_stakeToken),
    //         strategyController.rewards(_stakeToken)
    //     );
    // }

    // TODO: rewrite tests to use strategy instead this
    // function getStrategyDepositInfo(address _validator, address _strategy, address _stakeToken)
    //     external
    //     view
    //     returns(uint256)
    // {
    //     return IStrategy(_strategy).validatorShares(_stakeToken, _validator);
    // }

    // ============ Version Control ============
    function version() external pure returns (uint256) {
        return 101; // 1.0.1
    }
}
