


## Functions
### initialize
```solidity
  function initialize(
  ) public
```

Constructor that initializes the most important configurations.


### deployAsset
```solidity
  function deployAsset(
  ) external returns (address deBridgeTokenAddress)
```




### implementation
```solidity
  function implementation(
  ) public returns (address)
```




### setTokenImplementation
```solidity
  function setTokenImplementation(
    address _impl
  ) external
```

Set deBridgeToken implementation contract address

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_impl` | address | Wrapped asset implementation contract address.

### setDeBridgeTokenAdmin
```solidity
  function setDeBridgeTokenAdmin(
    address _deBridgeTokenAdmin
  ) external
```

Set admin for any deployed deBridgeToken.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_deBridgeTokenAdmin` | address | Admin address.

### setDebridgeAddress
```solidity
  function setDebridgeAddress(
    address _debridgeAddress
  ) external
```

Sets core debridge conrtact address.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_debridgeAddress` | address | Debridge address.

### setOverridedTokenInfo
```solidity
  function setOverridedTokenInfo(
    bytes32[] _debridgeIds,
    struct DeBridgeTokenDeployer.OverridedTokenInfo[] _tokens
  ) external
```

Override specific tokens name/sybmol

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_debridgeIds` | bytes32[] | Array debridgeId of token
|`_tokens` | struct DeBridgeTokenDeployer.OverridedTokenInfo[] | Array new name/sybmols of tokens

### version
```solidity
  function version(
  ) external returns (uint256)
```




