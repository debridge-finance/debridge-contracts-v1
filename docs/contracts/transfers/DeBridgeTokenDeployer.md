## `DeBridgeTokenDeployer`





### `onlyAdmin()`





### `onlyDeBridgeGate()`






### `initialize(address _tokenImplementation, address _deBridgeTokenAdmin, address _debridgeAddress)` (public)



Constructor that initializes the most important configurations.

### `deployAsset(bytes32 _debridgeId, string _name, string _symbol, uint8 _decimals) → address deBridgeTokenAddress` (external)





### `implementation() → address` (public)





### `setTokenImplementation(address _impl)` (external)



Set deBridgeToken implementation contract address


### `setDeBridgeTokenAdmin(address _deBridgeTokenAdmin)` (external)



Set admin for any deployed deBridgeToken.


### `setDebridgeAddress(address _debridgeAddress)` (external)



Sets core debridge conrtact address.


### `setOverridedTokenInfo(bytes32[] _debridgeIds, struct DeBridgeTokenDeployer.OverridedTokenInfo[] _tokens)` (external)



Override specific tokens name/sybmol


### `version() → uint256` (external)







### `OverridedTokenInfo`


bool accept


string name


string symbol



