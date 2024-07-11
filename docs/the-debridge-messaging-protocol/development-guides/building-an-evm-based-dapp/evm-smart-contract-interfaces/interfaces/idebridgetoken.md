# IDeBridgeToken

## Functions

### mint

```solidity
  function mint(
            address _receiver,
            uint256 _amount
  ) external
```

Issues new tokens.

#### Parameters:

| Name        | Type    | Description          |
| ----------- | ------- | -------------------- |
| `_receiver` | address | Token's receiver.    |
| `_amount`   | uint256 | Amount to be minted. |

### burn

```solidity
  function burn(
            uint256 _amount
  ) external
```

Destroys existing tokens.

#### Parameters:

| Name      | Type    | Description         |
| --------- | ------- | ------------------- |
| `_amount` | uint256 | Amount to be burnt. |