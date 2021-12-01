


## Functions
### _calculateShares
```solidity
  function _calculateShares(
    uint256 _amount,
    uint256 _totalShares,
    uint256 _totalAmount
  ) internal returns (uint256)
```

Calculates shares

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_amount` | uint256 | amount of collateral
|`_totalShares` | uint256 | total number of shares
|`_totalAmount` | uint256 | total amount of collateral

### _calculateFromShares
```solidity
  function _calculateFromShares(
    uint256 _shares,
    uint256 _totalAmount,
    uint256 _totalShares
  ) internal returns (uint256)
```

Calculates amount from shares

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_shares` | uint256 | number of shares
|`_totalAmount` | uint256 | total amount of collateral
|`_totalShares` | uint256 | total number of shares

