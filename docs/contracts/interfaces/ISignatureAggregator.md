## `ISignatureAggregator`






### `submitMany(bytes32[] _submissionIds, bytes[] _signatures)` (external)





### `submit(bytes32 _submissionId, bytes _signature)` (external)





### `getSubmissionConfirmations(bytes32 _submissionId) → uint8 _confirmations, bool _blockConfirmationPassed` (external)






### `DeployConfirmed(bytes32 deployId, address operator, bytes signature)`





### `Confirmed(bytes32 submissionId, address operator, bytes signature)`






### `SubmissionInfo`


uint8 confirmations


bytes[] signatures


mapping(address => bool) hasVerified


### `DebridgeDeployInfo`


uint256 chainId


bytes nativeAddress


uint8 decimals


uint8 confirmations


bool approved


string name


string symbol


bytes[] signatures


mapping(address => bool) hasVerified



