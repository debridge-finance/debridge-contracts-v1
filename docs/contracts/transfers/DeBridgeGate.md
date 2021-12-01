


## Functions
### initialize
```solidity
  function initialize(
  ) public
```

Constructor that initializes the most important configurations.


### send
```solidity
  function send(
    address _tokenAddress,
    uint256 _amount,
    uint256 _chainIdTo,
    bytes _receiver,
    bytes _permit,
    bool _useAssetFee,
    uint32 _referralCode,
    bytes _autoParams
  ) external
```

Locks asset on the chain and enables withdraw on the other chain.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_tokenAddress` | address | Asset identifier.
|`_amount` | uint256 | Amount to be transfered (note: the fee can be applyed).
|`_chainIdTo` | uint256 | Chain id of the target chain.
|`_receiver` | bytes | Receiver address.
|`_permit` | bytes | deadline + signature for approving the spender by signature.
|`_useAssetFee` | bool | use assets fee for pay protocol fix (work only for specials token)
|`_referralCode` | uint32 | Referral code
|`_autoParams` | bytes | Auto params for external call in target network

### claim
```solidity
  function claim(
    bytes32 _debridgeId,
    uint256 _amount,
    uint256 _chainIdFrom,
    address _receiver,
    uint256 _nonce,
    bytes _signatures,
    bytes _autoParams
  ) external
```

Unlock the asset on the current chain and transfer to receiver.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_debridgeId` | bytes32 | Asset identifier.
|`_amount` | uint256 | Amount of the transfered asset (note: the fee can be applyed).
|`_chainIdFrom` | uint256 | Chain where submission was sent
|`_receiver` | address | Receiver address.
|`_nonce` | uint256 | Submission id.
|`_signatures` | bytes | Validators signatures to confirm
|`_autoParams` | bytes | Auto params for external call

### flash
```solidity
  function flash(
  ) external
```




### deployNewAsset
```solidity
  function deployNewAsset(
  ) external
```




### autoUpdateFixedNativeFee
```solidity
  function autoUpdateFixedNativeFee(
    uint256 _globalFixedNativeFee
  ) external
```

Update native fix fee. called by our fee update contract

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_globalFixedNativeFee` | uint256 |  new value

### updateChainSupport
```solidity
  function updateChainSupport(
    uint256[] _chainIds,
    struct IDeBridgeGate.ChainSupportInfo[] _chainSupportInfo,
    bool _isChainFrom
  ) external
```

Update asset's fees.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_chainIds` | uint256[] | Chain identifiers.
|`_chainSupportInfo` | struct IDeBridgeGate.ChainSupportInfo[] | Chain support info.
|`_isChainFrom` | bool | is true for editing getChainFromConfig.

### updateGlobalFee
```solidity
  function updateGlobalFee(
  ) external
```




### updateAssetFixedFees
```solidity
  function updateAssetFixedFees(
    bytes32 _debridgeId,
    uint256[] _supportedChainIds,
    uint256[] _assetFeesInfo
  ) external
```

Update asset's fees.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_debridgeId` | bytes32 | Asset identifier.
|`_supportedChainIds` | uint256[] | Chain identifiers.
|`_assetFeesInfo` | uint256[] | Chain support info.

### updateExcessConfirmations
```solidity
  function updateExcessConfirmations(
  ) external
```




### setChainSupport
```solidity
  function setChainSupport(
    uint256 _chainId,
    bool _isSupported,
    bool _isChainFrom
  ) external
```

Set support for the chains where the token can be transfered.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_chainId` | uint256 | Chain id where tokens are sent.
|`_isSupported` | bool | Whether the token is transferable to the other chain.
|`_isChainFrom` | bool | is true for editing getChainFromConfig.

### setCallProxy
```solidity
  function setCallProxy(
    address _callProxy
  ) external
```

Set proxy address.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_callProxy` | address | Address of the proxy that executes external calls.

### updateAsset
```solidity
  function updateAsset(
    bytes32 _debridgeId,
    uint256 _maxAmount,
    uint16 _minReservesBps
  ) external
```

Add support for the asset.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_debridgeId` | bytes32 | Asset identifier.
|`_maxAmount` | uint256 | Maximum amount of current chain token to be wrapped.
|`_minReservesBps` | uint16 | Minimal reserve ration in BPS.

### setSignatureVerifier
```solidity
  function setSignatureVerifier(
    address _verifier
  ) external
```

Set signature verifier address.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_verifier` | address | Signature verifier address.

### setDeBridgeTokenDeployer
```solidity
  function setDeBridgeTokenDeployer(
    address _deBridgeTokenDeployer
  ) external
```

Set asset deployer address.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_deBridgeTokenDeployer` | address | Asset deployer address.

### setDefiController
```solidity
  function setDefiController(
    address _defiController
  ) external
```

Set defi controoler.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_defiController` | address | Defi controller address address.

### setFeeContractUpdater
```solidity
  function setFeeContractUpdater(
    address _value
  ) external
```

Set fee contract updater, that can update fix native fee

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_value` | address | new contract address.

### setWethGate
```solidity
  function setWethGate(
    contract IWethGate _wethGate
  ) external
