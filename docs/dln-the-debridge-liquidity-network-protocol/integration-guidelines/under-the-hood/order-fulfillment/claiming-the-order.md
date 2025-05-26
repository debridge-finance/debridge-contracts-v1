# Claiming the Order

After the cross-chain message is sent to the source chain via the underlying DeBridge Messaging Protocol ([DMP](broken-reference)), the [order status](../../interacting-with-the-api/tracking-order-status/order-states.md) on the source chain is updated to `SentUnlock`. This step is highlighted with a green background in the diagram below.

<figure><img src="../../../../.gitbook/assets/Solvers-steps-3.drawio (1).png" alt=""><figcaption><p>Solver's steps - Claiming the Order</p></figcaption></figure>

To finalize the process, the solver calls the `claimUnlock(...)` method on the `DlnSource` contract deployed on the source chain. This updates the [order status ](../../interacting-with-the-api/tracking-order-status/order-states.md)to `ClaimedUnlock`, and the [initially locked order input reserve assets](../bridging-reserve-assets.md) are transferred to the solver. At this point, the order is considered fully fulfilled.
