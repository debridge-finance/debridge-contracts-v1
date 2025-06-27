---
description: >-
  Describes how to configure and receive affiliate fees for both cross-chain and
  same-chain swaps. Includes platform-specific handling for EVM and Solana.
---

# Affiliate fees

### Referral Code

To enable affiliate fees, a referral code must be included in the `create-tx` [request parameters](../interacting-with-the-api/creating-an-order/api-parameters/). Further details on obtaining a referral code and its additional use-cases are available in the [Referrers ](../../../debridge-points/referrers-overview.md)and [Integrators Overview](../../../debridge-points/integrators-overview.md) sections.

### Affiliate Fees

Affiliate fees can be earned through both cross-chain and same-chain swaps by including the appropriate parameters in the request. This allows integrators to monetize swap activity within their applications.

### Cross-Chain Affiliate Fees <a href="#cross-chain-affiliate-fees" id="cross-chain-affiliate-fees"></a>

To enable affiliate fees for cross-chain swaps, the following [parameters](../interacting-with-the-api/creating-an-order/api-parameters/#affiliate-fee-parameters) must be included when creating an order:

* **`affiliateFeePercent`**: The percentage of the _order input amount_ allocated as the affiliate fee.
* **`affiliateFeeRecipient`**: The address or public key of the affiliate fee beneficiary. This must be:
  * A public key on **Solana**
  * A wallet address on **EVM chains**

Affiliate fees become available once an order reaches the `ClaimedUnlock` [state](../interacting-with-the-api/monitoring-orders/order-states.md).&#x20;

* On **EVM chains**, the affiliate fee is [automatically transferred to the specified recipient when a solver claims the order](../under-the-hood/order-fulfillment/claiming-the-order.md)
* On **Solana**, the fee must be withdrawn manually. Further details on withdrawing affiliate fees are provided [here](withdrawing-affiliate-fees.md).

### Same-Chain Affiliate Fees <a href="#single-chain-affiliate-fees" id="single-chain-affiliate-fees"></a>

The deBridge Widget also supports affiliate fee collection for same-chain swaps. These swaps use the same `affiliateFeePercent` and `affiliateFeeRecipient` [parameters](../interacting-with-the-api/creating-an-order/api-parameters/#affiliate-fee-parameters), with **Solana** requiring additional configuration.

#### Solana

For same-chain swaps on Solana:

* The `affiliateFeeRecipient` must be a **Jupiter referral key**.
* Referral keys can be generated at [https://referral.jup.ag/dashboard](https://referral.jup.ag/dashboard).
* Earned fees can be claimed via the [Jupiter Referral Dashboard](https://referral.jup.ag/dashboard).
