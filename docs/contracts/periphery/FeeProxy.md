## `FeeProxy`





### `onlyWorker()`





### `onlyAdmin()`






### `initialize(contract IUniswapV2Factory _uniswapFactory, contract IWETH _weth)` (public)





### `pause()` (external)





### `unpause()` (external)





### `setUniswapFactory(contract IUniswapV2Factory _uniswapFactory)` (external)





### `setDebridgeGate(contract IDeBridgeGate _debridgeGate)` (external)





### `setTreasury(uint256 _chainId, bytes _treasuryAddress)` (external)





### `setDeEthToken(address _deEthToken)` (external)





### `setFeeProxyAddress(uint256 _chainId, bytes _address)` (external)





### `withdrawFee(address _tokenAddress)` (external)



Transfer tokens to native chain and then create swap to deETH
and transfer reward to Ethereum network.

### `withdrawNativeFee()` (external)



Swap native tokens to deETH and then transfer reward to Ethereum network.

### `receive()` (external)





### `getbDebridgeId(uint256 _chainId, bytes _tokenAddress) → bytes32` (public)



Calculates asset identifier.


### `getDebridgeId(uint256 _chainId, address _tokenAddress) → bytes32` (public)





### `toAddress(bytes _bytes) → address result` (internal)





### `getChainId() → uint256 cid` (public)





### `_safeTransferETH(address to, uint256 value)` (internal)





### `version() → uint256` (external)








