


## Functions
### constructor
```solidity
  function constructor(
  ) public
```




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

### getRewardsBalance
```solidity
  function getRewardsBalance(
  ) external returns (uint256)
```




### claimRewardsOnBehalf
```solidity
  function claimRewardsOnBehalf(
  ) external returns (uint256)
```




### getUserUnclaimedRewards
```solidity
  function getUserUnclaimedRewards(
  ) external returns (uint256)
```




### REWARD_TOKEN
```solidity
  function REWARD_TOKEN(
  ) external returns (address)
```




## Events
### RewardsClaimed
```solidity
  event RewardsClaimed(
  )
```



