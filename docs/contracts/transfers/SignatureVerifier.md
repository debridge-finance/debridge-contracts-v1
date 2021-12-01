


## Functions
### initialize
```solidity
  function initialize(
    uint8 _minConfirmations,
    uint8 _confirmationThreshold,
    uint8 _excessConfirmations
  ) public
```

Constructor that initializes the most important configurations.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_minConfirmations` | uint8 | Common confirmations count.
|`_confirmationThreshold` | uint8 | Confirmations per block after extra check enabled.
|`_excessConfirmations` | uint8 | Confirmations count in case of excess activity.

### submit
```solidity
  function submit(
    bytes32 _submissionId,
    bytes _signatures,
    uint8 _excessConfirmations
  ) external
```

Check is valid signatures.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_submissionId` | bytes32 | Submission identifier.
|`_signatures` | bytes | Array of signatures by oracles.
|`_excessConfirmations` | uint8 | override min confirmations count

### setThreshold
```solidity
  function setThreshold(
    uint8 _confirmationThreshold
  ) external
```

Sets minimal required confirmations.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_confirmationThreshold` | uint8 | Confirmation info.

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

### isValidSignature
```solidity
  function isValidSignature(
    bytes32 _submissionId,
    bytes _signature
  ) external returns (bool)
```

Check is valid signature

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_submissionId` | bytes32 | Submission identifier.
|`_signature` | bytes | signature by oracle.

### _countSignatures
```solidity
  function _countSignatures(
  ) internal returns (uint256)
```




### version
```solidity
  function version(
  ) external returns (uint256)
```




