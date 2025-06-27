---
description: To streamline liquidity management, DLN uses a fixed set of reserve assets.
---

# Reserve Assets

[DeBridge Liquidity Network](broken-reference) (DLN) operates as a free and competitive market where solvers [fulfill](order-fulfillment/) cross-chain orders if doing so is profitable. Solvers are responsible for covering the order execution costs (gas fees). These costs include transferring the bridged assets to the beneficiary on the destination chain, as well as the fees required to claim the assets that were initially bridged by the user on the source chain. These combined expenses constitute the [operating expenses](../fee-structure.md) for solvers.

{% hint style="success" %}
Although DLN enables the bridging of arbitrary liquid assets across supported networks, settlement between chains is always performed in a limited set of predefined tokens known as **reserve assets**.
{% endhint %}

To reduce operational complexity, DLN is designed such that solvers only need to maintain liquidity in a small set of reserve assets. These assets currently include:

* **ETH** on Ethereum, Arbitrum, Base, and Linea
* **wETH** on Avalanche, BNB Chain, and Polygon
* **USDC** (issued by Circle Inc.) on all DLN-supported chains

This model ensures reliable settlement and minimizes the capital management burden on solvers while still supporting a wide variety of bridged tokens. Further details about operating costs and fees are available [here](../../../the-debridge-messaging-protocol/fees-and-supported-chains.md).
