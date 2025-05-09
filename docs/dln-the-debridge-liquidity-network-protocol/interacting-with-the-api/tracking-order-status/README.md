# Tracking Order Status

Once an order has been successfully created on-chain, its status can be tracked using several available methods. For an overview of all possible order states, refer to the order status documentation [here](order-states.md).

## Tracking by Wallet Address

The [`/filteredList`](https://stats-api.dln.trade/redoc/index.html?url=/swagger/v1/swagger.json#tag/Orders/operation/Orders_GetOrders) [ ](https://stats-api.dln.trade/redoc/index.html?url=/swagger/v1/swagger.json#tag/Orders/operation/Orders_GetOrders)method of the DLN [Stats API](https://stats-api.dln.trade/swagger/index.html#/) allows retrieving the trade history and current status of all orders associated with a given wallet address. Check [redoc](https://stats-api.dln.trade/redoc/index.html?url=/swagger/v1/swagger.json#tag/Orders/operation/Orders_GetOrders) for more details.&#x20;

**Example:**

```bash
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

The same endpoint powers the DLN [trade history section of deExplorer](https://app.debridge.finance/orders), which can serve as a reference implementation.

## Tracking by Transaction Hash

For inspecting a specific order, the [`/api/Orders/creationTxHash/{hash}`](https://dln-api.debridge.finance/swagger/index.html#/Orders/Orders_GetOrderByCreationTx) endpoint returns full order details as shown on the [deExplorer order page](https://app.debridge.finance/order?orderId=0x87daf0659e138c13aecb59e1b044c5e296d2811188cd6812c78425273ebd064e).

**Example:**

> [https://stats-api.dln.trade/api/Orders/creationTxHash/0x3fe11542154f53dcf3134eacb30ea5ca586c9e134c223e56bbe1893862469bc5](https://stats-api.dln.trade/api/Orders/creationTxHash/0x3fe11542154f53dcf3134eacb30ea5ca586c9e134c223e56bbe1893862469bc5)

View the example order on [deExplorer](https://app.debridge.finance/order?orderId=0x313d90a13e5f54efa3c065a98f1434c59d12ba9f4da8b224533bc56b6ed40d82).

{% hint style="warning" %}
If multiple orders were created in a single transaction, this endpoint returns data only for the first order.
{% endhint %}

### Multiple orders created in the same transaction

If multiple orders were created in a single transaction, the endpoint that returns a list of multiple order `orderId`s created by one transaction is `/v1.0/dln/tx/:hash/order-ids`.

For example, the transaction[`0x40ee524d5bb9c4ecd8e55d23c66c5465a3f137be7ae24df366c3fd06daf7de7e`](https://bscscan.com/tx/0x40ee524d5bb9c4ecd8e55d23c66c5465a3f137be7ae24df366c3fd06daf7de7e) has been submitted to the BNB Chain. Calling the endpoint:

> [`https://stats-api.dln.trade/api/Transaction/0x40ee524d5bb9c4ecd8e55d23c66c5465a3f137be7ae24df366c3fd06daf7de7e/orderIds`](https://stats-api.dln.trade/api/Transaction/0x40ee524d5bb9c4ecd8e55d23c66c5465a3f137be7ae24df366c3fd06daf7de7e/orderIds)

will return an array with only one `orderId` in it:

```
{
    "orderIds": [
        "0x9ee6c3d0aa68a7504e619b02df7c71539d0ce10e27f593bf8604b62e51955a01"
    ]
}
```

{% hint style="info" %}
An array instead of a single `orderId` is returned because a top-level transaction may perform several calls to DLN, thus leading to multiple orders being created.
{% endhint %}

Example code:&#x20;

```typescript
export async function getOrderIdByTransactionHash(txHash: string) {
  const URL = `https://stats-api.dln.trade/api/Transaction/${txHash}/orderIds`;

  const response = await fetch(URL);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get orderIds by transaction hash: ${response.statusText}. ${errorText}`,
    );
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`DeBridge API Error: ${data.error}`);
  }

  return data;
}
```

## By order Id

The `orderId` is a deterministic identifier returned in the `create-tx` [response ](../creating-an-order/api-response/)or retrievable via the transaction hash.&#x20;

To track order status directly by `orderId`, use:

```bash
GET /api/Orders/{orderId}
```

View Swagger spec [here](https://stats-api.dln.trade/swagger/index.html#/Orders/Orders_GetOrder).

**Example:**

> [`https://stats-api.dln.trade/api/Orders/0x9ee6c3d0aa68a7504e619b02df7c71539d0ce10e27f593bf8604b62e51955a01`](https://stats-api.dln.trade/api/Orders/0x9ee6c3d0aa68a7504e619b02df7c71539d0ce10e27f593bf8604b62e51955a01)

**Response:**

```typescript
{
    "status": "ClaimedUnlock"
}
```

Orders progress through various [states](order-states.md), but the key states that indicate a successful fulfillment are:

* `Fulfilled`
* `SentUnlock`
* `ClaimedUnlock`

{% hint style="success" %}
Any of the above statuses can be interpreted as complete from the perspective of the end-user.
{% endhint %}

Example code:

```typescript
export async function getOrderStatusByOrderId(orderId: string) {
  const URL = `https://stats-api.dln.trade/api/Orders/${orderId}`

  const response = await fetch(URL);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get order status by orderId: ${response.statusText}. ${errorText}`,
    );
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`DeBridge API Error: ${data.error}`);
  }

  return data;
}
```

#### Affiliate Fee Settlement

If set during order creation, the [affiliate fee](../affiliate-fees.md) is automatically transferred to the `affiliateFeeRecipient` once the order reaches the `ClaimedUnlock` status.
