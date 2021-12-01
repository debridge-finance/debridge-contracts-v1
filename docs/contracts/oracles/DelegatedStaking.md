


## Functions
### initialize
```solidity
  function initialize(
    uint256 _withdrawTimelock,
    contract IPriceConsumer _priceConsumer,
    contract ISwapProxy _slashingTreasury
  ) public
```

Initializer that initializes the most important configurations.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_withdrawTimelock` | uint256 | Duration of withdrawal timelock.
|`_priceConsumer` | contract IPriceConsumer | Price consumer contract.
|`_slashingTreasury` | contract ISwapProxy | Address of slashing treasury.

### stake
```solidity
  function stake(
    address _receiver,
    address _validator,
    address _collateral,
    uint256 _amount
  ) external
```

stake collateral to validator.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_receiver` | address | Delegator receiver address.
|`_validator` | address | Validator address.
|`_collateral` | address | address of collateral
|`_amount` | uint256 | Amount to stake.

### requestUnstake
```solidity
  function requestUnstake(
    address _validator,
    address _collateral,
    address _recipient,
    uint256 _shares
  ) external
```

Withdraws validator reward.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_validator` | address | Validator address.
|`_collateral` | address | Index of collateral
|`_recipient` | address | Recepient reward.
|`_shares` | uint256 | Shares to withdraw.

### executeUnstake
```solidity
  function executeUnstake(
    address _validator,
    uint256[] _withdrawIds
  ) external
```

Execute withdrawal requests.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_validator` | address | Validator address.
|`_withdrawIds` | uint256[] | Withdrawal identifiers.

### cancelUnstake
```solidity
  function cancelUnstake(
    address _validator,
    uint256[] _withdrawIds
  ) external
```

Cancel unstake.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_validator` | address | Validator address.
|`_withdrawIds` | uint256[] | Withdrawal identifiers.

### sendRewards
```solidity
  function sendRewards(
    address _rewardToken,
    uint256 _amount
  ) external
```

Receive protocol rewards.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_rewardToken` | address | Address of reward token.
|`_amount` | uint256 | Amount of reward tokem.

### _calculateAndUpdateValidatorRewards
```solidity
  function _calculateAndUpdateValidatorRewards(
    address _rewardToken,
    uint256 _rewardAmount
  ) internal returns (uint256[], uint256[][])
```

Calculates rewards to swapped and credited to validators collateral

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_rewardToken` | address | address of reward token
|`_rewardAmount` | uint256 | amount of reward token

### distributeValidatorRewards
```solidity
  function distributeValidatorRewards(
    address _rewardToken
  ) external
```

Distributes validator rewards to validator/delegators

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_rewardToken` | address | address of reward token

### exchangeValidatorRewards
```solidity
  function exchangeValidatorRewards(
  ) external
```




### setProfitSharing
```solidity
  function setProfitSharing(
    address _validator,
    uint256 _profitSharingBPS
  ) external
```

set basis points of profit sharing

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_validator` | address | address of validator
|`_profitSharingBPS` | uint256 | profit sharing basis points

### updateSlashingTreasury
```solidity
  function updateSlashingTreasury(
    address _newTreasury
  ) external
```

Updates slashing treasury address.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_newTreasury` | address | New slashing treasury address.

### addValidator
```solidity
  function addValidator(
    address _validator,
    address _admin
  ) external
```

Add new validator.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_validator` | address | Validator address.
|`_admin` | address | Admin address.

### setValidatorEnabled
```solidity
  function setValidatorEnabled(
    address _validator,
    bool _isEnabled
  ) external
```

Update validator enabled status.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_validator` | address | Validator address.
|`_isEnabled` | bool | Is validator enabled.

### addCollateral
```solidity
  function addCollateral(
    address _token
  ) external
```

Add a new collateral

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_token` | address | Address of token

### updateCollateralEnabled
```solidity
  function updateCollateralEnabled(
    address _collateral,
    bool _isEnabled
  ) external
