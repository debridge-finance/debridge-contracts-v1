


## Functions
### getUnsignedMsg
```solidity
  function getUnsignedMsg(
    bytes32 _submissionId
  ) internal returns (bytes32)
```

Prepares raw msg that was signed by the oracle.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_submissionId` | bytes32 | Submission identifier.

### splitSignature
```solidity
  function splitSignature(
    bytes _signature
  ) internal returns (bytes32 r, bytes32 s, uint8 v)
```

Splits signature bytes to r,s,v components.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_signature` | bytes | Signature bytes in format r+s+v.

### parseSignature
```solidity
  function parseSignature(
  ) internal returns (bytes32 r, bytes32 s, uint8 v)
```




### toUint256
```solidity
  function toUint256(
  ) internal returns (uint256 result)
```




