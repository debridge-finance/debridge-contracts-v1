## `IDeBridgeGate`






### `isSubmissionUsed(bytes32 submissionId) → bool` (external)





### `send(address _tokenAddress, uint256 _amount, uint256 _chainIdTo, bytes _receiver, bytes _permit, bool _useAssetFee, uint32 _referralCode, bytes _autoParams)` (external)



Locks asset on the chain and enables minting on the other chain.


### `claim(bytes32 _debridgeId, uint256 _amount, uint256 _chainIdFrom, address _receiver, uint256 _nonce, bytes _signatures, bytes _autoParams)` (external)



Unlock the asset on the current chain and transfer to receiver.


### `flash(address _tokenAddress, address _receiver, uint256 _amount, bytes _data)` (external)





### `getDefiAvaliableReserves(address _tokenAddress) → uint256` (external)





### `requestReserves(address _tokenAddress, uint256 _amount)` (external)



Request the assets to be used in defi protocol.


### `returnReserves(address _tokenAddress, uint256 _amount)` (external)



Return the assets that were used in defi protocol.


### `withdrawFee(bytes32 _debridgeId)` (external)



Withdraw fees.


### `getNativeTokenInfo(address currentTokenAddress) → uint256 chainId, bytes nativeAddress` (external)





### `getDebridgeChainAssetFixedFee(bytes32 _debridgeId, uint256 _chainId) → uint256` (external)






### `Sent(bytes32 submissionId, bytes32 debridgeId, uint256 amount, bytes receiver, uint256 nonce, uint256 chainIdTo, uint32 referralCode, struct IDeBridgeGate.FeeParams feeParams, bytes autoParams, address nativeSender)`





### `Claimed(bytes32 submissionId, bytes32 debridgeId, uint256 amount, address receiver, uint256 nonce, uint256 chainIdFrom, bytes autoParams, bool isNativeToken)`





### `PairAdded(bytes32 debridgeId, address tokenAddress, bytes nativeAddress, uint256 nativeChainId, uint256 maxAmount, uint16 minReservesBps)`





### `ChainSupportUpdated(uint256 chainId, bool isSupported, bool isChainFrom)`





### `ChainsSupportUpdated(uint256 chainIds, struct IDeBridgeGate.ChainSupportInfo chainSupportInfo, bool isChainFrom)`





### `CallProxyUpdated(address callProxy)`





### `AutoRequestExecuted(bytes32 submissionId, bool success, address callProxy)`





### `Blocked(bytes32 submissionId)`





### `Unblocked(bytes32 submissionId)`





### `Flash(address sender, address tokenAddress, address receiver, uint256 amount, uint256 paid)`





### `WithdrawnFee(bytes32 debridgeId, uint256 fee)`





### `FixedNativeFeeUpdated(uint256 globalFixedNativeFee, uint256 globalTransferFeeBps)`





### `FixedNativeFeeAutoUpdated(uint256 globalFixedNativeFee)`






### `TokenInfo`


uint256 nativeChainId


bytes nativeAddress


### `DebridgeInfo`


uint256 chainId


uint256 maxAmount


uint256 balance


uint256 lockedInStrategies


address tokenAddress


uint16 minReservesBps


bool exist


### `DebridgeFeeInfo`


uint256 collectedFees


uint256 withdrawnFees


mapping(uint256 => uint256) getChainFee


### `ChainSupportInfo`


uint256 fixedNativeFee


bool isSupported


uint16 transferFeeBps


### `DiscountInfo`


uint16 discountFixBps


uint16 discountTransferBps


### `SubmissionAutoParamsTo`


uint256 executionFee


uint256 flags


bytes fallbackAddress


bytes data


### `SubmissionAutoParamsFrom`


uint256 executionFee


uint256 flags


address fallbackAddress


bytes data


bytes nativeSender


### `FeeParams`


uint256 receivedAmount


uint256 fixFee


uint256 transferFee


bool useAssetFee


bool isNativeToken



