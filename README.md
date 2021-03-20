## How White Transfers Works

The transfer of the asset from chain A to chain B goes through the followed steps:

1. If the transfered asset isn't the native blockchain token (i.e ETH, BNB) the `approve` is done otherwise the transfered amount is attached to the next method.
2. The `send` method of `WhiteDebridge` contract is called. The `amount` of asset is locked on the contract, the fee is charged from the `amount` and the `Sent` event is emited.
3. The ChainLink nodes listen to the event on the `WhiteDebridge` contract and after 3 blocks confirmations submit the sent request identifier(`submissionId`) which is hash of concatination of `debridgeId`, `amount`, `receiver`, `nonce`. `DebridgeId` is hash of network id of the chain where the original token exists and token address on the original chain. The oracles are rewarded with LINKs immediatly after the submission.
4. After enough confirmations from Chainlink oracles (lets say 3 out of 5) the send request status becomes `confirmed`.
5. The user or any other party can call `mint` method of `WhiteDebridge` contract with the correct `debridgeId`, `amount`, `receiver`, `nonce` parameters that results into `submissionId`. If the submission is confirmed the wrapped asset is minted to the `receiver` address.

The transfer of the wrapped asset on chain B back to the original chain A to chain B goes through the followed steps:

1. The `approve` to spent the wrapped asset by `WhiteDebridge` is done.
2. The `burn` method of `WhiteDebridge` contract is called. The `amount` of the asset is burnt and the `Burnt` event is emited.
3. The ChainLink nodes listen to the event on the `WhiteDebridge` contract and after 3 blocks confirmations submit the burnt request identifier(`submissionId`) which is hash of concatination of `debridgeId`, `amount`, `receiver`, `nonce`. `DebridgeId` is hash of network id of the chain where the original token exists and token address on the original chain. The oracles are rewarded with LINKs immediatly after the submission.
4. After enough confirmations from Chainlink oracles (lets say 3 out of 5) the burnt request status becomes `confirmed`.
5. The user or any other party can call `claim` method of `WhiteDebridge` contract with the correct `debridgeId`, `amount`, `receiver`, `nonce` parameters that results into `submissionId`. If the submission is confirmed the fee is transfer fee is charged and original asset is sent to the `receiver` address.

**Note**: the chainlink node can only submit up to 32 bytes per one transaction to the chain that is why `debridgeId`, `amount`, `receiver`, `nonce` can't be submitted by the node in one transaction. To solve it the hash of the parameters is used.

## Aggregator

## Test

```
ganache-cli --account "0x0c2528af4d3abb4a8e605d6564105218338535e4b4214074ca588a1718702fd2,1000000000000000000"
```

# Ideas Backlog

[ ] add swap for collected fees to LINK

[ ] make the wrapped assets to support permits (allows to make off-chain approves)

[ ] use assets in other protocols
