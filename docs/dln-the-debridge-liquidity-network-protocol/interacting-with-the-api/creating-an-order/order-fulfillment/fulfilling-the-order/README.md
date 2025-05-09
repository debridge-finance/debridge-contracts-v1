# Fulfilling the Order

After the `OrderCreated` event is detected, solvers enter the next stage of the process, illustrated by the green background in the diagram below.

<figure><img src="../../../../../.gitbook/assets/Solvers-steps-2.drawio (1).png" alt=""><figcaption><p>Solver's steps - Fulfilling the Order</p></figcaption></figure>

Solvers typically begin by simulating the order to evaluate its profitability. Unprofitable orders are ignored. However, if market conditions change, solvers may re-simulate previously ignored orders to reassess their viability.

Profitable orders proceed toward fulfillment. Depending on order volume and the risk-to-reward ratio, there may be a delay before the solver submits the fulfillment transaction on the destination chain. This delay is influenced by the transaction finality characteristics of both the source and destination chains. Further details are available [here](https://github.com/debridge-finance/dln-taker?tab=readme-ov-file#managing-cross-chain-riskreward-ratio).

If the requested asset on the destination chain differs from the solver's available reserve assets, a [pre-fill swap ](pre-fill-swap.md)may occur. This swap is bundled with the fulfillment transaction and executed atomically. The solver deposits the final, requested assets into the `DlnDestination` contract via a `fulfillOrder(...)` method call. This transaction delivers the requested assets to the beneficiary address specified in the original order and updates the order [status ](../../../tracking-order-status/order-states.md)to `Fulfilled`.

Each `orderId` is deterministic and uniquely identifies an order. To successfully fulfill the order, the solver must use the same parameters that were specified when the order was originally created. After successful fulfillment, the solver marks the order as `SentUnlock` and triggers a cross-chain message via the [DeBridge Messaging Protocol](broken-reference) (DMP) to the source chain. This message unlocks the input reserve assets, allowing the solver to claim them.

If any parameters—such as the token amount or beneficiary—differ from the original order, the resulting `orderId` will not match. In such cases, the solver’s deposit cannot be matched to a valid order on the source chain, rendering the fulfillment ineffective and ensuring the input funds remain locked and secure on the source chain.
