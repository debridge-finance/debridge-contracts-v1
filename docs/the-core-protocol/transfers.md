# Transfers Flow

###

![](../.gitbook/assets/B.png)

## Transfer From Native Chain

Let's consider the situation where the user performs a transfer of the asset from chain A (native chain of the asset) to chain B (secondary chain). Then the following steps are performed:

* If the transferred asset isn't the native blockchain asset (i.e ETH or BNB) the approve method is called. Then the `send` method of `DebridgeGate` contract is invoked. The transferred amount of the asset is locked in the smart contract. The % component of the protocol's fee is deducted from the amount and transferred to the treasury, `fix` component of the fee is paid by user in the base chain asset and also transferred to the treasury.
* deBridge validation nodes track events emitted by `deBridgeGate` smart contract and after a minimum number of blocks confirmations validators submit the transfer identifier (submissionId) to the `deBridgeAggregator` contract in the target chain. `submissionId` is calculated as a hash of concatenation:

```
 submissionId = keccak256(
                abi.encodePacked(
                    _debridgeId,
                    _chainIdFrom,
                    _chainIdTo,
                    _amount,
                    _receiver,
                    _nonce
                )
            );
```

where

```
debridgeID =  keccak256(abi.encodePacked(_chainId, _tokenAddress)); 
```

`debridgeID` is a hash of concatenation of the token native chain Id and native token address.

* The user or any other party (e.g. Keeper service) can call `mint` method of `deBridgeGate` contract with the correct `debridgeId, amount, receiver, nonce` parameters that compose the `submissionId.` If the `submissionId` collected the minimal required amount of confirmations from validators it is treated as confirmed and the wrapped asset is minted to the receiver address.

## Transfer from Secondary Chain

### Transfer From Secondary Chain to Native Chain

The transfer of the wrapped asset (deAsset) from the secondary chain back to the native chain is performed through the following steps:

* user sends the `approve` transaction that allows `deBridgeGate` contract spending the asset from the user's wallet.
* The `burn` method of `deBridgeGate` contract is called, the amount (minus protocol fees) of the asset is burnt and the `Burnt` event is emitted.
* deBridge validation nodes track `Burnt` events emitted by `deBridgeGate` smart contract and after the minimum number of blocks confirmations validators submit the transfer identifier (submissionId) to the `deBridgeAggregator` contract in the target chain.
* The user or any other party (e.g. Keeper service) can call `claim` method of `deBridgeGate` contract with the correct `submissionId.` If this `submissionId` collected the minimal required amount of confirmations from validators it is treated as confirmed and the corresponding amount of asset is unlocked from collateral at `deBridgeBase` smart contract and transferred to the receiver address.

### Transfer Between Secondary Chains

deBridge protocol supports **multi-chain routing** when users can transfer deAssets between secondary chains directly, without the need to route them through the native chain. These transfers work in the same way, but deAsset is burnt in the chain where the transfer is originated and the corresponding amount of deAsset is minted in the target chain

## Cross-Chain Transfers Execution Time

Cross-chain transfer through deBridge normally takes a few minutes and the delay is caused by two factors:

1. The finality of transaction in the blockchain where the transfer is originated
2. Time required for claim transaction to get into the block in the destination chain

Each blockchain has a different block generation time and requires a different number of block confirmations to treat the transaction as final, thus before validating the transaction validators have to wait for its finality
