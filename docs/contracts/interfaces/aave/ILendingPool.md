## `ILendingPool`






### `deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)` (external)



Deposits an `amount` of underlying asset into the reserve, receiving in return overlying aTokens.
- E.g. User deposits 100 USDC and gets in return 100 aUSDC


### `withdraw(address asset, uint256 amount, address to) → uint256` (external)



Withdraws an `amount` of underlying asset from the reserve, burning the equivalent aTokens owned
E.g. User has 100 aUSDC, calls withdraw() and receives 100 USDC, burning the 100 aUSDC



### `Deposit(address reserve, address user, address onBehalfOf, uint256 amount, uint16 referral)`



Emitted on deposit()


### `Withdraw(address reserve, address user, address to, uint256 amount)`



Emitted on withdraw()




