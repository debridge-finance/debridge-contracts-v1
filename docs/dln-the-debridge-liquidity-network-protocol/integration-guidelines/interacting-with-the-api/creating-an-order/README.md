# Creating an Order

The `create-tx` endpoint is intended to be used for **both** [**estimating** ](api-parameters/estimation-only.md)**and constructing order transactions**. There are detailed breakdowns of [parameters](api-parameters/) and the [response](api-response/) fields.

We do recommend reading deeper into these articles, but if you want to get up and running, have a look at the [quick start](quick-start.md) section.&#x20;

Swagger specs of `create-tx` can be found [here](https://dln.debridge.finance/v1.0#/DLN/DlnOrderControllerV10_createOrder).

## Paired Quote and Transaction

The `create-tx` ednpoint is intentionally **dual-purpose**:

* It **estimates** a realistic, market-aware outcome (`estimation`)
* It **constructs** a ready-to-sign transaction (`tx`) whenever the call includes the necessary wallet data

This design intentionally removes the distinction between “get quote” and “build transaction” that exists in typical single-chain swap APIs.

A detailed parameter reference & field-by-field response breakdown lives in the [**API Parameters**](api-parameters/), [**API Response**](api-response/), and [**Estimation-Only**](api-parameters/estimation-only.md) sub-pages, while **Swagger specs** for `create-tx` can be explored [here](https://dln.debridge.finance/v1.0). For a hands-on walk-through, see the [**Quick Start**](../../../../#quick-start) section of the docs.

### Why Quote and Transaction Are Paired

DLN works with _intent-based orders_ that traverse two independent blockchains, two swaps, and several off-chain actors (API, solvers, validators). An accurate quote must already account for:

* Source-chain liquidity and gas
* Destination-chain liquidity and gas
* A solver’s operating expenses and target margin
* Short-term market volatility during the time the order is in flight

Generating that quote is the **most computationally expensive** step; producing the transaction payload afterwards is trivial. A “lightweight quote” would be misleading and would cause orders to be ignored by solvers.

### How the \`create-tx\` Endpoint Behaves

| Scenario                                                                                     | Returned fields       | Typical use-case                       |
| -------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------- |
| <p><strong>All required fields present</strong><br>(wallet connected, amounts known)</p>     | `estimation` and `tx` | Production trade flow                  |
| <p><strong>Wallet address missing</strong><br>(connect-wallet screen, fiat on-ramp flow)</p> | `estimation` only     | Pre-trade previews, fiat on-ramp flows |

If `dstChainTokenOutRecipient`, `srcChainOrderAuthorityAddress`, or `dstChainOrderAuthorityAddress` are absent, the API withholds `tx`. [Recipient and authorities parameters ](api-parameters/#authorities-and-recipient-address)are required for creating the transaction. Replay the same call once addresses are known to receive the full response pair.

### Do **Not** Replay the Quote Into a Second Call

{% hint style="danger" %}
Passing the returned `srcChainTokenInAmount` and `dstChainTokenOutAmount` back to `create-tx` forces the endpoint into [_limit-order_ quoting strategy](quoting-strategies.md#limit-order-not-recommended) (both amounts fixed). Limit orders can drive solver profit negative, so they are typically ignored—use the original quote + transaction pair and let the user sign immediately.
{% endhint %}

Replay-and-fixing the amounts:

* Converts a healthy market order into a potentially unattractive limit order
* Slashes the fulfillment probability

Placing limit orders is fine but they can end up being unprofitable and remain unfilled. If more than \~30 seconds have passed, request a **fresh** quote-plus-transaction pair instead of re-using stale numbers. Profitable market orders are filled within seconds; unprofitable ones linger until they become profitable or the user cancels them.

### Timing Guarantees

Quotes remain solvent if the paired transaction is **signed and broadcast within \~30 seconds**. Beyond that window:

* Gas cost or price movements may exceed the solver’s margin.
* Solvers will skip the order; users must cancel and retry.

For ERC-20 flows with `prependOperatingExpenses=true`, approve a slightly higher allowance (≈ +30 %) or approve infinity to avoid a second approval if operating expenses drift upward while the user is signing.

### Example — Estimation and Full Pair

```typescript
// 1. Preview (wallet not yet connected)
const preview = await fetch(
  '/dln/order/create-tx?srcChainId=56&srcChainTokenIn=<token_in_address>&srcChainTokenInAmount=1000000&' +
  'dstChainId=43114&dstChainTokenOut=<token_out_address>&dstChainTokenOutAmount=auto'
).then(data => data.json());

// preview.estimation is present; preview.tx is undefined.

// 2. User connects wallet; replay with authority/recipient addresses
const full = await fetch(
  '/dln/order/create-tx?srcChainId=56&srcChainTokenIn=<token_in_address>&srcChainTokenInAmount=1000000&' +
  'dstChainId=43114&dstChainTokenOut=<token_out_address>&dstChainTokenOutAmount=auto&' +
  'dstChainTokenOutRecipient=<user_address>&srcChainOrderAuthorityAddress=<user_address>&' +
  'dstChainOrderAuthorityAddress=<user_address>'
).then(data => data.json());

// full.estimation and full.tx are now present.
// Sign full.tx within 30 s for >99.9 % fill probability.
```

### Key Takeaways

* **One endpoint, one response**—never separate quote retrieval from transaction generation.
* The estimate/transaction pair maximizes fulfillment probability by eliminating UI-induced latency.
* When wallet addresses are unknown, call `create-tx` for estimation only, then **repeat** once addresses are set.
* **Re-using quoted amounts in a second request reduces the likelihood of order fulfillment and should be avoided.**

Following this pattern ensures that orders hit the network with fresh spreads, remain attractive to solvers, and settle cross-chain in seconds.

