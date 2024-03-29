<!--This file is autogenerated-->





# Functions
## isSubmissionUsed
```solidity
  function isSubmissionUsed(
            bytes32 submissionId
  ) external returns (bool)
```

Returns whether the transfer with the submissionId was claimed.
submissionId is generated in getSubmissionIdFrom


## getNativeInfo
```solidity
  function getNativeInfo(
            address token
  ) external returns (uint256 nativeChainId, bytes nativeAddress)
```

Returns native token info by wrapped token address


## callProxy
```solidity
  function callProxy(
  ) external returns (address)
```

Returns address of the proxy to execute user's calls.


## globalFixedNativeFee
```solidity
  function globalFixedNativeFee(
  ) external returns (uint256)
```

Fallback fixed fee in native asset, used if a chain fixed fee is set to 0


## globalTransferFeeBps
```solidity
  function globalTransferFeeBps(
  ) external returns (uint16)
```

Fallback transfer fee in BPS, used if a chain transfer fee is set to 0


## sendMessage
```solidity
  function sendMessage(
            uint256 _dstChainId,
            bytes _targetContractAddress,
            bytes _targetContractCalldata
  ) external returns (bytes32 submissionId)
```
NO ASSETS ARE BROADCASTED ALONG WITH THIS MESSAGE
DeBridgeGate only accepts submissions with msg.value (native ether) covering a small protocol fee
        (defined in the globalFixedNativeFee property). Any excess amount of ether passed to this function is
        included in the message as the execution fee - the amount deBridgeGate would give as an incentive to
        a third party in return for successful claim transaction execution on the destination chain.
DeBridgeGate accepts a set of flags that control the behaviour of the execution. This simple method
        sets the default set of flags: REVERT_IF_EXTERNAL_FAIL, PROXY_WITH_SENDER

Submits the message to the deBridge infrastructure to be broadcasted to another supported blockchain (identified by _dstChainId)
     with the instructions to call the _targetContractAddress contract using the given _targetContractCalldata

### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_dstChainId` | uint256 | ID of the destination chain.
|`_targetContractAddress` | bytes | A contract address to be called on the destination chain
|`_targetContractCalldata` | bytes | Calldata to execute against the target contract on the destination chain

## sendMessage
```solidity
  function sendMessage(
            uint256 _dstChainId,
            bytes _targetContractAddress,
            bytes _targetContractCalldata,
            uint256 _flags,
            uint32 _referralCode
  ) external returns (bytes32 submissionId)
```
NO ASSETS ARE BROADCASTED ALONG WITH THIS MESSAGE
DeBridgeGate only accepts submissions with msg.value (native ether) covering a small protocol fee
        (defined in the globalFixedNativeFee property). Any excess amount of ether passed to this function is
        included in the message as the execution fee - the amount deBridgeGate would give as an incentive to
        a third party in return for successful claim transaction execution on the destination chain.
DeBridgeGate accepts a set of flags that control the behaviour of the execution. This simple method
        sets the default set of flags: REVERT_IF_EXTERNAL_FAIL, PROXY_WITH_SENDER

Submits the message to the deBridge infrastructure to be broadcasted to another supported blockchain (identified by _dstChainId)
     with the instructions to call the _targetContractAddress contract using the given _targetContractCalldata

### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_dstChainId` | uint256 | ID of the destination chain.
|`_targetContractAddress` | bytes | A contract address to be called on the destination chain
|`_targetContractCalldata` | bytes | Calldata to execute against the target contract on the destination chain
|`_flags` | uint256 | A bitmask of toggles listed in the Flags library
|`_referralCode` | uint32 | Referral code to identify this submission

## send
```solidity
  function send(
            address _tokenAddress,
            uint256 _amount,
            uint256 _chainIdTo,
            bytes _receiver,
            bytes _permitEnvelope,
            bool _useAssetFee,
            uint32 _referralCode,
            bytes _autoParams
  ) external returns (bytes32 submissionId)
```

