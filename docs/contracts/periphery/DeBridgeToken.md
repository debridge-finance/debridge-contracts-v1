


## Functions
### initialize
```solidity
  function initialize(
    string name_,
    string symbol_,
    uint8 minters
  ) public
```

Constructor that initializes the most important configurations.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`name_` | string | Asset's name.
|`symbol_` | string | Asset's symbol.
|`minters` | uint8 | The accounts allowed to int new tokens.

### mint
```solidity
  function mint(
    address _receiver,
    uint256 _amount
  ) external
```

Issues new tokens.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_receiver` | address | Token's receiver.
|`_amount` | uint256 | Amount to be minted.

### burn
```solidity
  function burn(
    uint256 _amount
  ) external
```

Destroys existed tokens.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_amount` | uint256 | Amount to be burnt.

### permit
```solidity
  function permit(
    address _owner,
    address _spender,
    uint256 _value,
    uint256 _deadline,
    uint8 _v,
    bytes32 _r,
    bytes32 _s
  ) external
```

Approves the spender by signature.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_owner` | address | Token's owner.
|`_spender` | address | Account to be approved.
|`_value` | uint256 | Amount to be approved.
|`_deadline` | uint256 | The permit valid until.
|`_v` | uint8 | Signature part.
|`_r` | bytes32 | Signature part.
|`_s` | bytes32 | Signature part.

### decimals
```solidity
  function decimals(
  ) public returns (uint8)
```




