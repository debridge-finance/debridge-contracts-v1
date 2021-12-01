


## Functions
### initialize
```solidity
  function initialize(
    uint8 _excessConfirmations,
    contract IWETH _weth
  ) public
```

Constructor that initializes the most important configurations.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_excessConfirmations` | uint8 | minimal required confirmations in case of too many confirmations
|`_weth` | contract IWETH | wrapped native token contract

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
|`_amount` | uint256 | Amount to be transferred (note: the fee can be applied).
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
|`_amount` | uint256 | Amount of the transferred asset (note: the fee can be applied).
|`_chainIdFrom` | uint256 | Chain where submission was sent
|`_receiver` | address | Receiver address.
|`_nonce` | uint256 | Submission id.
|`_signatures` | bytes | Validators signatures to confirm
|`_autoParams` | bytes | Auto params for external call

### flash
```solidity
  function flash(
    address _tokenAddress,
    address _receiver,
    uint256 _amount,
    bytes _data
  ) external
```

Get a flash loan, msg.sender must implement IFlashCallback

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_tokenAddress` | address | An asset to loan
|`_receiver` | address | Where funds should be sent
|`_amount` | uint256 | Amount to loan
|`_data` | bytes | Data to pass to sender's flashCallback function

### deployNewAsset
```solidity
  function deployNewAsset(
    bytes _nativeTokenAddress,
    uint256 _nativeChainId,
    string _name,
    string _symbol,
    uint8 _decimals,
    bytes _signatures
  ) external
```

Deploy a DeBridgeTokenProxy for an asset

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_nativeTokenAddress` | bytes | A token address on a native chain
|`_nativeChainId` | uint256 | The token native chain's id
|`_name` | string | The token's name
|`_symbol` | string | The token's symbol
|`_decimals` | uint8 | The token's decimals
|`_signatures` | bytes | Validators' signatures

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
    uint256 _globalFixedNativeFee,
    uint16 _globalTransferFeeBps
  ) external
```

Update fallbacks for fixed fee in native asset and transfer fee

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_globalFixedNativeFee` | uint256 | Fallback fixed fee in native asset, used if a chain fixed fee is set to 0
|`_globalTransferFeeBps` | uint16 | Fallback transfer fee in BPS, used if a chain transfer fee is set to 0

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
    uint8 _excessConfirmations
  ) external
```

Update minimal amount of required signatures, must be > SignatureVerifier.minConfirmations to have an effect

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_excessConfirmations` | uint8 | Minimal amount of required signatures

### setChainSupport
```solidity
  function setChainSupport(
    uint256 _chainId,
    bool _isSupported,
    bool _isChainFrom
  ) external
```

Set support for the chains where the token can be transferred.

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
    uint16 _minReservesBps,
    uint256 _amountThreshold
  ) external
```

Update an asset settings

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_debridgeId` | bytes32 | Asset identifier.
|`_maxAmount` | uint256 | Maximum amount of current chain token to be wrapped.
|`_minReservesBps` | uint16 | Minimal reserve ration in BPS.
|`_amountThreshold` | uint256 | Threshold amount after which Math.max(excessConfirmations,SignatureVerifier.minConfirmations) is used instead of SignatureVerifier.minConfirmations

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

Set defi controller.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_defiController` | address | Defi controller address.

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

Withdraw fees to feeProxy

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
    bytes32[] _submissionIds,
    bool isBlocked
  ) external
```

Block or unblock a list of submissions

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_submissionIds` | bytes32[] | Ids of submissions to block/unblock
|`isBlocked` | bool | True to block, false to unblock

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
|`_amount` | bytes | Amount to be transferred (note: the fee can be applied).
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
    address _tokenAddress
  ) external returns (uint256)
```

Get reservers of a token available to use in defi

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_tokenAddress` | address | Token address

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
    uint256 _amount,
    address _receiver,
    uint256 _nonce,
    struct IDeBridgeGate.SubmissionAutoParamsFrom autoParams,
    bool hasAutoParams
  ) public returns (bytes32)
```

Calculate submission id for auto claimable transfer.

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_debridgeId` | bytes32 | Asset identifier.
|`_chainIdFrom` | uint256 | Chain identifier of the chain where tokens are sent from.
|`_amount` | uint256 | Amount of the transferred asset (note: the fee can be applied).
|`_receiver` | address | Receiver address.
|`_nonce` | uint256 | Submission id.
|`autoParams` | struct IDeBridgeGate.SubmissionAutoParamsFrom | Auto params for external call
|`hasAutoParams` | bool | True if auto params are provided

### getNativeTokenInfo
```solidity
  function getNativeTokenInfo(
    address currentTokenAddress
  ) external returns (uint256 nativeChainId, bytes nativeAddress)
```

Get native chain id and native address of a token

#### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`currentTokenAddress` | address | address of a token on the current chain

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




