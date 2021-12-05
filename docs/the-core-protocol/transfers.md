# Transfers Flow

###

![](../.gitbook/assets/B.png)

## Transfer From Native Chain

Let's consider the situation where the user performs a transfer of the asset from chain A (native chain of the asset) to chain B (secondary chain). Then the following steps are performed:

* If the transferred asset isn't the native blockchain asset (i.e ETH or BNB) the approve method is called. Then the `send` method of `DebridgeGate` contract is invoked. The transferred amount of asset is locked in the smart contract. The % component of the protocol's fee is deducted from the amount and transferred to the treasury, `fix` component of the fee is paid by user in the base chain asset and also transferred to the treasury.
* deBridge validation nodes track events emitted by `deBridgeGate` smart contract and after a minimum number of blocks confirmations validators submit the transfer identifier (submissionId) to the `deBridgeAggregator` contract in the target chain. `submissionId`  is calculated as a hash of concatenation:

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

where&#x20;

```
debridgeID =  keccak256(abi.encodePacked(_chainId, _tokenAddress)); 
```

`debridgeID` is a hash of concatenation of the token native chain Id and native token address.

* The user or any other party (e.g. Keeper service) can call `mint` method of `deBridgeGate` contract with the correct `debridgeId, amount, receiver, nonce` parameters that compose the `submissionId.` If the `submissionId` collected the minimal required amount of confirmations from validators it is treated as confirmed and the wrapped asset is minted to the receiver address.

## Transfer from Secondary Chain

### Transfer From Secondary Chain to Native Chain

The transfer of the wrapped asset (deAsset) from the secondary chain back to the native chain is performed through the following steps:

* user sends the `approve` transaction that allows `deBridgeGate` contract spending the asset from user's wallet.
* &#x20;The `burn` method of `deBridgeGate` contract is called, the amount (less protocol fees) of the asset is burnt and the `Burnt` event is emitted.
* deBridge validation nodes track `Burnt` events emitted by `deBridgeGate` smart contract and after the minimum number of blocks confirmations validators submit the transfer identifier (submissionId) to the `deBridgeAggregator` contract in the target chain.
* The user or any other party (e.g. Keeper service) can call `claim` method of `deBridgeGate` contract with the correct `submissionId.` If this `submissionId` collected the minimal required amount of confirmations from validators it is treated as confirmed and the corresponding amount of asset is unlocked from collateral at `deBridgeBase` smart contract and transferred to the receiver address.

### Transfer Between Secondary Chains

deBridge protocol supports **multi-chain routing** when users can transfer deAssets between secondary chains directly, without the need to route them through the native chain. These transfers work in the same way, but deAsset is burnt in the chain where the transfer is originated and the corresponding amount of deAsset is minted in the target chain.

## Light Validation

The described approach works well for transfers between any blockchain networks where the target chain has cheap transaction fees. But what if transfer is performed into Ethereum, especially at the moment of high gas prices? Each validator would has to bear transaction costs of submitting validation transaction for each performed transfer. In this case transaction validation costs may even exceed an amount of asset being transferred, especially taking into account that deBridge DON will consist of more than 10 validators. In order to solve this problem, the protocol design also provides a **Light Validation** method, when deBridge validators can submit validating transaction into the `LightAggregator` contract of another cheap blockchain or L2 ([Arbitrum](https://offchainlabs.com)) which is used as storage of validators signatures.

When user claims asset in the `deBridgeGate` smart contract in the native chain or mints deAsset in the secondary chain, he passes minimal required number of oracles signatures for this transfer (SubmissionId) from the `LightAggregator` contract in Arbitrum.&#x20;

```
function claim(
        bytes32 _debridgeId,
        uint256 _chainIdFrom,
        address _receiver,
        uint256 _amount,
        uint256 _nonce,
        bytes[] calldata _signatures
    )
```

`deBridgeGate` smart-contract cross-validates validators signatures for this `submissionId` to make sure that those signatures belong to white-listed validators. If the minimum required amount of signatures are valid, the user receives a designated amount of asset into his wallet. Since all claims are performed asynchronously through the smart contract, there is no nonce dependency and all actions are performed in a fast manner

## Cross-Chain Transfers Execution Time

Cross-chain transfer through deBridge normally takes less than 1 minute and the delay is caused by two factors:

1. The finality of transaction in the blockchain where the transfer is originated&#x20;
2. Time required for validators to send confirmation transaction of the transfer

Each blockchain has a different block generation time and requires a different number of block confirmations to treat the transaction as final, thus before validating the transaction validators have to wait for its finality. The longest delay (\~2 minutes) is for transfers from Ethereum as 10 block confirmations are needed before each validator starts submitting a validating transaction for the transfer. Even though the execution of transfers is not instant, user experience with deBridge is better than with most existing bridging solutions

