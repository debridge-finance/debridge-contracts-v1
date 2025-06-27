---
description: >-
  This page gathers every fee that can affect a DLN trade, explains how each one
  is calculated, and shows where to fetch the real‑time values.
---

# Fee Structure

One key reason the `create-tx` API is the recommended integration method is its ability to handle fee structure complexity. Accurately calculating each fee parameter under real-time market conditions—and balancing incentives across all stakeholders—is non-trivial. Excessive fees can deter end users, while insufficient fees may result in unfillable orders, negatively affecting both solvers and the application's success.

## Order‑Creation Fees (always paid)

When an order is placed, the protocol levies two mandatory fees:

• **Flat fee** – a fixed amount in the source‑chain native token paid to deBridge validators for processing the eventual unlock message. The current value is stored in `DlnSource.globalFixedNativeFee()`.

• **Variable protocol fee (4 bps)** – deducted from the input token. This value is set in the `percentFee` field returned by `create-tx` and is visible in the `DlnSource` contract.

Both fees are fully refunded if the order is cancelled.

## Runtime Costs (built into the spread)

Because DLN has no central liquidity pool (0-TVL model), additional costs must be baked into the order, so a solver is willing to fulfil it:

**Taker margin (≈ 4 bps)** – the solver’s profit. The API inserts it automatically when creating a [market ](interacting-with-the-api/creating-an-order/quoting-strategies.md#market-order)or a [reverse-market](interacting-with-the-api/creating-an-order/quoting-strategies.md#reverse-market-order) order. If a [limit order](interacting-with-the-api/creating-an-order/quoting-strategies.md#limit-order-not-recommended) (not recommended) is created, integrators need to make sure that the margin remains or the order may be ignored.

**Operating expenses** – the gas a solver spends on [three transactions](under-the-hood/order-fulfillment/) (fulfil, send unlock, claim). The API estimates the amount and exposes it under `estimation.costsDetails` when `prependOperatingExpenses=true`.

{% hint style="success" %}
**Recommendation** – set `prependOperatingExpenses=true` so the estimate is added on top of `srcChainTokenInAmount`. This makes the fee transparent to the user and avoids approval mismatches. More information can be found [here](interacting-with-the-api/creating-an-order/api-parameters/prependoperatingexpenses.md).
{% endhint %}

## Optional Fees

### **Affiliate fee**&#x20;

[Affiliate fee](fee-structure.md#affiliate-fee) is a share of the _input token_ sent to a beneficiary when the order hits `ClaimedUnlock`. Configure with `affiliateFeePercent` and `affiliateFeeRecipient`. Details can be found in the [**Affiliate Fees**](affiliate-fees/) article.

### **Hook execution reward**&#x20;

If a non‑atomic hook is attached to an order, `reward` parameter in [`HookDataV1` ](../protocol-specs/hook-data/)may be set. The solver receives this amount before the hook runs.

## Additional Costs

* [Pre‑Order‑Swap](under-the-hood/bridging-non-reserve-assets.md) slippage (converting a non‑reserve input asset into a reserve asset during order placement).
* [Pre‑Fill‑Swap](under-the-hood/order-fulfillment/fulfilling-the-order/pre-fill-swap.md) slippage (converting a reserve asset into the requested asset on the destination chain).
* Gas for ERC‑20 approvals.
* Quote staleness if the user signs more than \~30 s after fetching it.

Slippage can be inspected in `estimation.costsDetails` and acted upon in runtime.

## Getting Live Values

| Fee Type                 | Source                                                         |
| ------------------------ | -------------------------------------------------------------- |
| Flat fee                 | `DlnSource.globalFixedNativeFee()` or `response.tx.value`      |
| Variable fee             | `DlnSource.percentFeeBps()` or `costsDetails → DlnProtocolFee` |
| Operating expenses       | `costsDetails → EstimatedOperatingExpenses`                    |
| Recommended taker margin | `costsDetails → TakerMargin`                                   |

Always query these values at quote time; never hard‑code.

## Example

Sell **1 000 USDC** on Arbitrum, buy USDC on Polygon (auto‑quote) with `prependOperatingExpenses` set to `true` .

Flat fee: 0.001 ETH\
Variable fee: 0.04 % × 1 000 = 0.40 USDC\
Taker margin: 0.40 USDC\
Operating expenses: ≈ 0.03 USDC

The user would need to approve either an unlimited amount for the ERC-20 contract or approve the amount calculated below:

```typescript
function getEstimatedOperatingExpenseFeeAmount(response: ApiResponse)
  : string | undefined {
  return response.estimation.costsDetails.find(
    (detail) => detail.type === "EstimatedOperatingExpenses"
  ).payload.feeAmount;
}

const response: ApiResponse = /* fetch or assign your create-tx response */;
const inputAmount = Bigint("1000000000"); // 1000USDC on Polygon, 6 decimals
const operatingExpense = Bigint(getEstimatedOperatingExpenseFeeAmount(response));

// Add 30% buffer for operating expenses
const adjustedOperatingExpense = (operatingExpense * 13n) / 10n; // multiply by 1.3
const totalApproveAmount = inputAmount + adjustedOperatingExpense;
```

{% hint style="warning" %}
The reason for leaving a buffer for operating expenses is that gas prices may spike if the transaction is not signed and submitted within approximately 30 seconds of receiving the `create-tx` response. Sometimes that happens if the user is idle. To account for this, quotes should be refreshed every \~30 seconds until the transaction has been submitted on-chain.
{% endhint %}

Total expenses are: \~**0.83 USDC**.&#x20;

The user approves for **\~1000.39 USDC** on Polygon.&#x20;

The user receives \~999.2 USDC on Polygon (Variable fee and Taker margin are taken out of the input token amount) and sees 0.001 ETH leave their Arbitrum wallet. If the order cancels, everything is refunded.

## Best Practice Checklist for Integrators

1. Always call `create-tx` to create a [market order](interacting-with-the-api/creating-an-order/quoting-strategies.md#market-order) or a [reverse-market order](interacting-with-the-api/creating-an-order/quoting-strategies.md#reverse-market-order) unless intentionally placing a [limit order](interacting-with-the-api/creating-an-order/quoting-strategies.md#limit-order-not-recommended) (not recommended).
2. Enable [`prependOperatingExpenses`](interacting-with-the-api/creating-an-order/api-parameters/prependoperatingexpenses.md) .
3. Refresh the quote after 30 s if the order is not submitted.
4. Either approve an unlimited allowance for ERC-20 tokens, or include a 30% buffer over the estimated operating expenses to account for cases where the transaction is not approved and submitted within 30 seconds of receiving the `create-tx` response. This ensures that the approval remains valid even if the quote is refreshed and prevents the need for users to repeat the approval step.
5. Show the flat fee and the spread components separately in the UI.
6. Surface a warning if the solver margin drops below \~4 bps for [limit orders](interacting-with-the-api/creating-an-order/quoting-strategies.md).
