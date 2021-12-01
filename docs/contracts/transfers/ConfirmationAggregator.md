


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

### submitMany
```solidity
  function submitMany(
    bytes32[] _submissionIds
  ) external
```

Confirms few transfer requests.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_submissionIds` | bytes32[] | Submission identifiers.

### confirmNewAsset
```solidity
  function confirmNewAsset(
  ) external
```

Confirms the transfer request.


### submit
```solidity
  function submit(
    bytes32 _submissionId
  ) external
```

Confirms the transfer request.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_submissionId` | bytes32 | Submission identifier.

### _submit
```solidity
  function _submit(
    bytes32 _submissionId
  ) internal
```

Confirms single transfer request.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_submissionId` | bytes32 | Submission identifier.

### getConfirmedDeployId
```solidity
  function getConfirmedDeployId(
  ) external returns (bytes32)
```




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

### getSubmissionConfirmations
```solidity
  function getSubmissionConfirmations(
    bytes32 _submissionId
  ) external returns (uint8 confirmations, bool isConfirmed)
```

Returns whether transfer request is confirmed.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_submissionId` | bytes32 | Submission identifier.

#### Return Values:
| Name                           | Type          | Description                                                                  |
| :----------------------------- | :------------ | :--------------------------------------------------------------------------- |
|`confirmations`| bytes32 | number of confirmation.
|`isConfirmed`|  | is confirmed sumbission.
### version
```solidity
  function version(
  ) external returns (uint256)
```




