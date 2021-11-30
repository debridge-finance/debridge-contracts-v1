## `SignatureVerifier`





### `onlyDeBridgeGate()`






### `initialize(uint8 _minConfirmations, uint8 _confirmationThreshold, uint8 _excessConfirmations, address _debridgeAddress)` (public)



Constructor that initializes the most important configurations.


### `submit(bytes32 _submissionId, bytes _signatures, uint8 _excessConfirmations)` (external)



Check is valid signatures.


### `setThreshold(uint8 _confirmationThreshold)` (external)



Sets minimal required confirmations.


### `setDebridgeAddress(address _debridgeAddress)` (external)



Sets core debridge conrtact address.


### `isValidSignature(bytes32 _submissionId, bytes _signature) → bool` (external)



Check is valid signature


### `_countSignatures(bytes _signatures) → uint256` (internal)





### `version() → uint256` (external)








