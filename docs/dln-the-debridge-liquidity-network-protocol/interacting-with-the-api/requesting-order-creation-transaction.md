# Requesting Order Creation Transaction

Placing a trade on the deBridge Liquidity Network (DLN) actually means submitting a data struct to the DLN smart contract on the source chain. The data struct must represent the order, including but not limited to: the give and take offers, recipient, order authorities, and other variables.

There is a [`/v1.0/dln/order/create-tx`](https://api.dln.trade/v1.0/#/DLN/DlnOrderControllerV10\_createOrder) endpoint for that, which takes all the parameters provided to the quote, the give and take parts of the quote, plus several more parameters describing the sender, recipient, and order authorities.

To form the trade and get tx data to be signed, prepare the following parameters:

| Parameter                       | Value                   | Description                                                                                                                                                 |
| ------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `srcChainTokenInAmount`         | `100760488000000000000` | the input amount the user is willing to sell. Mind that this is a value modified by the quote endpoint and includes operating expenses.                     |
| `dstChainTokenOutAmount`        | `99727937`              | the recommended amount of output token. This value should be taken from quote response (see the `estimation.dstChainTokenOut.recommendedAmount` property)   |
| `srcChainOrderAuthorityAddress` | `0x...`                 | the address (usually, a user wallet's address) on the source chain who is is authorised to patch the order and receive funds back during order cancellation |
| `dstChainTokenOutRecipient`     | `0x...`                 | the address on the destination chain the `dstChainTokenOutAmount` of the output token should be transferred to upon successful order fulfillment            |
| `dstChainOrderAuthorityAddress` | `0x...`                 | the address (usually, a user wallet's address) on the destination chain who is authorised to patch and cancel the order                                     |
| `affiliateFeeRecipient`         | `0x...`                 | the address on the source chain where the accrued affiliate fee would be transferred to after the order is being fulfilled and unlocked                     |

Let's call the `/v1.0/dln/order/create-tx` endpoint with all these parameter values mentioned above:

> `https://api.dln.trade/v1.0/dln/order/create-tx?srcChainId=56&srcChainTokenIn=0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d&srcChainTokenInAmount=100722632000000000000&dstChainId=43114&dstChainTokenOut=0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7&dstChainTokenOutAmount=99623050&dstChainTokenOutRecipient=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&srcChainOrderAuthorityAddress=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&dstChainOrderAuthorityAddress=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&affiliateFeePercent=0.1&affiliateFeeRecipient=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`

{% hint style="warning" %}
Keep in mind to set`srcChainOrderAuthorityAddress` and `dstChainOrderAuthorityAddress`to the addresses, a user has access to. Otherwise, the order has the risk of being stuck forever or the funds being sent to the wrong address during the [canceling procedure](broken-reference) (if that happens).
{% endhint %}

The result of this request contains two objects. The `estimation` object which values can vary between different RPC requests, as the prices of crypto assets are highly volatile. It's important to check that the recommended amount hasn't changed much between the moment /create-tx was called to reflect the outcome of the trade to the user and the moment the user accepts the price and confirms the trade.

If you specify `dstChainTokenOutAmount` instead of using `auto`, and have a goal to send a market order, it's important to ensure that the recommended amount of take token has not changed too much. E.g. the response below indicates that the recommended amount has decreased by 1.5 bps (0.015%), which is acceptable:

{% hint style="info" %}
Having a large decrease in the recommended amount can indicate that the order won't be profitable and there won't be anyone willing to fulfill it. This would mean that a user would need to either wait indefinitely until the market conditions get better, or manually [cancel an order](cancelling-the-order.md) by submitting a separate transaction on the destination chain.
{% endhint %}

{% hint style="warning" %}
**Important considerations**

* It is advised to **expire the quote after 30 seconds** since it has been retrieved from the API
* It is advised to **expire the order creation transaction after 30 seconds** since it has been retrieved from the API
* For market orders, it is advised to refresh the quote if the recommended amount has changed significantly and use the recommended amount returned by /create-tx endpoint
{% endhint %}



### EVM Chains

The `tx` object has the following structure and is ready to be signed and broadcasted:

```
{
    "estimation": { ... }
    
    "tx": {
        "data": "0xfbe16ca70000000000000000000000000000000[...truncated...]",
        "to": "0xeF4fB24aD0916217251F553c0596F8Edc630EB66",
        "value": "5000000000000000"
    },
}
```

If the refreshed estimation and the transaction look fine, it's time to submit a transaction to the source blockchain.

#### Solana <a href="#solana" id="solana"></a>

For DLN trades coming from Solana the `tx` object has only one field `data`: it's hex-encoded [VersionedTransaction](https://docs.solana.com/developing/versioned-transactions)

```
{
    "estimation": { ... }
    
    "tx": {
        "data": "0x010000000000000000000000000000000000000[...truncated...]",
    },
}
```
