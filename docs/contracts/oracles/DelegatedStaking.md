## `DelegatedStaking`





### `onlyAdmin()`





### `collateralEnabled(address _collateral)`





### `notZeroAddress(address _address)`






### `initialize(uint256 _withdrawTimelock, contract IPriceConsumer _priceConsumer, contract ISwapProxy _swapProxy, address _slashingTreasury)` (public)



Initializer that initializes the most important configurations.


### `stake(address _receiver, address _validator, address _collateral, uint256 _amount)` (external)



stake collateral to validator.


### `requestUnstake(address _validator, address _collateral, address _recipient, uint256 _shares)` (external)



Withdraws validator reward.


### `executeUnstake(address _validator, uint256[] _withdrawIds)` (external)



Execute withdrawal requests.


### `cancelUnstake(address _validator, uint256[] _withdrawIds)` (external)



Cancel unstake.


### `sendRewards(address _rewardToken, uint256 _amount)` (external)



Receive protocol rewards.


### `_calculateAndUpdateValidatorRewards(address _rewardToken, uint256 _rewardAmount) → uint256[], uint256[][]` (internal)



Calculates rewards to swapped and credited to validators collateral


### `distributeValidatorRewards(address _rewardToken)` (external)



Distributes validator rewards to validator/delegators


### `exchangeValidatorRewards(address _validator, address _collateral)` (external)





### `setProfitSharing(address _validator, uint256 _profitSharingBPS)` (external)



set basis points of profit sharing


### `updateSlashingTreasury(address _newTreasury)` (external)



Updates slashing treasury address.


### `addValidator(address _validator, address _admin, uint256 _rewardWeightCoefficient, uint256 _profitSharingBPS)` (external)



Add new validator.


### `setValidatorEnabled(address _validator, bool _isEnabled)` (external)



Update validator enabled status.


### `addCollateral(address _token, uint256 _maxStakeAmount)` (external)



Add a new collateral


### `updateCollateralEnabled(address _collateral, bool _isEnabled)` (external)



Update collateral enabled


### `updateCollateral(address _collateral, uint256 _maxStakeAmount)` (external)



update collateral max amount


### `updateRewardWeight(address _validator, uint256 _value)` (external)



update validator reward weight coefficient


### `pauseUnstakeRequests(address _validator, uint256[] _withdrawIds, bool _paused)` (external)



Pause/unpause unstaking request.


### `setPriceConsumer(contract IPriceConsumer _priceConsumer)` (external)



Set Price Consumer


### `setSwapProxy(contract ISwapProxy _swapProxy)` (external)



Set swap converter proxy.


### `setWithdrawTimelock(uint256 _newTimelock)` (external)



Change withdrawal timelock.


### `setMinProfitSharing(uint256 _profitSharingBPS)` (external)



set min basis points of profit sharing


### `slashUnstakeRequests(address _validator, uint256 _fromWithdrawId, uint256 _toWithdrawId, uint256 _slashPPM)` (public)



Slash withdrawal requests.


### `slashValidator(address _validator, address[] _collaterals, uint256[] _slashAmounts)` (external)



Slash validator.


### `slashDelegator(address _delegator, address _validator, address[] _collaterals, uint256[] _slashShares)` (external)



Slash delegator.


### `withdrawSlashingTreasury()` (external)



Withdraw collected slashed amounts of all assets to protocol slashing treasury address

### `getPricePerFullValidatorShare(address _validator, address _collateral) → uint256` (external)



Get price per validator share


### `getPoolETHAmount(address _validator, address _collateral) → uint256` (public)



Get ETH amount of validator collateral


### `getTotalETHAmount(address _validator) → uint256[] poolsAmounts, uint256 totalAmount` (public)



Get total ETH amount of validator collateral


### `getWithdrawalRequest(address _validator, uint256 _withdrawalId) → struct DelegatedStaking.WithdrawalInfo` (external)



Get withdrawal request.


### `getRewards(address _validator, address _collateral) → uint256, uint256` (external)



