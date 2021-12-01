


## Functions
### isSubmissionUsed
```solidity
  function isSubmissionUsed(
  ) external returns (bool)
```




### send
```solidity
  function send(
    address _tokenAddress,
    uint256 _receiver,
    uint256 _amount,
    bytes _chainIdTo
  ) external
```

Locks asset on the chain and enables minting on the other chain.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_tokenAddress` | address | Asset identifier.
|`_receiver` | uint256 | Receiver address.
|`_amount` | uint256 | Amount to be transfered (note: the fee can be applyed).
|`_chainIdTo` | bytes | Chain id of the target chain.

### claim
```solidity
  function claim(
    bytes32 _debridgeId,
    uint256 _receiver,
    uint256 _amount,
    address _nonce
  ) external
```

Unlock the asset on the current chain and transfer to receiver.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_debridgeId` | bytes32 | Asset identifier.
|`_receiver` | uint256 | Receiver address.
|`_amount` | uint256 | Amount of the transfered asset (note: the fee can be applyed).
|`_nonce` | address | Submission id.

### flash
```solidity
  function flash(
  ) external
```




### getDefiAvaliableReserves
```solidity
  function getDefiAvaliableReserves(
  ) external returns (uint256)
```




### requestReserves
```solidity
  function requestReserves(
    address _tokenAddress,
    uint256 _amount
  ) external
```

Request the assets to be used in defi protocol.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_tokenAddress` | address | Asset address.
|`_amount` | uint256 | Amount of tokens to request.

### returnReserves
```solidity
  function returnReserves(
    address _tokenAddress,
    uint256 _amount
  ) external
```

Return the assets that were used in defi protocol.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_tokenAddress` | address | Asset address.
|`_amount` | uint256 | Amount of tokens to claim.

### withdrawFee
```solidity
  function withdrawFee(
    bytes32 _debridgeId
  ) external
```

Withdraw fees.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_debridgeId` | bytes32 | Asset identifier.

### getNativeTokenInfo
```solidity
  function getNativeTokenInfo(
  ) external returns (uint256 chainId, bytes nativeAddress)
```




### getDebridgeChainAssetFixedFee
```solidity
  function getDebridgeChainAssetFixedFee(
  ) external returns (uint256)
```




## Events
### Sent
```solidity
  event Sent(
  )
```



### Claimed
```solidity
  event Claimed(
  )
```



### PairAdded
```solidity
  event PairAdded(
  )
```



### ChainSupportUpdated
```solidity
  event ChainSupportUpdated(
  )
```



### ChainsSupportUpdated
```solidity
  event ChainsSupportUpdated(
  )
```



### CallProxyUpdated
```solidity
  event CallProxyUpdated(
  )
```



### AutoRequestExecuted
```solidity
  event AutoRequestExecuted(
  )
```



### Blocked
```solidity
  event Blocked(
  )
```



### Unblocked
```solidity
  event Unblocked(
  )
```



### Flash
```solidity
  event Flash(
  )
```



### WithdrawnFee
```solidity
  event WithdrawnFee(
  )
```



### FixedNativeFeeUpdated
```solidity
  event FixedNativeFeeUpdated(
  )
```



### FixedNativeFeeAutoUpdated
```solidity
  event FixedNativeFeeAutoUpdated(
  )
```



