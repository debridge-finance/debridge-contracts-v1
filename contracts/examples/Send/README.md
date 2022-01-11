<br/>
<p align="center">
<a href="https://debridge.finance/" target="_blank">
<img src="https://user-images.githubusercontent.com/10200871/137014801-40decb80-0595-4f0f-8ee5-f0f1ab5c0380.png" width="225" alt="logo">
</a>
</p>
<br/>

[deBridge](https://debridge.finance/) — cross-chain interoperability
 and liquidity transfer protocol that allows the truly decentralized transfer of data and assets between various blockchains.

## Demo Scripts of Interaction with deBridge Protocol

This repository demonstrates how to interact with deBridge infrastructure in order to send arbitrary data and liquidity between any blockchains supported by the protocol

In order to run scripts please configure your local environment first:

1. ```yarn install``` <br />
2. Configure .env file — copy values from .env.testnet or .env.mainnet for the testnet and mainnet environments respectively. You may copy them to .env either in top-level or inside Send

### Sending of the Base Asset

```yarn contracts/examples/Send/src/sendETH.ts``` to send base asset of the blockchain where the transaction is initiated
You will see the following output:
![telegram-cloud-photo-size-2-5384605653412199381-y](https://user-images.githubusercontent.com/10200871/148461193-b7039b8f-99f9-4d61-8fd8-69d08a44a566.jpg)

Please note  the resulted SubmissionID which will be needed during the claim step

### Sending of the ERC-20 token

1. run ```yarn ts-node contracts/examples/Send/src/sendERC20.ts``` to send ERC-20 token

Please note  the resulted SubmissionID which will be needed during the claim step

### Track Status of the Cross-Chain Transactions
deBridge provides an explorer that allows tracking the status of all cross-chain transactions that pass through the protocol. Just put in txId in the search bar in order to see your transaction details

#### Links to the explorer:
**Testnet:** https://testnet-explorer.debridge.finance/

**Mainnet:** https://mainnet-explorer.debridge.finance/

### Claim transaction in the destination chain
The protocol implements [locking and minting](https://docs.debridge.finance/the-core-protocol/protocol-overview#naming) mechanics and guarantees that all wrapped assets (deAssets) are 1:1 backed by the collateral locked in the native chain of each respective asset

In order to have the transaction executed in the target chain, you should claim it by passing all parameters of the transaction alongside signatures of submissionId from all deBridge validators. 

In order to claim transaction execute
```yarn claim submissionId``` with submissionId of the transaction passed as an argument
