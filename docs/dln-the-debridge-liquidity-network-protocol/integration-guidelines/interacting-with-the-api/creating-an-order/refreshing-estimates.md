# Refreshing Estimates

It is recommended that transactions returned by the `create-tx` API be signed and submitted within 30 seconds. When `response.tx` is submitted within this window, the likelihood of successful order execution exceeds 99.9%.

There is no explicit time-to-live (TTL) on the transaction itself—that is, the period between receiving the `create-tx` API [response](api-response/) and submitting it on-chain. Transactions may remain valid for extended periods, especially when no [pre-order-swap](../../under-the-hood/bridging-non-reserve-assets.md) is involved or when the [pre-order-swap](../../under-the-hood/bridging-non-reserve-assets.md) is between stablecoins.

## Handling Operating Expense Fluctuations&#x20;

When the `prependOperatingExpenses` [parameter](api-parameters/) is enabled, special attention must be paid to how token approval amounts are set. If the allowance exactly matches `response.estimation.srcChainTokenIn.amount` and there is a delay—typically more than a minute—before submitting `response.tx`, operating expenses may increase. In this case, the estimate should be refreshed. If the updated expense exceeds the approved amount, an additional approval step is required, degrading the experience.

{% hint style="success" %}
To prevent this, it is recommended to set the token allowance to infinity. When a finite allowance is required, it is advisable to include a buffer—commonly around 30%—to absorb any increase in gas costs or execution fees between approval and submission.
{% endhint %}

```
const { approximateOperatingExpense } = response.estimation.srcChainTokenIn;
const approveAmount = srcChainTokenInAmount + approximateOperatingExpense * 1.3;
```

This ensures that the approved amount remains sufficient, even if costs rise slightly before the transaction is broadcast.

You can see the code examples [here](https://github.com/debridge-finance/api-integrator-example/tree/master/src/scripts/orders).
