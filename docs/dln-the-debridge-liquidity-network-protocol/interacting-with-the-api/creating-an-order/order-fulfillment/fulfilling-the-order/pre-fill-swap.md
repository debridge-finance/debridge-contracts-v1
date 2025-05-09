# Pre-Fill-Swap

Solvers exclusively hold [reserve assets](../../reserve-assets.md) to simplify accounting and minimize risk exposure. The green-highlighted section in the diagram below illustrates the **Pre-Fill-Swap**, an intermediary step in the [order fulfillment ](../)process that occurs when the requested assets are not [reserve assets](../../reserve-assets.md).

<figure><img src="../../../../../.gitbook/assets/Solvers-steps-afterswap.drawio (1).png" alt=""><figcaption><p>Solver's steps - AfterSwap</p></figcaption></figure>

When the order requests [reserve assets](../../reserve-assets.md), this swap step is skipped, as solvers are expected to maintain sufficient balances of [reserve assets](../../reserve-assets.md) at all times.

The [DLN ](broken-reference)supports requesting arbitrary assets on the destination chain. When a requested assets are not [reserve assets](../../reserve-assets.md), the solver performs a **Pre-Fill-Swap**—similar in concept to a [Pre-Order-Swap](../../bridging-non-reserve-assets.md), but reversed. In this case, the solver swaps [reserve assets](../../reserve-assets.md) for the requested assets and transfers the guaranteed amount to the beneficiary address on the destination chain specified in the order.