```

Update collateral enabled

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_collateral` | address | address of collateral
|`_isEnabled` | bool | bool of enable

### updateCollateral
```solidity
  function updateCollateral(
    address _collateral,
    uint256 _maxStakeAmount
  ) external
```

update collateral max amount

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_collateral` | address | address of collateral
|`_maxStakeAmount` | uint256 | max amount

### updateRewardWeight
```solidity
  function updateRewardWeight(
    address _validator,
    uint256 _value
  ) external
```

update validator reward weight coefficient

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_validator` | address | address of validator
|`_value` | uint256 | reward weight coefficient

### pauseUnstakeRequests
```solidity
  function pauseUnstakeRequests(
    address _validator,
    uint256[] _withdrawIds,
    bool _paused
  ) external
```

Pause/unpause unstaking request.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_validator` | address | Validator address.
|`_withdrawIds` | uint256[] | Withdraw requests ids.
|`_paused` | bool | pause/unpause.

### setPriceConsumer
```solidity
  function setPriceConsumer(
    contract IPriceConsumer _priceConsumer
  ) external
```

Set Price Consumer

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_priceConsumer` | contract IPriceConsumer | address of price consumer

### setSwapProxy
```solidity
  function setSwapProxy(
    contract ISwapProxy _swapProxy
  ) external
```

Set swap converter proxy.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_swapProxy` | contract ISwapProxy | Swap proxy address.

### setWithdrawTimelock
```solidity
  function setWithdrawTimelock(
    uint256 _newTimelock
  ) external
```

Change withdrawal timelock.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_newTimelock` | uint256 | New timelock.

### setMinProfitSharing
```solidity
  function setMinProfitSharing(
    uint256 _profitSharingBPS
  ) external
```

set min basis points of profit sharing

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_profitSharingBPS` | uint256 | profit sharing basis points

### slashUnstakeRequests
```solidity
  function slashUnstakeRequests(
    address _validator,
    uint256 _fromWithdrawId,
    uint256 _toWithdrawId,
    uint256 _slashPPM
  ) public
```

Slash withdrawal requests.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_validator` | address | Validator address.
|`_fromWithdrawId` | uint256 | Starting from withdrawal identifier.
|`_toWithdrawId` | uint256 | Up to withdrawal identifier.
|`_slashPPM` | uint256 | Slashing ppm (1e6 DENOMINATOR)

### slashValidator
```solidity
  function slashValidator(
    address _validator,
    address[] _collaterals,
    uint256[] _slashAmounts
  ) external
```

Slash validator.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_validator` | address | Validator address.
|`_collaterals` | address[] | Collaterals addresses.
|`_slashAmounts` | uint256[] | Amounts to be slashed.

### slashDelegator
```solidity
  function slashDelegator(
    address _delegator,
    address _validator,
    address[] _collaterals,
    uint256[] _slashShares
  ) external
```

Slash delegator.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_delegator` | address | Delegator address.
|`_validator` | address | Validator address.
|`_collaterals` | address[] | Collaterals addresses.
|`_slashShares` | uint256[] | Shares to be confiscated.

### withdrawSlashingTreasury
```solidity
  function withdrawSlashingTreasury(
  ) external
```

Withdraw collected slashed amounts of all assets to protocol slashing treasury address


### getPricePerFullValidatorShare
```solidity
  function getPricePerFullValidatorShare(
    address _validator,
    address _collateral
  ) external returns (uint256)
```

Get price per validator share

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_validator` | address | Address of validator
|`_collateral` | address | Address of collateral

### getPoolETHAmount
```solidity
  function getPoolETHAmount(
    address _validator,
    address _collateral
  ) public returns (uint256)
