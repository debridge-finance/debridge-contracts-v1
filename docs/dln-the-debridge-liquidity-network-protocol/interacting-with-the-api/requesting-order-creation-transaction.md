# Requesting Order Creation Transaction

Placing a cross-chain order on the deBridge Liquidity Network (DLN) actually means calling the DLN smart contract on the source chain. The transaction call must provide a wide range of parameters representing the order, including but not limited to: the give and take offers, recipient address, order authorities' addresses.&#x20;

Additionally, the spread between the give offer (_how much asset the user is selling_) and the take offer (_how much asset the user is buying_) must be reasonably profitable to incentivize a solver to fulfill it. The thing is that it must not only reflect the current market exchange rate, but also include relevant fees and expenses:&#x20;

* the optional affiliate fee,
* the DLN protocol fee,&#x20;
* the taker's margin fee,
* the operating expenses that a solver would have to pay during and after order fulfillment (this includes solver's gas costs for filling an order on the destination chain, and for claiming order fulfillment on the source chain).

Preparing such a wide range of different variables could be a very sophisticated thing, which the API's  [`create-tx`](https://dln.debridge.finance/v1.0#/DLN/DlnOrderControllerV10\_createOrder) endpoint takes off the developers.&#x20;

The endpoint accepts several groups of parameters explained below.

### Directional parameters

This group of parameters explain the source and destination chain and tokens: the input asset a user is selling on the source chain, and the output asset a user is buying on the destination chain.

<table><thead><tr><th width="258">Parameter</th><th width="193">Example value</th><th>Description</th></tr></thead><tbody><tr><td><code>srcChainId</code></td><td><code>56</code></td><td>The internal <code>chainId</code> of the source chain. More info: <a data-mention href="../fees-and-supported-chains.md">fees-and-supported-chains.md</a></td></tr><tr><td><code>srcChainTokenIn</code></td><td><code>0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d</code></td><td>The address of the input token (a token a user is selling)</td></tr><tr><td><code>dstChainId</code></td><td><code>43114</code></td><td>The internal <code>chainId</code> of the destination chain. More info: <a data-mention href="../fees-and-supported-chains.md">fees-and-supported-chains.md</a></td></tr><tr><td><code>dstChainTokenOut</code></td><td><code>0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7</code></td><td>The address of the output token (a token a user is buying)</td></tr></tbody></table>

### Offer parameters

This group of parameters specify the selling and buying amounts, and how the API calculates a reasonably profitable market order.&#x20;

<table><thead><tr><th width="258">Parameter</th><th width="195">Example value</th><th>Description</th></tr></thead><tbody><tr><td><code>srcChainTokenInAmount</code></td><td><code>100000000000000000000</code> or <code>auto</code></td><td>The amount of input token the user is selling, with decimals. It can be set to <code>auto</code> as well (in this case, make  sure to set the amount of output token)</td></tr><tr><td><code>dstChainTokenOutAmount</code></td><td><code>auto</code></td><td>The amount of output token the user is buying. It is recommended to let the API calculate the reasonable outcome automatically by setting this parameter to <code>auto</code>, otherwise you are imposing a risk of an order being ignored by solvers and stuck until being <a href="cancelling-the-order.md">cancelled</a></td></tr><tr><td><code>prependOperatingExpense</code></td><td><code>true</code></td><td>Recommended. Moves the calculated amount of operating expenses (see above) out of the spread and adds it on top the amount of input token.</td></tr></tbody></table>

### Authorities and recipient addresses

This group of **optional** parameters define entities who are responsible for changing order on-chain, as well as how would be the recipient of the funds upon order fulfillment. Typically, a users' wallet addresses must be used to fill them.

Mind that all of these parameters are optional to the `create-tx` endpoint, making it possible to use it even when a user's wallet address is not available (e.g., until the wallet is being connected to the dApp). However, in this case API won't return a transaction call that can be signed and submitted to the blockchain.

{% hint style="warning" %}
Ensure that the address specified as the `dstChainOrderAuthorityAddress` parameter is accessible by the user. Otherwise, there is a  risk of an order (and funds) being stuck forever due to inability to initiate [an order cancellation procedure](cancelling-the-order.md).
{% endhint %}

<table><thead><tr><th width="257">Parameter</th><th width="199">Example value</th><th>Description</th></tr></thead><tbody><tr><td> <code>srcChainOrderAuthorityAddress</code></td><td><code>0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045</code></td><td>the address (usually, a user wallet's address) on the source chain who is authorised to patch the order and receive funds back during order cancellation</td></tr><tr><td>️ <code>dstChainOrderAuthorityAddress</code></td><td><code>0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045</code></td><td>the address (usually, a user wallet's address) on the destination chain who is authorised to patch and cancel the order</td></tr><tr><td>️ <code>dstChainTokenOutRecipient</code></td><td><code>0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045</code></td><td>the address on the destination chain where the bought amount of output asset would get transferred to upon order fulfillment</td></tr></tbody></table>

### Affiliate fee parameters

<table><thead><tr><th width="258">Parameter</th><th width="199">Value</th><th>Description</th></tr></thead><tbody><tr><td><code>affiliateFeePercent</code></td><td><code>0.1</code></td><td>Percent of the input token amount to cut off in favor of the given affiliate fee recipient during order creation.</td></tr><tr><td><code>affiliateFeeRecipient</code></td><td><code>0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045</code></td><td>the address on the source chain where the accrued affiliate fee would be transferred to after the order is being fulfilled and unlocked</td></tr></tbody></table>

***

Compiling it all together, a call to the `create-tx` endpoint produces a JSON-formatted response with several properties. Here is the example request:

> `https://dln.debridge.finance/v1.0/dln/order/create-tx?srcChainId=56&srcChainTokenIn=0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d&srcChainTokenInAmount=100000000000000000000&dstChainId=43114&dstChainTokenOut=0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7&dstChainTokenOutAmount=auto&dstChainTokenOutRecipient=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&srcChainOrderAuthorityAddress=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&dstChainOrderAuthorityAddress=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&affiliateFeePercent=0.1&affiliateFeeRecipient=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`

Notable response fields:

* `estimation`  field gives an in-depth explanation on how the API has calculated the amount of input and output tokens of an order.
* `tx` field contains the transaction call that has to be signed and submitted by a user. This field is only available if all authorities and recipient addresses were [specified](requesting-order-creation-transaction.md#authorities-and-recipient-addresses) upon request.&#x20;
* `orderId` field contains the deterministic ID of the order that would get placed when the transaction call gets included on the blockchain
* `order.approximateFulfillmentDelay` is the approximate time (in seconds) the order would get filled after the transaction call gets included on the blockchain

### Important considerations

The `create-tx` endpoint is intended to be used for both estimation and transaction construction: safely use it without [authorities and recipient addresses](requesting-order-creation-transaction.md#authorities-and-recipient-addresses) when user's wallet address is not available but the amount of input or output token should be suggested to a user; once addresses are available and [specified](requesting-order-creation-transaction.md#authorities-and-recipient-addresses), the same request should be used to retrieve a transaction call.

It is advised to let the API calculate the reasonable outcome automatically by setting `dstChainTokenOutAmount` parameter to `auto` on both calls. This ensures the order remain profitable for solvers after it gets placed on the blockchain.

{% hint style="warning" %}
It is advised to **expire the order creation transaction after 30 seconds** since it has been retrieved from the API to ensure the order remain profitable for solvers after it gets placed the blockchain.
{% endhint %}
