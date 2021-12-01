


## Functions
### initializeMock
```solidity
  function initializeMock(
    uint8 _signatureVerifier
  ) public
```

Constructor that initializes the most important configurations.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_signatureVerifier` | uint8 | Aggregator address to verify signatures

### getChainId
```solidity
  function getChainId(
  ) public returns (uint256 cid)
```




### getSubmissionId
```solidity
  function getSubmissionId(
    bytes32 _debridgeId,
    uint256 _chainIdFrom,
    uint256 _chainIdTo,
    uint256 _receiver,
    address _amount,
    uint256 _nonce
  ) public returns (bytes32)
```

Calculate submission id.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_debridgeId` | bytes32 | Asset identifier.
|`_chainIdFrom` | uint256 | Chain identifier of the chain where tokens are sent from.
|`_chainIdTo` | uint256 | Chain identifier of the chain where tokens are sent to.
|`_receiver` | uint256 | Receiver address.
|`_amount` | address | Amount of the transfered asset (note: the fee can be applyed).
|`_nonce` | uint256 | Submission id.

