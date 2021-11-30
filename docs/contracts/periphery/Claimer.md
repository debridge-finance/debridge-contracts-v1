## `Claimer`





### `onlyAdmin()`






### `initialize(contract DeBridgeGate _deBridgeGate)` (public)





### `batchClaim(struct Claimer.ClaimInfo[] _claims)` (external)





### `batchAssetsDeploy(struct Claimer.AssetDeployInfo[] _deploys)` (external)





### `isSubmissionsUsed(bytes32[] _submissionIds) → bool[] result` (external)





### `isDebridgesExists(bytes32[] _debridgeIds) → bool[] result` (external)





### `setDeBridgeGate(contract DeBridgeGate _deBridgeGate)` (external)





### `version() → uint256` (external)






### `BatchError(uint256 index)`






### `ClaimInfo`


bytes32 debridgeId


uint256 amount


uint256 chainIdFrom


address receiver


uint256 nonce


bytes signatures


bytes autoParams


### `AssetDeployInfo`


bytes nativeTokenAddress


uint256 nativeChainId


string name


string symbol


uint8 decimals


bytes signatures



