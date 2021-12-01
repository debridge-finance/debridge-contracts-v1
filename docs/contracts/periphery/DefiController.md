


## Functions
### initialize
```solidity
  function initialize(
  ) public
```




### depositToStrategy
```solidity
  function depositToStrategy(
  ) internal
```




### withdrawFromStrategy
```solidity
  function withdrawFromStrategy(
  ) internal
```




### rebalanceStrategy
```solidity
  function rebalanceStrategy(
  ) external
```




### isStrategyUnbalanced
```solidity
  function isStrategyUnbalanced(
  ) public returns (uint256 _deltaAmount, bool _toDeposit)
```




### addStrategy
```solidity
  function addStrategy(
  ) external
```

add new strategy


### updateStrategy
```solidity
  function updateStrategy(
  ) external
```




### setDeBridgeGate
```solidity
  function setDeBridgeGate(
  ) external
```




### addWorker
```solidity
  function addWorker(
  ) external
```




### removeWorker
```solidity
  function removeWorker(
  ) external
```




### pause
```solidity
  function pause(
  ) external
```

Disable strategies rebalancing for workers


### unpause
```solidity
  function unpause(
  ) external
```

Allow strategies rebalancing for workers


### version
```solidity
  function version(
  ) external returns (uint256)
```




## Events
### AddStrategy
```solidity
  event AddStrategy(
  )
```



### UpdateStrategy
```solidity
  event UpdateStrategy(
  )
```



### DepositToStrategy
```solidity
  event DepositToStrategy(
  )
```



### WithdrawFromStrategy
```solidity
  event WithdrawFromStrategy(
  )
```



