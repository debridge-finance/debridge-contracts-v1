


## Functions
### initialize
```solidity
  function initialize(
  ) public
```




### pause
```solidity
  function pause(
  ) external
```




### unpause
```solidity
  function unpause(
  ) external
```




### setDebridgeGate
```solidity
  function setDebridgeGate(
  ) external
```




### setTreasury
```solidity
  function setTreasury(
  ) external
```




### withdrawFee
```solidity
  function withdrawFee(
  ) external
```

Transfer tokens to native chain and then create swap to deETH
and transfer reward to Ethereum network.


### withdrawNativeFee
```solidity
  function withdrawNativeFee(
  ) external
```

Swap native tokens to deETH and then transfer reward to Ethereum network.


### receive
```solidity
  function receive(
  ) external
```




### getbDebridgeId
```solidity
  function getbDebridgeId(
    uint256 _chainId,
    bytes _tokenAddress
  ) public returns (bytes32)
```

Calculates asset identifier.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_chainId` | uint256 | Current chain id.
|`_tokenAddress` | bytes | Address of the asset on the other chain.

### getDebridgeId
```solidity
  function getDebridgeId(
  ) public returns (bytes32)
```




### getChainId
```solidity
  function getChainId(
  ) public returns (uint256 cid)
```




### _safeTransferETH
```solidity
  function _safeTransferETH(
  ) internal
```




### version
```solidity
  function version(
  ) external returns (uint256)
```




