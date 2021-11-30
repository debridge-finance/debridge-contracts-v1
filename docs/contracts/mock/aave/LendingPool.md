## `LendingPool`






### `initialize(contract LendingPoolAddressesProvider provider)` (public)





### `addReserveAsset(address underlyingAsset, address aTokenAddress)` (public)





### `deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)` (external)





### `withdraw(address asset, uint256 amount, address to) → uint256` (external)





### `getReserveData(address asset) → struct LendingPool.ReserveData` (external)





### `getReserveNormalizedIncome(address asset) → uint256` (external)





### `calculateLinearInterest(uint256 rate, uint40 lastUpdateTimestamp) → uint256` (internal)





### `setCurrentTime(uint256 _currentTime)` (public)





### `increaseCurrentTime(uint256 _timeDelta)` (public)





### `_now() → uint256` (internal)






### `Deposit(address reserve, address user, address onBehalfOf, uint256 amount, uint16 referral)`





### `Withdraw(address asset, address user, address onBehalfOf, uint256 amount)`






### `ReserveData`


bool configuration


uint128 liquidityIndex


uint128 variableBorrowIndex


uint128 currentLiquidityRate


uint128 currentVariableBorrowRate


uint128 currentStableBorrowRate


uint40 lastUpdateTimestamp


address aTokenAddress


address stableDebtTokenAddress


address variableDebtTokenAddress


address interestRateStrategyAddress


uint8 id



