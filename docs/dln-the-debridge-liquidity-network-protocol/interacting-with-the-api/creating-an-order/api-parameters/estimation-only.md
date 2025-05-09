# Estimation-Only

The `create-tx` endpoint is designed for both estimation and transaction construction. It can be safely called without specifying [authority or recipient addresses](./#authorities-and-recipient-address) when a wallet address is not yet available—for example, during early stages of interaction in a dApp. In such cases, the endpoint can still be used to suggest input or output token amounts.

Once the wallet address becomes available, the same `create-tx` request can be repeated with [the necessary parameters to retrieve a full transaction call](./#authorities-and-recipient-address).

To maintain solver profitability and ensure the order remains valid upon submission, it is recommended to allow the API to compute a reasonable output amount. This is achieved by setting the `dstChainTokenOutAmount` parameter to `auto` in both the estimation and transaction calls.

{% hint style="warning" %}
Additionally, orders should be submitted within 30 seconds of retrieving the transaction from the API. This expiration window helps ensure the order remains profitable for solvers at the time of on-chain placement.
{% endhint %}
