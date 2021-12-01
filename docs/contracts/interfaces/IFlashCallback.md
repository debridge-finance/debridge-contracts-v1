Any contract that calls IDeBridgeGate#flash must implement this interface


## Functions
### flashCallback
```solidity
  function flashCallback(
    uint256 fee,
    bytes data
  ) external
```


#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`fee` | uint256 | The fee amount in token due to the pool by the end of the flash
|`data` | bytes | Any data passed through by the caller via the IDeBridgeGate#flash call

