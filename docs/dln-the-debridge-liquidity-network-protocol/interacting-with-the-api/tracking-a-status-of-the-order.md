# Tracking a Status of the Order

After the transaction has been successfully included in the source blockchain, it is time to retrieve the status of an order created within the given transaction. There are several ways to track the status of the trade.

The first way is [`/filteredList`](https://stats-api.dln.trade/redoc/index.html?url=/swagger/v1/swagger.json#tag/Orders/operation/Orders\_GetOrders)[ ](https://stats-api.dln.trade/redoc/index.html?url=/swagger/v1/swagger.json#tag/Orders/operation/Orders\_GetOrders)method of dedicated `stats-api` that allows retrieving the history of all trades performed by the wallet and their statuses. Check [redoc](https://stats-api.dln.trade/redoc/index.html?url=/swagger/v1/swagger.json#tag/Orders/operation/Orders\_GetOrders) for more details. Stats-API Swagger is available at [this link](https://stats-api.dln.trade/swagger/index.html#/).

Example of trade history for address `0xB779DaeAD6031Ef189cAD4Ac438c991Efe7635A7`:

```
curl -X 'POST' \
  'https://stats-api.dln.trade/api/Orders/filteredList' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "skip": 0,
  "take": 20,
  "creator":"0xB779DaeAD6031Ef189cAD4Ac438c991Efe7635A7"
}’
```

To understand the data structure and how trade history can be reflected in your app, you can check the [DLN trade history](https://app.debridge.finance/orders) page of deExplorer which is using this endpoint to obtain data.

In case detailed information on one specific trade is needed, [`/api/Orders/creationTxHash/`](https://dln-api.debridge.finance/swagger/index.html#/Orders/Orders\_GetOrderByCreationTx) endpoint of DLN API can be used. It returns the status and all the order parameters that are reflected on the order page of deExplorer.

Example of how to retrieve DLN trade details based on orderID: [https://stats-api.dln.trade/api/Orders/creationTxHash/0x3fe11542154f53dcf3134eacb30ea5ca586c9e134c223e56bbe1893862469bc5](https://stats-api.dln.trade/api/Orders/creationTxHash/0x3fe11542154f53dcf3134eacb30ea5ca586c9e134c223e56bbe1893862469bc5) and [Link to the same order](https://app.debridge.finance/order?orderId=0x313d90a13e5f54efa3c065a98f1434c59d12ba9f4da8b224533bc56b6ed40d82) in deExplorer

If multiple DLN orders were created in the same transaction, /creationTxHash will return information about the first one only

{% hint style="info" %}
If multiple trades were created in a single transaction, there is an endpoint which returns the list of `orderId`s of the orders that were created by the given transaction: `/v1.0/dln/tx/:hash/order-ids`.
{% endhint %}

Let's say, a transaction [`0x40ee524d5bb9c4ecd8e55d23c66c5465a3f137be7ae24df366c3fd06daf7de7e`](https://bscscan.com/tx/0x40ee524d5bb9c4ecd8e55d23c66c5465a3f137be7ae24df366c3fd06daf7de7e) has been submitted to the BNB Chain. Calling the endpoint:

> [`https://stats-api.dln.trade/api/Transaction/0x40ee524d5bb9c4ecd8e55d23c66c5465a3f137be7ae24df366c3fd06daf7de7e/orderIds`](https://stats-api.dln.trade/api/Transaction/0x40ee524d5bb9c4ecd8e55d23c66c5465a3f137be7ae24df366c3fd06daf7de7e/orderIds)

gives an array with only one `orderId` within it:

```
{
    "orderIds": [
        "0x9ee6c3d0aa68a7504e619b02df7c71539d0ce10e27f593bf8604b62e51955a01"
    ]
}
```

{% hint style="info" %}
An array instead of a single `orderId` is returned because a top-level transaction may perform several calls to DLN, thus leading to multiple order creation.
{% endhint %}

After the `orderId` has been revealed, it can be used to track the order's status by orderId specifically (instead of creation txHash). Use the `GET` [`/api/Orders/{orderId}`](https://stats-api.dln.trade/swagger/index.html#/Orders/Orders\_GetOrder) endpoint supplying the given `orderId`. Calling the endpoint:

> [`https://stats-api.dln.trade/api/Orders/0x9ee6c3d0aa68a7504e619b02df7c71539d0ce10e27f593bf8604b62e51955a01`](https://stats-api.dln.trade/api/Orders/0x9ee6c3d0aa68a7504e619b02df7c71539d0ce10e27f593bf8604b62e51955a01)

gives a status for the given order:

```
{
    "status": "ClaimedUnlock"
}
```

The order may have different statuses across its lifecycle, but the most important are `Fulfilled`, `SentUnlock` and `ClaimedUnlock` — all indicating that the order has been successfully fulfilled, and a recipient has received a precise amount of the output token.

{% hint style="info" %}
If an order is in any of `Fulfilled`, `SentUnlock, or` `ClaimedUnlock` statuses, it can be displayed as fulfilled for the end-user.
{% endhint %}

The affiliate fee (if set) that has been accrued during order creation is transferred to the `affiliateFeeRecipient` when the `ClaimedUnlock` status is reached.

This is a complete set of all possible statuses that an order may have, according to the DLN API:\


| Status               | Description                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Created`            | The order has been placed on the DLN and is awaiting fulfillment.                                                                                                                                       |
| `Fulfilled`          | The order has been fulfilled. The take amount of the output token has been transferred to `dstChainTokenOutRecipient`                                                                                   |
| `SentUnlock`         | An **unlock** procedure has been initiated by the taker (who fulfilled the order) on the destination chain to unlock the give amount of the input token on the source chain, as per taker request       |
| `ClaimedUnlock`      | An unlock procedure has been completed, effectively unlocking the input funds to the taker beneficiary, and the affiliate fee to the `affiliateFeeRecipient` on the source chain                        |
| `OrderCancelled`     | A **cancel** procedure has been initiated by the `dstChainOrderAuthorityAddress` on the destination chain to unlock the given funds on the source chain, as per order's `srcChainRefundAddress` request |
| `SentOrderCancel`    | A **cancel** procedure has been sent to the source chain to unlock the given funds on the source chain, as per order's `srcChainRefundAddress` request                                                  |
| `ClaimedOrderCancel` | A cancel procedure has been completed, effectively refunding locked funds to the `srcChainRefundAddress` on the source chain                                                                            |
