# Introduction

The deBridge Liquidity Network Protocol is an on-chain system of smart contracts where users place their cross-chain limit orders, giving a specific amount of input token on the source chain (`giveAmount` of the `giveToken` on the `giveChain`) and specifying the outcome they are willing to take on the destination chain (`takeAmount` of the `takeToken` on the `takeChain`).&#x20;

The given amount is being locked by the `DlnSource` smart contract on the source chain and anyone with enough liquidity (called _Solvers_) can attempt to fulfill the order by calling the `DlnDestination` smart contract on the destination chain supplying the requested amount of tokens the user is willing to take. After the order is fulfilled, the supplied amount is immediately transferred to the recipient specified by the user, and a cross-chain message is sent to the source chain via the deBridge infrastructure to unlock the funds, effectively completing the order.Getting ready to make on-chain calls

The DLN Protocol consists of two contracts: the `DlnSource` contract responsible for order placement, and the `DlnDestination` contract responsible for order fulfillment.

Currently, both contracts are deployed on the [supported blockchains](../fees-and-supported-chains.md) effectively allowing anyone to place orders in any direction. Contract addresses and ABIs can be found here: [Trusted Smart Contracts](../deployed-contracts.md)
