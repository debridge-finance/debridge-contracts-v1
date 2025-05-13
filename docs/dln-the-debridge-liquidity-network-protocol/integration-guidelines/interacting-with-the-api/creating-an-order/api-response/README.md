---
description: Detailed descriptions of the `create-tx` API response structure.
---

# API Response

There are several sections to a `create-tx` response. You can see a full, real-world API response example [here](./). They are:

* `estimation` contains gas and fee-related estimates used in the transaction planning process.

<details>

<summary><code>srcChainTokenIn</code></summary>

This response field is always present. Represents the structure of what the user wants to sell on the source chain.

<table><thead><tr><th width="293">Field name</th><th width="107">Type</th><th>Description</th></tr></thead><tbody><tr><td>address </td><td>string</td><td>Source chain input asset address - what the user is trying to sell on the source chain.</td></tr><tr><td>chainId </td><td>integer</td><td>Source <a href="../../../../fees-and-supported-chains.md">chain id</a>.</td></tr><tr><td>decimals </td><td>integer</td><td>Source chain input asset decimals. </td></tr><tr><td>name </td><td>string</td><td>Source chain input asset name.</td></tr><tr><td>symbol </td><td>string</td><td>Source chain input asset symbol.</td></tr><tr><td>amount </td><td>string</td><td><p>Source chain input asset amount, taking the decimals into account.</p><p></p><p>It will be different from the <code>srcChainTokenInAmount</code> if the request had <a href="../api-parameters/prependoperatingexpenses.md">prepended operating expenses</a>. If it had, this will be the amount to use in the <code>approve</code> call.</p></td></tr><tr><td>approximateOperatingExpense </td><td>string</td><td>Solver's <a href="../fees-and-operating-expenses.md">operating expense </a>for this swap.</td></tr><tr><td>mutatedWithOperatingExpense </td><td>boolean</td><td>Signifies if the request had <a href="../api-parameters/prependoperatingexpenses.md">prepended operating expenses</a>.</td></tr><tr><td>approximateUsdValue </td><td>integer</td><td>Approximate USD value of the source chain input assets. Informative purposes only - not for real-time trading.</td></tr><tr><td>originApproximateUsdValue</td><td>integer</td><td>Approximate USD value of the source chain input assets. Informative purposes only - not for real-time trading. </td></tr></tbody></table>

</details>

<details>

<summary><code>srcChainTokenOut</code> </summary>

This response field is only present if the source chain input assets were not [reserve assets](../reserve-assets.md).

<table><thead><tr><th width="293">Field name</th><th width="107">Type</th><th>Description</th></tr></thead><tbody><tr><td>address </td><td>string</td><td><p>Source chain output asset address - what the source chain input asset was swapped for in the <a href="../bridging-non-reserve-assets.md">pre-swap</a>.</p><p></p><p>This asset will be used for cross-chain settlement, and what the solver fulfilling the order will receive. This is also the asset that the user will receive if the order is <a href="../../cancelling-the-order.md">cancelled</a>.</p></td></tr><tr><td>chainId </td><td>integer</td><td>Source <a href="../../../../fees-and-supported-chains.md">chain id</a>.</td></tr><tr><td>decimals </td><td>integer</td><td>Source chain output asset decimals. </td></tr><tr><td>name </td><td>string</td><td>Source chain output asset name.</td></tr><tr><td>symbol </td><td>string</td><td>Source chain output asset symbol.</td></tr><tr><td>amount </td><td>string</td><td>Source chain output asset amount, taking the decimals into account.</td></tr><tr><td>maxRefundAmount</td><td>string</td><td>Solver's <a href="../fees-and-operating-expenses.md">operating expense </a>for this swap.</td></tr><tr><td>approximateUsdValue </td><td>integer</td><td>Approximate USD value of the input assets. Informative purposes only - not for real-time trading.</td></tr></tbody></table>

</details>

<details>

<summary><code>dstChainTokenOut</code></summary>

This response field is always present. Represents the structure of what the user wants to buy on the destination chain.

<table><thead><tr><th width="293">Field name</th><th width="107">Type</th><th>Description</th></tr></thead><tbody><tr><td>address </td><td>string</td><td>Destination chain output asset address - what the user wants to receive when the order is fulfilled.</td></tr><tr><td>chainId </td><td>integer</td><td>Destination <a href="../../../../fees-and-supported-chains.md">chain id</a>.</td></tr><tr><td>decimals </td><td>integer</td><td>Destination chain output asset decimals. </td></tr><tr><td>name </td><td>string</td><td>Destination chain output asset name.</td></tr><tr><td>symbol </td><td>string</td><td>Destination chain output asset symbol.</td></tr><tr><td>amount </td><td>string</td><td>Destination chain output asset amount, taking the decimals into account.</td></tr><tr><td>recommendedAmount</td><td>string</td><td>Destination chain output asset amount, taking the decimals into account.</td></tr><tr><td>approximateUsdValue</td><td>integer</td><td></td></tr><tr><td>recommendedApproximateUsdValue</td><td>integer</td><td></td></tr></tbody></table>

</details>

<details>

<summary><code>costDetails</code></summary>

An array describing the cost components associated with the trade. Possible entry types include:&#x20;

* `PreSwap`&#x20;
* `PreSwapEstimatedSlippage`&#x20;
* `DlnProtocolFee`
* `TakerMargin`
* `EstimatedOperatingExpenses`
* `AfterSwap`
* `AfterSwapEstimatedSlippage`

</details>

* `tx`
  * `data` is the data that must be signed and submitted. It contains all necessary information to initiate a [cross-chain order](../bridging-reserve-assets.md), including cases involving [non-reserve assets](../bridging-non-reserve-assets.md).  It is either a calldata (for EVM-based chains) or a serialized transaction (for Solana)
  * `to` is a destination address for the transaction. Acts as the spender in the `approve` call for ERC-20 tokens. **Applicable to EVM source chains only.**&#x20;
  * `value` is a [flat fee](../../../../fees-and-supported-chains.md) in the source chain's native currency charged by the [DLN](broken-reference) protocol. **Applicable to EVM source chains only.**
* `prependedOperatingExpenseCost` is the estimated operating cost added to the transaction, adjusted for token decimals. Present only if the request was made with `prependOperatingExpenses` [enabled](../api-parameters/prependoperatingexpenses.md). &#x20;
* `order` is an object containing details required to facilitate the cross-chain trade.
  * `approximateFulfillmentDelay`
    * &#x20;Estimated delay, in seconds, for the order to be fulfilled.
  * `salt`&#x20;
    * Randomized value used to ensure uniqueness in the order hash.
  * `metadata`&#x20;
    * Additional contextual information about the order.
* `orderId`
  * A deterministic identifier for the order. The same ID is used on both source and destination chains and can be used to [track order status](../../tracking-order-status/#by-order-id).
* `fixFee`&#x20;
  * [Flat fee](../../../../fees-and-supported-chains.md) charged in the source chain's native currency. This matches `tx.value` for EVM-based chains.&#x20;
* `userPoints`
  * The number of [deBridge points ](broken-reference)that the user will get for this trade.
* `integratorPoints`&#x20;
  * The number of [deBridge points](broken-reference) that the integrator will get for this trade.
