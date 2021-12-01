


## Functions
### initializeBase
```solidity
  function initializeBase(
    uint8 _minConfirmations
  ) internal
```

Constructor that initializes the most important configurations.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_minConfirmations` | uint8 | Common confirmations count.

### setMinConfirmations
```solidity
  function setMinConfirmations(
    uint8 _minConfirmations
  ) external
```

Sets minimal required confirmations.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_minConfirmations` | uint8 | Confirmation info.

### setExcessConfirmations
```solidity
  function setExcessConfirmations(
    uint8 _excessConfirmations
  ) external
```

Sets minimal required confirmations.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_excessConfirmations` | uint8 | new excessConfirmations count.

### addOracles
```solidity
  function addOracles(
    address[] _oracles,
    bool[] _required
  ) external
```

Add oracle.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_oracles` | address[] | Oracles addresses.
|`_required` | bool[] | Without this oracle, the transfer will not be confirmed

### updateOracle
```solidity
  function updateOracle(
    address _oracle,
    bool _isValid,
    bool _required
  ) external
```

Update oracle.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_oracle` | address | Oracle address.
|`_isValid` | bool | is valid oracle
|`_required` | bool | Without this oracle, the transfer will not be confirmed

### getDeployId
```solidity
  function getDeployId(
  ) public returns (bytes32)
```

Calculates asset identifier.


### getDebridgeId
```solidity
  function getDebridgeId(
    uint256 _chainId,
    bytes _tokenAddress
  ) public returns (bytes32)
```

Calculates asset identifier.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_chainId` | uint256 | Current chain id.
|`_tokenAddress` | bytes | Address of the asset on the other chain.

