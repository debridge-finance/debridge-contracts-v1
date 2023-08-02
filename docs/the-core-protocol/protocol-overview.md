# Protocol Overview

## Background

For a long time, bridges were viewed only as value transfer protocols and custodians that are responsible for locking assets on the source chain and issuing wrapped representations of the assets on the destination chain.

deBridge protocol drastically expands the concept of traditional bridges by introducing generic cross-chain message transfers. Now developers and builders can interconnect any smart contracts across different blockchains to perform transfers of data and transaction calls (messages that contain instructions to be executed, or `CALLDATA`) together with the value transfer in the same transaction.&#x20;

This opens up endless opportunities to build complex cross-chain interactions, such as multi-chain applications, next-layer protocols, automated cross-chain arbitraging services, object or NFT bridges, and more!&#x20;

As a generic messaging protocol and a cross-chain interoperability infrastructure, deBridge can be used to build any arbitrary cross-chain applications (deApps). Notable solutions built on top of deBridge are:

* [DLN](https://dln.trade/) — a high-performance cross-chain trading infrastructure built on deBridge with 0-TVL design (no liquidity pools).
* [dePort](https://app.debridge.finance/deport) —  a native bridge for assets that allows protocols to bridge tokens and create utility for their synthetic representation (deTokens) in other chains
* deNFT — an infrastructure for cross-chain NFTs transfers and a solution to create cross-chain native NFTs (coming soon)

Your application can be the next one and this documentation and tutorials will help to dive into the protocol infrastructure and elaborate on questions you might face while building your integration with deBridge.

## Protocol Structure

The protocol consists of 2 key layers:

* Protocol layer — on-chain smart contracts deployed in every blockchain supported by deBridge
* Infrastructure layer — off-chain validation nodes operated by validators who are elected by deBridge governance

![](../.gitbook/assets/C.png)

**The protocol layer** is a set of on-chain smart contracts used for asset management, routing of cross-chain transactions, cross-validation of validators' signatures, and reaching consensus among validators as the transaction is treated as valid only if the minimum required threshold of validators' signatures is achieved. The governance manages the parameters of the smart contracts, such as fees, supported chains, the whitelist of elected validators, validators payout ratio, and more.

**The infrastructure layer** is represented by a set of reputable validators who operate a deBridge node alongside full nodes of every blockchain supported by the protocol.&#x20;

### **Off-chain validation**

For all bridging protocols, it’s important to have a chain-agnostic design and make the protocol operation fully independent of the uptime of all supported blockchains. In case of downtime in any underlying blockchains, the protocol should keep processing the transactions for all other chains.&#x20;

deBridge has taken a unique approach with an off-chain transaction validation mechanic where validators don’t need to broadcast any transactions and bear gas costs. Every cross-chain transaction initiated through the deBridge smart contract is assigned a unique hash (Submission Id). deBridge validators are tracking all transactions that pass through the smart contract of the protocol and soon as the transaction achieves its finality, each validator is obliged to sign the Submission by its private key.&#x20;

The resulting signature is saved into Arweave — a decentralized data availability layer. Any arbitrary user or keeper can collect validator signatures from Arweave and pass them to the DebridgeGate smart contract in the target chain alongside all transaction parameters. Based on the passed set of parameters, the deBridge smart contract will restore a unique hash of the transaction and cross-validate its signatures from all designated validators. In case the minimum required number of signatures is valid, the DebridgeGate smart contract delivers the message on the destination chain by executing its' call data.

With this design, even in the eventuality some blockchains experience downtime, deBridge will still remain fully functional and all transactions going to the paused chain will be processed as soon as it resumes operation.&#x20;

### Transaction Finality Requirements

Due to the probabilistic finality model of most blockchains, before the message is validated by the deBridge infrastructure, validators are waiting for the required number of block confirmations before signing its Submission Id. The number of required block confirmations is based on the social consensus of transaction finality in each supported blockchain:

| Blockchain | Block Confirmations |
| ---------- | ------------------- |
| Ethereum   | 12                  |
| BNB Chain  | 12                  |
| Heco       | 12                  |
| Polygon    | 256                 |
| Arbitrum   | 12                  |
| Avalanche  | 12                  |
| Fantom     | 12                  |
| Solana     | Finalized Status    |

### Delegated Staking and Slashing

Validators play a crucial role in interoperability protocols since in addition to being infrastructure providers, they also secure the protocol by validating all cross-chain transactions passing through the protocol. Validators work for and are elected by the governance and should bear financial responsibility for the service they provide, assured through the risk of being slashed in case of validating a non-existent transaction or failing to maintain infrastructure uptime. Anyone can help to secure the protocol by becoming a delegator and staking assets (e.g. ETH, USDC) for validators’ collateral. Both validators and their delegators receive part of the protocol fees as an economic incentive for helping to secure the protocol and maintain its infrastructure. More details can be found in the [Slashing and Delegated Staking section.](slashing-and-delegated-staking.md)

## How it works

**deBridge is more than a bridge,** it's a secure interoperability layer for Web3 — a foundational layer that enables users and protocols to transport any arbitrary messages or `CALLDATA` across different chains enabling the ability to create any cross-chain solutions, such as deSwap — value transferring protocol built on top of deBridge

![](<../.gitbook/assets/image (5).png>)

The ability to pass arbitrary data opens up opportunities for true cross-chain composability of smart contracts and protocols that can now interact with each other despite they live in different blockchain ecosystems. An example would be an algorithmic stablecoin protocol on Ethereum that opens positions in perpetual markets protocol on Solana or Arbitrum in order to maintain the peg of its asset.

deBridge allows building a new generation of cross-chain protocols and applications that haven’t been possible in the past. Some of the use cases are:

* Cross-chain swaps
* Multi-chain governance
* Cross-chain lending
* Cross-chain yield farming

More information about potential use cases can be found in [debridge-use-cases.md](../external-links/debridge-use-cases.md "mention") section

###



