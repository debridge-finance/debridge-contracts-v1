## `ConfirmationAggregator`






### `initialize(uint8 _minConfirmations, uint8 _confirmationThreshold, uint8 _excessConfirmations)` (public)



Constructor that initializes the most important configurations.


### `submitMany(bytes32[] _submissionIds)` (external)



Confirms few transfer requests.


### `confirmNewAsset(bytes _tokenAddress, uint256 _chainId, string _name, string _symbol, uint8 _decimals)` (external)



Confirms the transfer request.

### `submit(bytes32 _submissionId)` (external)



Confirms the transfer request.


### `_submit(bytes32 _submissionId)` (internal)



Confirms single transfer request.


### `getConfirmedDeployId(bytes32 _debridgeId) → bytes32` (external)





### `setThreshold(uint8 _confirmationThreshold)` (external)



Sets minimal required confirmations.


### `getSubmissionConfirmations(bytes32 _submissionId) → uint8 confirmations, bool isConfirmed` (external)



Returns whether transfer request is confirmed.


### `version() → uint256` (external)








