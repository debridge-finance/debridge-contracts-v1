


## Functions
### getRewardsBalance
```solidity
  function getRewardsBalance(
    address[] user
  ) external returns (uint256)
```

Returns the total of rewards of an user, already accrued + not yet accrued

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`user` | address[] | The address of the user

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`The`| address[] | rewards

### claimRewards
```solidity
  function claimRewards(
    address[] amount,
    uint256 to
  ) external returns (uint256)
```

Claims reward for an user, on all the assets of the lending pool, accumulating the pending rewards

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`amount` | address[] | Amount of rewards to claim
|`to` | uint256 | Address that will be receiving the rewards

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Rewards`| address[] | claimed

### claimRewardsOnBehalf
```solidity
  function claimRewardsOnBehalf(
    address[] amount,
    uint256 user,
    address to
  ) external returns (uint256)
```

Claims reward for an user on behalf, on all the assets of the lending pool, accumulating the pending rewards. The caller must
be whitelisted via "allowClaimOnBehalf" function by the RewardsAdmin role manager

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`amount` | address[] | Amount of rewards to claim
|`user` | uint256 | Address to check and claim rewards
|`to` | address | Address that will be receiving the rewards

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Rewards`| address[] | claimed

### getUserUnclaimedRewards
```solidity
  function getUserUnclaimedRewards(
    address user
  ) external returns (uint256)
```

returns the unclaimed rewards of the user

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`user` | address | the address of the user

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`the`| address | unclaimed user rewards
### REWARD_TOKEN
```solidity
  function REWARD_TOKEN(
  ) external returns (address)
```

for backward compatibility with previous implementation of the Incentives controller


