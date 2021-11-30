## `AggregatorBase`





### `onlyAdmin()`





### `onlyOracle()`






### `initializeBase(uint8 _minConfirmations, uint8 _excessConfirmations)` (internal)



Constructor that initializes the most important configurations.


### `setMinConfirmations(uint8 _minConfirmations)` (external)



Sets minimal required confirmations.


### `setExcessConfirmations(uint8 _excessConfirmations)` (external)



Sets minimal required confirmations.


### `addOracles(address[] _oracles, bool[] _required)` (external)



Add oracle.


### `updateOracle(address _oracle, bool _isValid, bool _required)` (external)



Update oracle.


### `getDeployId(bytes32 _debridgeId, string _name, string _symbol, uint8 _decimals) → bytes32` (public)



Calculates asset identifier.

### `getDebridgeId(uint256 _chainId, bytes _tokenAddress) → bytes32` (public)



Calculates asset identifier.





