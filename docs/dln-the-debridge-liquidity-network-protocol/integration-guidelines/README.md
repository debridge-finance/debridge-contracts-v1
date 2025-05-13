# Integration Guidelines

## Integration Overview

There are several ways to integrate deBridge into your dApp, wallet, or protocol, depending on the specific use case. This section provides a high-level overview of the available integration methods: API, Widget, and Smart Contracts.

### DeBridge API

**Recommended for most production-grade integrations**\
→ [Learn more about the API](interacting-with-the-api/)

The DeBridge API is the most robust and flexible integration method, abstracting away the complexities of cross-chain trading, smart contract interactions, and blockchain infrastructure. It provides RESTful endpoints to quote, create, and manage trades throughout their lifecycle. This improves transaction success rates and user experience, while reducing engineering overhead.

**Recommended if integrators:**

* Want full control over the UX/UI
* Are building custom workflows or high-frequency trading logic
* Need integration with backend infrastructure
* Are targeting mobile-native or non-browser environments

**Use cases:**\
&#xNAN;_&#x43;oming soon: examples such as exchange aggregators, non-custodial wallets, yield platforms, etc._

### DeBridge Widget

**Best for rapid integration and prototyping**\
→ [Learn more about the Widget](./#debridge-widget)

The DeBridge Widget enables any web-based project to offer cross-chain swaps in minutes. It’s a pre-built UI component embeddable via `iframe`, fully customizable with themes, chains, tokens, and more. It also supports JavaScript-based event listeners and method calls for deeper interaction.

**Recommended if integrators:**

* Want a fast time-to-market with minimal development effort
* Don’t need custom UX or transaction logic
* Are building a frontend-heavy app, or integrating within a website or mobile WebView
* Want to prototype or test before deeper integration

**Use cases:**\
&#xNAN;_&#x43;oming soon: examples such as token swap pages, DeFi frontends, portfolio dashboards, etc._

### Smart Contract Integration (DLN Protocol)

**Best for advanced and trustless DeFi integrations**\
→ [Learn more about the DLN Protocol Smart Contracts](interacting-with-smart-contracts/)

The DeBridge Liquidity Network (DLN) Protocol enables direct interaction with on-chain smart contracts to place and fulfill cross-chain limit orders. Developers can work directly with `DlnSource` and `DlnDestination` contracts for advanced decentralized workflows. This provides maximum flexibility, trustless execution, and fine-grained control.

**Recommended if integrators:**

* Need a fully decentralized integration with no off-chain components
* Are building a protocol-level feature (e.g., DEX, bridge aggregator)
* Want to operate as a solver or liquidity provider
* Need deterministic on-chain behavior and verifiability

**Use cases:**\
&#xNAN;_&#x43;oming soon: examples such as limit order protocols, liquidity relayers, solver networks, etc._
