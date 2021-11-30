## `SignatureAggregator`






### `initialize(uint8 _minConfirmations, uint8 _excessConfirmations)` (public)



Constructor that initializes the most important configurations.


### `confirmNewAsset(bytes _tokenAddress, uint256 _chainId, string _name, string _symbol, uint8 _decimals, bytes _signature)` (external)



Confirms the transfer request.

### `submitMany(bytes32[] _submissionIds, bytes[] _signatures)` (external)



Confirms few transfer requests.


### `submit(bytes32 _submissionId, bytes _signature)` (external)



Confirms the transfer request.


### `_submit(bytes32 _submissionId, bytes _signature)` (internal)



Confirms single transfer request.


### `getSubmissionConfirmations(bytes32 _submissionId) → uint8 _confirmations, bool _confirmed` (external)



Returns whether transfer request is confirmed.


### `getSubmissionSignatures(bytes32 _submissionId) → bytes[]` (external)



Returns whether transfer request is confirmed.


### `_checkSignature(bytes _signature, bytes32 _message)` (internal)





### `version() → uint256` (external)








