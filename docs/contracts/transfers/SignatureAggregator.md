


## Functions
### initialize
```solidity
  function initialize(
    uint8 _minConfirmations,
    uint8 _excessConfirmations
  ) public
```

Constructor that initializes the most important configurations.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_minConfirmations` | uint8 | Common confirmations count.
|`_excessConfirmations` | uint8 | Confirmations count in case of excess activity.

### confirmNewAsset
```solidity
  function confirmNewAsset(
  ) external
```

Confirms the transfer request.


### submitMany
```solidity
  function submitMany(
    bytes32[] _submissionIds,
    bytes[] _signatures
  ) external
```

Confirms few transfer requests.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_submissionIds` | bytes32[] | Submission identifiers.
|`_signatures` | bytes[] | Oracles signature.

### submit
```solidity
  function submit(
    bytes32 _submissionId,
    bytes _signature
  ) external
```

Confirms the transfer request.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_submissionId` | bytes32 | Submission identifier.
|`_signature` | bytes | Oracle's signature.

### _submit
```solidity
  function _submit(
    bytes32 _submissionId,
    bytes _signature
  ) internal
```

Confirms single transfer request.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_submissionId` | bytes32 | Submission identifier.
|`_signature` | bytes | Oracle's signature.

### getSubmissionConfirmations
```solidity
  function getSubmissionConfirmations(
    bytes32 _submissionId
  ) external returns (uint8 _confirmations, bool _confirmed)
```

Returns whether transfer request is confirmed.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_submissionId` | bytes32 | Submission identifier.

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`_confirmations`| bytes32 | number of confirmation.
|`_confirmed`|  | Whether transfer request is confirmed.
### getSubmissionSignatures
```solidity
  function getSubmissionSignatures(
    bytes32 _submissionId
  ) external returns (bytes[])
```

Returns whether transfer request is confirmed.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_submissionId` | bytes32 | Submission identifier.

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`Oracles`| bytes32 | signatures.
### _checkSignature
```solidity
  function _checkSignature(
  ) internal
```




### version
```solidity
  function version(
  ) external returns (uint256)
```




