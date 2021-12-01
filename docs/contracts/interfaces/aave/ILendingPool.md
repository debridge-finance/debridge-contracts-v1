


## Functions
### deposit
```solidity
  function deposit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint16 referralCode
  ) external
```

Deposits an `amount` of underlying asset into the reserve, receiving in return overlying aTokens.
- E.g. User deposits 100 USDC and gets in return 100 aUSDC

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`asset` | address | The address of the underlying asset to deposit
|`amount` | uint256 | The amount to be deposited
|`onBehalfOf` | address | The address that will receive the aTokens, same as msg.sender if the user
  wants to receive them on his own wallet, or a different address if the beneficiary of aTokens
  is a different wallet
|`referralCode` | uint16 | Code used to register the integrator originating the operation, for potential rewards.
  0 if the action is executed directly by the user, without any middle-man


### withdraw
```solidity
  function withdraw(
    address asset,
    uint256 amount,
    address to
  ) external returns (uint256)
```

Withdraws an `amount` of underlying asset from the reserve, burning the equivalent aTokens owned
E.g. User has 100 aUSDC, calls withdraw() and receives 100 USDC, burning the 100 aUSDC

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`asset` | address | The address of the underlying asset to withdraw
|`amount` | uint256 | The underlying amount to be withdrawn
  - Send the value type(uint256).max in order to withdraw the whole aToken balance
|`to` | address | Address that will receive the underlying, same as msg.sender if the user
  wants to receive it on his own wallet, or a different address if the beneficiary is a
  different wallet

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`The`| address | final amount withdrawn

## Events
### Deposit
```solidity
  event Deposit(
    address reserve,
    address user,
    address onBehalfOf,
    uint256 amount,
    uint16 referral
  )
```

Emitted on deposit()

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|`reserve`| address | The address of the underlying asset of the reserve
|`user`| address | The address initiating the deposit
|`onBehalfOf`| address | The beneficiary of the deposit, receiving the aTokens
|`amount`| uint256 | The amount deposited
|`referral`| uint16 | The referral code used

### Withdraw
```solidity
  event Withdraw(
    address reserve,
    address user,
    address to,
    uint256 amount
  )
```

Emitted on withdraw()

#### Parameters:
| Name                           | Type          | Description                                    |
| :----------------------------- | :------------ | :--------------------------------------------- |
|`reserve`| address | The address of the underlyng asset being withdrawn
|`user`| address | The address initiating the withdrawal, owner of aTokens
|`to`| address | Address that will receive the underlying
|`amount`| uint256 | The amount to be withdrawn

