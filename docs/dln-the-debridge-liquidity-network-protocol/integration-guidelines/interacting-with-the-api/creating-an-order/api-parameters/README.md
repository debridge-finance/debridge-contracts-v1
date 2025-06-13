# API Parameters

`0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`Below is a succinct breakdown of the parameters used in the `create-tx` API endpoint. Detailed descriptions and usage examples are provided in dedicated subpages.

## Directional Parameters

These parameters define the origin and destination of the transaction, including the assets being sold on the source chain and the assets being purchased on the destination chain.

<table><thead><tr><th width="260">Parameter</th><th width="210">Example value</th><th>Description</th></tr></thead><tbody><tr><td><code>srcChainId</code></td><td><code>56</code></td><td>The internal <code>chainId</code> of the <a href="../../../../fees-and-supported-chains.md">supported source chain</a>. </td></tr><tr><td><code>srcChainTokenIn</code></td><td><code>0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d</code></td><td>Input asset address (what the user sells)</td></tr><tr><td><code>dstChainId</code></td><td><code>43114</code></td><td>The internal <code>chainId</code> of the <a href="../../../../fees-and-supported-chains.md">supported destination chain</a>.</td></tr><tr><td><code>dstChainTokenOut</code></td><td><code>0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7</code></td><td>Output asset address (what the user buys)</td></tr></tbody></table>

## Offer Parameters

These parameters specify the amounts of tokens to be sold and received. The API can also be configured to automatically determine the output amount to ensure a reasonably profitable market order.

<table><thead><tr><th width="260">Parameter</th><th width="210">Example value</th><th>Description</th></tr></thead><tbody><tr><td><code>srcChainTokenInAmount</code></td><td><p><code>100000000000000000000</code> </p><p> or</p><p><code>auto</code> </p></td><td>The amount of input token the user is selling, with decimals. It can be set to <code>auto</code> as well, but make sure to set the amount of output token in that case.</td></tr><tr><td><code>dstChainTokenOutAmount</code></td><td><p><code>auto</code> </p><p>or</p><p><code>100000000000000000000</code> </p></td><td>The amount of output token the user is buying. It is recommended to let the API calculate the reasonable outcome by setting this parameter to <code>auto</code>, otherwise you are risking the created order being ignored by solvers and stuck until <a href="../../cancelling-the-order.md">cancelled</a>.</td></tr><tr><td><code>prependOperatingExpense</code></td><td><code>true</code></td><td><a href="prependoperatingexpenses.md">Recommended</a> for better user experience. Moves the calculated amount of <a href="../../../fees-and-operating-expenses.md">operating expenses</a> out of the spread and adds it on top the amount of input token.</td></tr></tbody></table>

## Authorities and recipient address

These **optional** parameters define which entities are authorized to [cancel ](../../cancelling-the-order.md)or modify the order, as well as the recipient of the funds upon fulfillment. Typically, user wallet addresses are used.

These parameters are optional, making it possible to use the `create-tx` endpoint even before a wallet address is available—e.g., before a user connects a wallet in a dApp. However, in such cases, the API will not return a transaction payload that can be signed and submitted to the blockchain.

{% hint style="warning" %}
Ensure that the address specified for `dstChainOrderAuthorityAddress` is accessible to the user. Otherwise, the order and its associated funds may become permanently inaccessible if the user cannot [cancel ](../../cancelling-the-order.md)it.
{% endhint %}



<table><thead><tr><th width="265">Parameter</th><th width="200">Example value</th><th>Description</th></tr></thead><tbody><tr><td><code>srcChainOrderAuthorityAddress</code></td><td><code>0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045</code></td><td>Authorized to patch the order after it is created on source chain. Also receive the funds if the <a href="../../cancelling-the-order.md">order is cancelled</a>. Usually the user's address.</td></tr><tr><td><code>dstChainOrderAuthorityAddress</code></td><td><code>0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045</code></td><td>Authorized to patch the order on the destination chain and cancel the order. Usually the user's address.</td></tr><tr><td><code>dstChainTokenOutRecipient</code></td><td><code>0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045</code></td><td>Destination chain beneficiary address - receives the funds after the order is fulfilled. Usually the user's address.</td></tr></tbody></table>

## Affiliate Fee parameters

Affiliate fee-related settings can be included to specify a percentage of the trade value and the recipient address. More details are available [here](../../../affiliate-fees/).

<table><thead><tr><th width="261">Parameter</th><th width="261">Example value</th><th>Description</th></tr></thead><tbody><tr><td><code>affiliateFeePercent</code></td><td><code>0.1</code></td><td>Input asset amount percentage to cut off in favor of the affiliate fee recipient during order creation.</td></tr><tr><td><code>affiliateFeeRecipient</code></td><td><code>0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045</code> or <code>862oLANNqhdXyUCwLJPBqUHrScrqNR4yoGWGTxjZftKs</code></td><td>Source chain address (EVM) or public key (Solana) where the accrued affiliate fees will be transferred when the order reaches <code>ClaimUnlocked</code> <a href="../../monitoring-orders/order-states.md">state</a>.</td></tr></tbody></table>

## Referral Code

An optional referral code can be included for tracking and rewards. More details are available [here](../../../../../debridge-points/integrators-overview.md).

<table><thead><tr><th width="265">Parameter</th><th width="200">Example value</th><th>Description</th></tr></thead><tbody><tr><td><code>referralCode</code></td><td><code>31805</code></td><td>Integrator's referral code. You can generate it <a href="https://app.debridge.finance/refer">here</a>. </td></tr></tbody></table>

## Example Request

The following is a sample call to the `create-tx` endpoint, which generates a JSON-formatted response containing all required fields:

> [https://dln.debridge.finance/v1.0/dln/order/create-tx?srcChainId=56\&srcChainTokenIn=0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d\&srcChainTokenInAmount=100000000000000000000\&dstChainId=43114\&dstChainTokenOut=0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7\&dstChainTokenOutAmount=auto\&dstChainTokenOutRecipient=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045\&srcChainOrderAuthorityAddress=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045\&dstChainOrderAuthorityAddress=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045\&affiliateFeePercent=0.1\&affiliateFeeRecipient=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045](https://dln.debridge.finance/v1.0/dln/order/create-tx?srcChainId=56\&srcChainTokenIn=0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d\&srcChainTokenInAmount=100000000000000000000\&dstChainId=43114\&dstChainTokenOut=0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7\&dstChainTokenOutAmount=auto\&dstChainTokenOutRecipient=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045\&srcChainOrderAuthorityAddress=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045\&dstChainOrderAuthorityAddress=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045\&affiliateFeePercent=0.1\&affiliateFeeRecipient=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045)

This request demonstrates how all core parameters are combined to generate a valid and executable cross-chain order.
