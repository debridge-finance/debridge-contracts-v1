## `SignatureUtil`






### `getUnsignedMsg(bytes32 _submissionId) → bytes32` (internal)



Prepares raw msg that was signed by the oracle.


### `splitSignature(bytes _signature) → bytes32 r, bytes32 s, uint8 v` (internal)



Splits signature bytes to r,s,v components.


### `parseSignature(bytes _signatures, uint256 offset) → bytes32 r, bytes32 s, uint8 v` (internal)





### `toUint256(bytes _bytes, uint256 _offset) → uint256 result` (internal)








