---
description: >-
  A deeper look at DLN’s internal mechanics, covering order flows, solver
  behavior, and asset handling to support advanced integrations and edge-case
  transparency.
---

# Under the Hood

The deBridge Liquidity Network (DLN) is designed to abstract away the complexity of cross-chain swaps for users and integrators. However, understanding the protocol's internal mechanics is essential for implementing robust, production-grade integrations—especially in advanced use cases or when troubleshooting edge behavior.

This section provides a deeper look at the underlying architecture and processes that power DLN. It covers how orders are created, settled, and fulfilled; how solvers operate; and how asset behavior differs depending on whether reserve or non-reserve tokens are used.

### What This Section Covers

The pages within this section explain foundational DLN concepts that may not be required for basic integration, but are highly relevant for understanding:

* Reserve assets
* Order cancellation
* How solvers evaluate and fulfill orders
* General order creation flow

Whether building a high-volume integration or customizing edge cases, these pages offer insight into how DLN works under the surface.

{% hint style="warning" %}
This section focuses on conceptual understanding. For implementation specifics, refer to the API Reference or Integration Guides.
{% endhint %}
