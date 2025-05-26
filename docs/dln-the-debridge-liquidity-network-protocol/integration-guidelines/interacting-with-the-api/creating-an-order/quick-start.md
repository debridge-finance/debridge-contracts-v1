# Quick Start

Disclaimer

The provided code is available as-is, with no assurances of functionality. We are not liable for any damages that may result from its execution.

#### Overview

[This repository ](https://github.com/debridge-finance/api-integrator-example)serves as a practical resource for integrators aiming to get started with hands-on examples of using the [DeBridge Liqudity Network](broken-reference) protocol via API.

{% hint style="success" %}
More details on submitting chain-specific orders can be found [here](../submitting-an-order-creation-transaction.md).
{% endhint %}

### EVM

[Included ](https://github.com/debridge-finance/api-integrator-example/blob/master/src/scripts/orders/example-swap.ts)is a comprehensive TypeScript script demonstrating the transfer of 0.1 USDC from Polygon to Arbitrum. The script outlines all necessary steps for completing a cross-chain swap between the two networks. It also includes examples for executing the `approve` function on ERC-20 tokens and showcases various deBridge API integrations.

### Solana

There are also examples of [creating an order from Polygon (EVM) to Solana](https://github.com/debridge-finance/api-integrator-example/blob/master/src/scripts/orders/poly-usdc-to-sol.ts) and from [Solana to Polygon (EVM)](https://github.com/debridge-finance/api-integrator-example/blob/master/src/scripts/orders/sol-usdc-to-poly.ts), along with submitting a versioned transaction.&#x20;
