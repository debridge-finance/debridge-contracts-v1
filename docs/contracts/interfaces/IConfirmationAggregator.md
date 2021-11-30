## `IConfirmationAggregator`






### `submit(bytes32 _submissionId)` (external)





### `submitMany(bytes32[] _submissionIds)` (external)





### `getSubmissionConfirmations(bytes32 _submissionId) → uint8 _confirmations, bool _isConfirmed` (external)





### `getConfirmedDeployId(bytes32 _debridgeId) → bytes32` (external)






### `DeployConfirmed(bytes32 deployId, address operator)`





### `Confirmed(bytes32 submissionId, address operator)`






### `SubmissionInfo`


uint8 confirmations


uint8 requiredConfirmations


bool isConfirmed


mapping(address => bool) hasVerified


### `DebridgeDeployInfo`


uint256 chainId


bytes nativeAddress


uint8 confirmations


uint8 requiredConfirmations


uint8 decimals


string name


string symbol


mapping(address => bool) hasVerified