This method is used for the transfer of assets [from the native chain](https://docs.debridge.finance/the-core-protocol/transfers#transfer-from-native-chain).
It locks an asset in the smart contract in the native chain and enables minting of deAsset on the secondary chain.

### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_tokenAddress` | address | Asset identifier.
|`_amount` | uint256 | Amount to be transferred (note: the fee can be applied).
|`_chainIdTo` | uint256 | Chain id of the target chain.
|`_receiver` | bytes | Receiver address.
|`_permitEnvelope` | bytes | Permit for approving the spender by signature. bytes (amount + deadline + signature)
|`_useAssetFee` | bool | use assets fee for pay protocol fix (work only for specials token)
|`_referralCode` | uint32 | Referral code
|`_autoParams` | bytes | Auto params for external call in target network

## claim
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

Is used for transfers [into the native chain](https://docs.debridge.finance/the-core-protocol/transfers#transfer-from-secondary-chain-to-native-chain)
to unlock the designated amount of asset from collateral and transfer it to the receiver.

### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_debridgeId` | bytes32 | Asset identifier.
|`_amount` | uint256 | Amount of the transferred asset (note: the fee can be applied).
|`_chainIdFrom` | uint256 | Chain where submission was sent
|`_receiver` | address | Receiver address.
|`_nonce` | uint256 | Submission id.
|`_signatures` | bytes | Validators signatures to confirm
|`_autoParams` | bytes | Auto params for external call

## withdrawFee
```solidity
  function withdrawFee(
            bytes32 _debridgeId
  ) external
```

Withdraw collected fees to feeProxy

### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_debridgeId` | bytes32 | Asset identifier.

## getDebridgeChainAssetFixedFee
```solidity
  function getDebridgeChainAssetFixedFee(
            bytes32 _debridgeId,
            uint256 _chainId
  ) external returns (uint256)
```

Returns asset fixed fee value for specified debridge and chainId.

### Parameters:
| Name | Type | Description                                                          |
| :--- | :--- | :------------------------------------------------------------------- |
|`_debridgeId` | bytes32 | Asset identifier.
|`_chainId` | uint256 | Chain id.


# Events
## Sent
```solidity
  event Sent(
        bytes32 submissionId,
        bytes32 debridgeId,
        uint256 amount,
        bytes receiver,
        uint256 nonce,
        uint256 chainIdTo,
        uint32 referralCode,
        struct IDeBridgeGate.FeeParams feeParams,
        bytes autoParams,
        address nativeSender
  )
```

Emitted once the tokens are sent from the original(native) chain to the other chain; the transfer tokens
are expected to be claimed by the users.


## Claimed
```solidity
  event Claimed(
        bytes32 submissionId,
        bytes32 debridgeId,
        uint256 amount,
        address receiver,
        uint256 nonce,
        uint256 chainIdFrom,
        bytes autoParams,
        bool isNativeToken
  )
```

Emitted once the tokens are transferred and withdrawn on a target chain


## PairAdded
```solidity
  event PairAdded(
        bytes32 debridgeId,
        address tokenAddress,
        bytes nativeAddress,
        uint256 nativeChainId,
        uint256 maxAmount,
        uint16 minReservesBps
  )
```

Emitted when new asset support is added.


## MonitoringSendEvent
```solidity
  event MonitoringSendEvent(
        bytes32 submissionId,
        uint256 nonce,
        uint256 lockedOrMintedAmount,
        uint256 totalSupply
  )
```




## MonitoringClaimEvent
```solidity
  event MonitoringClaimEvent(
        bytes32 submissionId,
        uint256 lockedOrMintedAmount,
        uint256 totalSupply
  )
```




## ChainSupportUpdated
```solidity
  event ChainSupportUpdated(
        uint256 chainId,
        bool isSupported,
        bool isChainFrom
  )
```

Emitted when the asset is allowed/disallowed to be transferred to the chain.


## ChainsSupportUpdated
```solidity
  event ChainsSupportUpdated(
        uint256 chainIds,
        struct IDeBridgeGate.ChainSupportInfo chainSupportInfo,
        bool isChainFrom
  )
```

Emitted when the supported chains are updated.


## CallProxyUpdated
```solidity
  event CallProxyUpdated(
        address callProxy
  )
```

Emitted when the new call proxy is set.


## AutoRequestExecuted
```solidity
  event AutoRequestExecuted(
        bytes32 submissionId,
        bool success,
        address callProxy
  )
```

Emitted when the transfer request is executed.


## Blocked
```solidity
  event Blocked(
        bytes32 submissionId
  )
```

Emitted when a submission is blocked.


## Unblocked
```solidity
  event Unblocked(
        bytes32 submissionId
  )
```

Emitted when a submission is unblocked.


## WithdrawnFee
```solidity
  event WithdrawnFee(
        bytes32 debridgeId,
        uint256 fee
  )
```

Emitted when fee is withdrawn.


## FixedNativeFeeUpdated
```solidity
  event FixedNativeFeeUpdated(
        uint256 globalFixedNativeFee,
        uint256 globalTransferFeeBps
  )
```

Emitted when globalFixedNativeFee and globalTransferFeeBps are updated.


## FixedNativeFeeAutoUpdated
```solidity
  event FixedNativeFeeAutoUpdated(
        uint256 globalFixedNativeFee
  )
```

Emitted when globalFixedNativeFee is updated by feeContractUpdater



# Structs
## TokenInfo
```solidity
struct TokenInfo {
    uint256 nativeChainId;
    bytes nativeAddress;
}
```
## DebridgeInfo
```solidity
struct DebridgeInfo {
    uint256 chainId;
    uint256 maxAmount;
    uint256 balance;
    uint256 lockedInStrategies;
    address tokenAddress;
    uint16 minReservesBps;
    bool exist;
}
```
## DebridgeFeeInfo
```solidity
struct DebridgeFeeInfo {
    uint256 collectedFees;
    uint256 withdrawnFees;
    mapping(uint256 => uint256) getChainFee;
}
```
## ChainSupportInfo
```solidity
struct ChainSupportInfo {
    uint256 fixedNativeFee;
    bool isSupported;
    uint16 transferFeeBps;
}
```
## DiscountInfo
```solidity
struct DiscountInfo {
    uint16 discountFixBps;
    uint16 discountTransferBps;
}
```
## SubmissionAutoParamsTo
```solidity
struct SubmissionAutoParamsTo {
    uint256 executionFee;
    uint256 flags;
    bytes fallbackAddress;
    bytes data;
}
```
## SubmissionAutoParamsFrom
```solidity
struct SubmissionAutoParamsFrom {
    uint256 executionFee;
    uint256 flags;
    address fallbackAddress;
    bytes data;
    bytes nativeSender;
}
```
## FeeParams
```solidity
struct FeeParams {
    uint256 receivedAmount;
    uint256 fixFee;
    uint256 transferFee;
    bool useAssetFee;
    bool isNativeToken;
}
```

