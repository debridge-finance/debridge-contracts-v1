## `DeBridgeGate`





### `onlyFeeProxy()`





### `onlyDefiController()`





### `onlyFeeContractUpdater()`





### `onlyAdmin()`





### `onlyGovMonitoring()`





### `lockClaim()`



lock for claim method


### `initialize(uint8 _excessConfirmations, contract IWETH _weth)` (public)



Constructor that initializes the most important configurations.

### `send(address _tokenAddress, uint256 _amount, uint256 _chainIdTo, bytes _receiver, bytes _permit, bool _useAssetFee, uint32 _referralCode, bytes _autoParams)` (external)



Locks asset on the chain and enables withdraw on the other chain.


### `claim(bytes32 _debridgeId, uint256 _amount, uint256 _chainIdFrom, address _receiver, uint256 _nonce, bytes _signatures, bytes _autoParams)` (external)



Unlock the asset on the current chain and transfer to receiver.


### `flash(address _tokenAddress, address _receiver, uint256 _amount, bytes _data)` (external)





### `deployNewAsset(bytes _nativeTokenAddress, uint256 _nativeChainId, string _name, string _symbol, uint8 _decimals, bytes _signatures)` (external)





### `autoUpdateFixedNativeFee(uint256 _globalFixedNativeFee)` (external)



Update native fix fee. called by our fee update contract


### `updateChainSupport(uint256[] _chainIds, struct IDeBridgeGate.ChainSupportInfo[] _chainSupportInfo, bool _isChainFrom)` (external)



Update asset's fees.


### `updateGlobalFee(uint256 _globalFixedNativeFee, uint16 _globalTransferFeeBps)` (external)





### `updateAssetFixedFees(bytes32 _debridgeId, uint256[] _supportedChainIds, uint256[] _assetFeesInfo)` (external)



Update asset's fees.


### `updateExcessConfirmations(uint8 _excessConfirmations)` (external)





### `setChainSupport(uint256 _chainId, bool _isSupported, bool _isChainFrom)` (external)



Set support for the chains where the token can be transfered.


### `setCallProxy(address _callProxy)` (external)



Set proxy address.


### `updateAsset(bytes32 _debridgeId, uint256 _maxAmount, uint16 _minReservesBps, uint256 _amountThreshold)` (external)



Add support for the asset.


### `setSignatureVerifier(address _verifier)` (external)



Set signature verifier address.


### `setDeBridgeTokenDeployer(address _deBridgeTokenDeployer)` (external)



Set asset deployer address.


### `setDefiController(address _defiController)` (external)



Set defi controoler.


### `setFeeContractUpdater(address _value)` (external)



Set fee contract updater, that can update fix native fee


### `setWethGate(contract IWethGate _wethGate)` (external)



Set wethGate contract, that uses for weth withdraws affected by EIP1884


### `pause()` (external)



Stop all transfers.

### `unpause()` (external)



Allow transfers.

### `withdrawFee(bytes32 _debridgeId)` (external)



Withdraw fees.


### `requestReserves(address _tokenAddress, uint256 _amount)` (external)



Request the assets to be used in defi protocol.


### `returnReserves(address _tokenAddress, uint256 _amount)` (external)



Return the assets that were used in defi protocol.


### `setFeeProxy(address _feeProxy)` (external)



Set fee converter proxy.


### `blockSubmission(bytes32[] _submissionIds, bool isBlocked)` (external)





### `updateFlashFee(uint256 _flashFeeBps)` (external)



Update flash fees.


### `updateFeeDiscount(address _address, uint16 _discountFixBps, uint16 _discountTransferBps)` (external)



Update discount.


### `receive()` (external)





### `_checkConfirmations(bytes32 _submissionId, bytes32 _debridgeId, uint256 _amount, bytes _signatures)` (internal)





### `_addAsset(bytes32 _debridgeId, address _tokenAddress, bytes _nativeAddress, uint256 _nativeChainId)` (internal)



Add support for the asset.


### `_send(bytes _permit, address _tokenAddress, uint256 _amount, uint256 _chainIdTo, bool _useAssetFee) → uint256 amountAfterFee, bytes32 debridgeId, struct IDeBridgeGate.FeeParams feeParams` (internal)



Locks asset on the chain and enables minting on the other chain.


### `_validateToken(address _token)` (internal)





### `_validateAutoParams(bytes _autoParams, uint256 _amount) → struct IDeBridgeGate.SubmissionAutoParamsTo autoParams` (internal)





### `_claim(bytes32 _submissionId, bytes32 _debridgeId, address _receiver, uint256 _amount, uint256 _chainIdFrom, struct IDeBridgeGate.SubmissionAutoParamsFrom _autoParams) → bool isNativeToken` (internal)



Unlock the asset on the current chain and transfer to receiver.


### `_mintOrTransfer(address _token, address _receiver, uint256 _amount, bool isNativeToken)` (internal)





### `_safeTransferETH(address to, uint256 value)` (internal)





### `_withdrawWeth(address _receiver, uint256 _amount)` (internal)





### `_normalizeTokenAmount(address _token, uint256 _amount) → uint256` (internal)





### `getDefiAvaliableReserves(address _tokenAddress) → uint256` (external)





### `getDebridgeId(uint256 _chainId, address _tokenAddress) → bytes32` (public)



Calculates asset identifier.


### `getbDebridgeId(uint256 _chainId, bytes _tokenAddress) → bytes32` (public)



Calculates asset identifier.


### `getDebridgeChainAssetFixedFee(bytes32 _debridgeId, uint256 _chainId) → uint256` (external)



Returns asset fixed fee value for specified debridge and chainId.


### `getSubmissionIdFrom(bytes32 _debridgeId, uint256 _chainIdFrom, uint256 _amount, address _receiver, uint256 _nonce, struct IDeBridgeGate.SubmissionAutoParamsFrom autoParams, bool hasAutoParams) → bytes32` (public)



Calculate submission id for auto claimable transfer.


### `getNativeTokenInfo(address currentTokenAddress) → uint256 nativeChainId, bytes nativeAddress` (external)





### `getChainId() → uint256 cid` (public)





### `version() → uint256` (external)