get delegator, collateral and protocol rewards


### `getValidatorCollateral(address _validator, address _collateral) → uint256 stakedAmount, uint256 shares, uint256 locked, uint256 accumulatedRewards, uint256 rewardsForWithdrawal` (external)





### `getDelegatorsInfo(address _validator, address _collateral, address _delegator) → uint256 shares, uint256 locked, uint256 accumulatedRewards` (external)



get delegator stakes: returns whether shares, locked shares and passed rewards


### `version() → uint256` (external)






### `Staked(address sender, address receiver, address validator, address collateral, uint256 stakeAmount, uint256 receivedShares)`





### `UnstakeRequested(address delegator, address validator, address collateral, address receipient, uint256 timelock, uint256 shares, uint256 tokenAmount, uint256 index)`





### `ValidatorRewardsExchanged(address _validator, address _admin, address _collateral, uint256 _rewardAmount)`





### `SlashedUnstakeRequest(address delegator, address validator, address collateral, uint256 slashedAmount, uint256 index)`





### `SlashedValidatorCollateral(address validator, address collateral, uint256 slashedAmount)`





### `SlashedValidatorRewards(address validator, address collateral, uint256 slashedAmount)`





### `UnstakeExecuted(address delegator, address validator, address collateral, uint256 amount, uint256 withdrawalId)`





### `UnstakeCancelled(address delegator, address validator, uint256 withdrawalId)`





### `UnstakePaused(address validator, uint256 withdrawalId, bool paused)`





### `Liquidated(address validator, address collateral, uint256 amount)`





### `SlashedDelegator(address delegator, address validator, address collateral, uint256 shares, uint256 amount)`





### `LiquidatedDelegator(address delegator, address validator, address collateral, uint256 amount)`





### `DepositedToStrategy(address validator, address delegator, uint256 amount, address strategy, address collateral)`





### `WithdrawnFromStrategy(address validator, address delegator, uint256 amount, address strategy, address collateral)`





### `EmergencyWithdrawnFromStrategy(uint256 amount, address strategy, address collateral)`





### `RecoveredFromEmergency(address validator, uint256 amount, address strategy, address collateral)`





### `StrategyReset(address _strategy, address collateral)`





### `RewardsReceived(address token, uint256 amount)`





### `RewardsDistributed(address rewardToken, uint256 rewardAmount)`





### `WithdrawSlashingTreasury(address collateral, uint256 amount)`





### `UpdateSlashingTreasury(address newTreasury)`





### `WithdrawTimelockUpdated(uint256 newTimelock)`





### `UpdateCollateralEnabled(address collateral, bool isEnabled)`





### `UpdateCollateral(address collateral, uint256 maxStakeAmount)`





### `UpdateRewardWeight(address validator, uint256 value)`





### `EnableValidator(address validator, bool isEnabled)`






### `RewardInfo`


uint256 totalAmount


uint256 distributed


### `WithdrawalInfo`


address delegator


uint256 amount


uint256 slashingAmount


uint256 timelock


address receiver


address collateral


bool executed


bool paused


### `WithdrawalRequests`


mapping(uint256 => struct DelegatedStaking.WithdrawalInfo) withdrawals


uint256 count


### `DelegatorsInfo`


uint256 shares


uint256 locked


uint256 accumulatedRewards


### `ValidatorCollateral`


uint256 stakedAmount


uint256 shares


uint256 locked


mapping(address => struct DelegatedStaking.DelegatorsInfo) delegators


uint256 accumulatedRewards


uint256 rewardsForWithdrawal


### `ValidatorInfo`


address admin


mapping(address => struct DelegatedStaking.ValidatorCollateral) collateralPools


uint256 rewardWeightCoefficient


uint256 profitSharingBPS


bool delegatorActionPaused


bool isEnabled


bool exists


### `Collateral`


uint256 slashedAmount


uint256 totalLocked


uint256 rewards


uint256 maxStakeAmount


uint8 decimals


bool isEnabled


bool exists



