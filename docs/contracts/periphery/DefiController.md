## `DefiController`





### `onlyWorker()`





### `onlyAdmin()`






### `initialize()` (public)





### `depositToStrategy(uint256 _amount, address _strategy)` (internal)





### `withdrawFromStrategy(uint256 _amount, address _strategy)` (internal)





### `rebalanceStrategy(address _strategy)` (external)





### `isStrategyUnbalanced(address _strategy) → uint256 _deltaAmount, bool _toDeposit` (public)





### `addStrategy(address _strategy, bool _isEnabled, uint16 _maxReservesBps, address _stakeToken, address _strategyToken)` (external)



add new strategy

### `updateStrategy(address _strategy, bool _isEnabled, uint16 _maxReservesBps)` (external)





### `setDeBridgeGate(contract IDeBridgeGate _deBridgeGate)` (external)





### `addWorker(address _worker)` (external)





### `removeWorker(address _worker)` (external)





### `pause()` (external)



Disable strategies rebalancing for workers

### `unpause()` (external)



Allow strategies rebalancing for workers

### `version() → uint256` (external)






### `AddStrategy(address strategy, bool isEnabled, uint16 maxReservesBps, address stakeToken, address strategyToken)`





### `UpdateStrategy(address strategy, bool isEnabled, uint16 maxReservesBps)`





### `DepositToStrategy(address strategy, uint256 amount)`





### `WithdrawFromStrategy(address strategy, uint256 amount)`






### `Strategy`


bool exists


bool isEnabled


uint16 maxReservesBps


address stakeToken


address strategyToken