```

Set wethGate contract, that uses for weth withdraws affected by EIP1884

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_wethGate` | contract IWethGate | address of new wethGate contract.

### pause
```solidity
  function pause(
  ) external
```

Stop all transfers.


### unpause
```solidity
  function unpause(
  ) external
```

Allow transfers.


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

### setFeeProxy
```solidity
  function setFeeProxy(
    address _feeProxy
  ) external
```

Set fee converter proxy.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_feeProxy` | address | Fee proxy address.

### blockSubmission
```solidity
  function blockSubmission(
  ) external
```




### updateFlashFee
```solidity
  function updateFlashFee(
    uint256 _flashFeeBps
  ) external
```

Update flash fees.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_flashFeeBps` | uint256 | new fee in BPS

### updateFeeDiscount
```solidity
  function updateFeeDiscount(
    address _address,
    uint16 _discountFixBps,
    uint16 _discountTransferBps
  ) external
```

Update discount.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_address` | address | customer address
|`_discountFixBps` | uint16 |  fix discount in BPS
|`_discountTransferBps` | uint16 | transfer % discount in BPS

### receive
```solidity
  function receive(
  ) external
```




### _checkConfirmations
```solidity
  function _checkConfirmations(
  ) internal
```




### _addAsset
```solidity
  function _addAsset(
    bytes32 _debridgeId,
    address _tokenAddress,
    bytes _nativeAddress,
    uint256 _nativeChainId
  ) internal
```

Add support for the asset.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_debridgeId` | bytes32 | Asset identifier.
|`_tokenAddress` | address | Address of the asset on the current chain.
|`_nativeAddress` | bytes | Address of the asset on the native chain.
|`_nativeChainId` | uint256 | Native chain id.

### _send
```solidity
  function _send(
    bytes _amount,
    address _chainIdTo,
    uint256 _permit
  ) internal returns (uint256 amountAfterFee, bytes32 debridgeId, struct IDeBridgeGate.FeeParams feeParams)
```

Locks asset on the chain and enables minting on the other chain.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_amount` | bytes | Amount to be transfered (note: the fee can be applyed).
|`_chainIdTo` | address | Chain id of the target chain.
|`_permit` | uint256 | deadline + signature for approving the spender by signature.

### _validateToken
```solidity
  function _validateToken(
  ) internal
```




### _validateAutoParams
```solidity
  function _validateAutoParams(
  ) internal returns (struct IDeBridgeGate.SubmissionAutoParamsTo autoParams)
```




### _claim
```solidity
  function _claim(
    bytes32 _debridgeId,
    bytes32 _receiver,
    address _amount
  ) internal returns (bool isNativeToken)
```

Unlock the asset on the current chain and transfer to receiver.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_debridgeId` | bytes32 | Asset identifier.
|`_receiver` | bytes32 | Receiver address.
|`_amount` | address | Amount of the transfered asset (note: the fee can be applyed).

### _mintOrTransfer
```solidity
  function _mintOrTransfer(
  ) internal
```




### _safeTransferETH
```solidity
  function _safeTransferETH(
  ) internal
```




### _withdrawWeth
```solidity
  function _withdrawWeth(
  ) internal
```




### _normalizeTokenAmount
```solidity
  function _normalizeTokenAmount(
  ) internal returns (uint256)
```




### getDefiAvaliableReserves
```solidity
  function getDefiAvaliableReserves(
  ) external returns (uint256)
```




### getDebridgeId
```solidity
  function getDebridgeId(
    uint256 _chainId,
    address _tokenAddress
  ) public returns (bytes32)
```

Calculates asset identifier.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_chainId` | uint256 | Current chain id.
|`_tokenAddress` | address | Address of the asset on the other chain.

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

### getDebridgeChainAssetFixedFee
```solidity
  function getDebridgeChainAssetFixedFee(
    bytes32 _debridgeId,
    uint256 _chainId
  ) external returns (uint256)
```

Returns asset fixed fee value for specified debridge and chainId.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_debridgeId` | bytes32 | Asset identifier.
|`_chainId` | uint256 | Chain id.

### getSubmissionIdFrom
```solidity
  function getSubmissionIdFrom(
    bytes32 _debridgeId,
    uint256 _chainIdFrom,
    uint256 _receiver,
    address _amount,
    uint256 _nonce
  ) public returns (bytes32)
```

Calculate submission id for auto claimable transfer.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_debridgeId` | bytes32 | Asset identifier.
|`_chainIdFrom` | uint256 | Chain identifier of the chain where tokens are sent from.
|`_receiver` | uint256 | Receiver address.
|`_amount` | address | Amount of the transfered asset (note: the fee can be applyed).
|`_nonce` | uint256 | Submission id.

### getNativeTokenInfo
```solidity
  function getNativeTokenInfo(
  ) external returns (uint256 nativeChainId, bytes nativeAddress)
```




### getChainId
```solidity
  function getChainId(
  ) public returns (uint256 cid)
```




### version
```solidity
  function version(
  ) external returns (uint256)
```