```

Get ETH amount of validator collateral

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_validator` | address | Address of validator
|`_collateral` | address | Address of collateral

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`ETH`| address | amount with decimals 18
### getTotalETHAmount
```solidity
  function getTotalETHAmount(
    address _validator
  ) public returns (uint256[] poolsAmounts, uint256 totalAmount)
```

Get total ETH amount of validator collateral

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_validator` | address | Address of validator

### getWithdrawalRequest
```solidity
  function getWithdrawalRequest(
    address _validator,
    uint256 _withdrawalId
  ) external returns (struct DelegatedStaking.WithdrawalInfo)
```

Get withdrawal request.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_validator` | address | Validator address.
|`_withdrawalId` | uint256 | Withdrawal identifier.

### getRewards
```solidity
  function getRewards(
    address _validator,
    address _collateral
  ) external returns (uint256, uint256)
```

get delegator, collateral and protocol rewards

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_validator` | address | address of validator
|`_collateral` | address | Address of collateral

### getValidatorCollateral
```solidity
  function getValidatorCollateral(
  ) external returns (uint256 stakedAmount, uint256 shares, uint256 locked, uint256 accumulatedRewards, uint256 rewardsForWithdrawal)
```




### getDelegatorsInfo
```solidity
  function getDelegatorsInfo(
    address _validator,
    address _collateral,
    address _delegator
  ) external returns (uint256 shares, uint256 locked, uint256 accumulatedRewards)
```

get delegator stakes: returns whether shares, locked shares and passed rewards

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_validator` | address | address of validator
|`_collateral` | address | Address of collateral
|`_delegator` | address | address of delegator

### version
```solidity
  function version(
  ) external returns (uint256)
```




## Events
### Staked
```solidity
  event Staked(
  )
```



### UnstakeRequested
```solidity
  event UnstakeRequested(
  )
```



### ValidatorRewardsExchanged
```solidity
  event ValidatorRewardsExchanged(
  )
```



### SlashedUnstakeRequest
```solidity
  event SlashedUnstakeRequest(
  )
```



### SlashedValidatorCollateral
```solidity
  event SlashedValidatorCollateral(
  )
```



### SlashedValidatorRewards
```solidity
  event SlashedValidatorRewards(
  )
```



### UnstakeExecuted
```solidity
  event UnstakeExecuted(
  )
```



### UnstakeCancelled
```solidity
  event UnstakeCancelled(
  )
```



### UnstakePaused
```solidity
  event UnstakePaused(
  )
```



### Liquidated
```solidity
  event Liquidated(
  )
```



### SlashedDelegator
```solidity
  event SlashedDelegator(
  )
```



### LiquidatedDelegator
```solidity
  event LiquidatedDelegator(
  )
```



### DepositedToStrategy
```solidity
  event DepositedToStrategy(
  )
```



### WithdrawnFromStrategy
```solidity
  event WithdrawnFromStrategy(
  )
```



### EmergencyWithdrawnFromStrategy
```solidity
  event EmergencyWithdrawnFromStrategy(
  )
```



### RecoveredFromEmergency
```solidity
  event RecoveredFromEmergency(
  )
```



### StrategyReset
```solidity
  event StrategyReset(
  )
```



### RewardsReceived
```solidity
  event RewardsReceived(
  )
```



### RewardsDistributed
```solidity
  event RewardsDistributed(
  )
```



### WithdrawSlashingTreasury
```solidity
  event WithdrawSlashingTreasury(
  )
```



### UpdateSlashingTreasury
```solidity
  event UpdateSlashingTreasury(
  )
```



### WithdrawTimelockUpdated
```solidity
  event WithdrawTimelockUpdated(
  )
```



### UpdateCollateralEnabled
```solidity
  event UpdateCollateralEnabled(
  )
```



### UpdateCollateral
```solidity
  event UpdateCollateral(
  )
```



### UpdateRewardWeight
```solidity
  event UpdateRewardWeight(
  )
```



### EnableValidator
```solidity
  event EnableValidator(
  )
```



