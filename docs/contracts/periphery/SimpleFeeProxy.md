## `SimpleFeeProxy`





### `onlyAdmin()`






### `initialize(contract IDeBridgeGate _debridgeGate, address _treasury)` (public)





### `pause()` (external)





### `unpause()` (external)





### `setDebridgeGate(contract IDeBridgeGate _debridgeGate)` (external)





### `setTreasury(address _treasury)` (external)





### `withdrawFee(address _tokenAddress)` (external)



Transfer tokens to native chain and then create swap to deETH
and transfer reward to Ethereum network.

### `withdrawNativeFee()` (external)



Swap native tokens to deETH and then transfer reward to Ethereum network.

### `receive()` (external)





### `getbDebridgeId(uint256 _chainId, bytes _tokenAddress) → bytes32` (public)



Calculates asset identifier.


### `getDebridgeId(uint256 _chainId, address _tokenAddress) → bytes32` (public)





### `getChainId() → uint256 cid` (public)





### `_safeTransferETH(address to, uint256 value)` (internal)





### `version() → uint256` (external)








