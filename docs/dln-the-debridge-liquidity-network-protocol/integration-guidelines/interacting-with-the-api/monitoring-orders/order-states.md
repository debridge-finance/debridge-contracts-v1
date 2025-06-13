---
description: Order states explained. Order lifecycle state-machine diagram.
---

# Order States

In the figure below, the order states are represented in a state-machine diagram, with the actions that trigger each state transition.&#x20;

<figure><img src="../../../../.gitbook/assets/image (14).png" alt=""><figcaption><p>Order states, state-machine diagram</p></figcaption></figure>

According to the DLN API, an order must be in one of these states:

<table><thead><tr><th width="197">State</th><th>Description</th></tr></thead><tbody><tr><td><code>Created</code></td><td>An order placed by a user on the DLN is pending fulfillment.</td></tr><tr><td><code>Fulfilled</code></td><td>The order on the destination chain has been completed by a solver. The full amount of the requested assets has been successfully transferred to the <code>dstChainTokenOutRecipient</code></td></tr><tr><td><code>SentUnlock</code></td><td>After fulfilling the order, the solver initiates the <strong>unlock</strong> procedure on the destination chain. A cross-chain message is sent via <a href="broken-reference">DMP </a>to unlock the <a href="../../under-the-hood/bridging-non-reserve-assets.md">input assets locked on the source chain</a>.</td></tr><tr><td><code>ClaimedUnlock</code></td><td>The unlock process is finalized, and the solver receives the <a href="../../under-the-hood/bridging-non-reserve-assets.md">input assets</a>. The affiliate fee is directed to the <code>affiliateFeeRecipient</code> on the source chain. </td></tr><tr><td><code>OrderCancelled</code></td><td>The <code>dstChainOrderAuthorityAddress</code> has started the cancellation process on the destination chain. </td></tr><tr><td><code>SentOrderCancel</code></td><td>A cross-chain message is sent via <a href="broken-reference">DMP</a> from the destination to the source chain. It unlocks the <a href="../../under-the-hood/bridging-non-reserve-assets.md">input assets</a> on the source chain to be claimed by the <code>srcAllowedCancelBeneficiary</code>.</td></tr><tr><td><code>ClaimedOrderCancel</code></td><td>The source chain <a href="../../under-the-hood/bridging-non-reserve-assets.md">input assets</a> have been claimed by the <code>srcAllowedCancelBeneficiary</code>. The cancel procedure is finalized.</td></tr></tbody></table>

{% hint style="success" %}
If an order is either in `Fulfilled`, `SentUnlock`, or `ClaimedUnlock` states, it can be displayed as fulfilled for the end-user.
{% endhint %}
