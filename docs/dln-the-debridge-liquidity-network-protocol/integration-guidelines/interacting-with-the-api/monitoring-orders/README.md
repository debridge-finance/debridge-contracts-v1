# Monitoring Orders

Once an order has been successfully created on-chain, its state can be monitored using several available methods, depending on the use case. For a full overview of order states and their transitions, refer to the [Order States](order-states.md) documentation.&#x20;

## Key Completion States

Orders progress through multiple internal states. However, from the perspective of the end-user experience, the following states indicate successful completion:

* `Fulfilled`&#x20;
* `SentUnlock`&#x20;
* `ClaimedUnlock`

{% hint style="success" %}
Any of these states can be treated as successfully completed final state for application-level logic.
{% endhint %}

## Quick Start

* **Base URL:**`https://stats-api.dln.trade`&#x20;
* **Full endpoint reference:**  [Swagger](https://dln-api.debridge.finance/swagger/index.html#/Orders/Orders_GetOrderByCreationTx) and [Redoc](https://stats-api.dln.trade/redoc/index.html?url=/swagger/v1/swagger.json#tag/Orders/operation/Orders_GetOrders)
* **Examples**: See the implementation examples in [this GitHub repository](https://github.com/debridge-finance/api-integrator-example/tree/master/src/scripts/orders/queries).

## Querying Orders

### By Wallet Address

The [`POST /api/Orders/filteredList`](https://stats-api.dln.trade/redoc/index.html?url=/swagger/v1/swagger.json#tag/Orders/operation/Orders_GetOrders) endpoint retrieves the current state and historical data for all orders associated with a wallet address. This endpoint is also used to populate the trade history view in [deExplorer](https://app.debridge.finance/orders), which can serve as a reference implementation. Pagination is supported via `skip` and `take` parameters.

#### Example: Fetching Completed Orders for a Wallet

```typescript
const URL = 'https://stats-api.dln.trade/api/Orders/filteredList';

const requestBody = {
  orderStates: ['Fulfilled', 'SentUnlock', 'ClaimedUnlock' ],
  externalCallStates: ['NoExtCall'],
  skip: 0,
  take: 10,
  maker: '0x441bc84aa07a71426f4d9a40bc40ac7183d124b9',
};

const data = await post(URL, requestBody);
```

#### Example: Filtering Completed Orders by Destination Chain (e.g. HyperEVM)

```typescript
const requestBody = {
    giveChainIds: [],
    takeChainIds: [100000022], // HyperEVM Chain Id
    orderStates: ['Fulfilled', 'SentUnlock', 'ClaimedUnlock' ],
    externalCallStates: ['NoExtCall'],
    skip: 0,
    take: 10,
    maker: '0x441bc84aa07a71426f4d9a40bc40ac7183d124b9',
  };
```

## By Transaction Hash

For inspecting a specific order, the [`GET /api/Orders/creationTxHash/{hash}`](https://dln-api.debridge.finance/swagger/index.html#/Orders/Orders_GetOrderByCreationTx)  endpoint returns full order details as shown on the [deExplorer order page](https://app.debridge.finance/order?orderId=0x87daf0659e138c13aecb59e1b044c5e296d2811188cd6812c78425273ebd064e).

**Example:**

> [https://stats-api.dln.trade/api/Orders/creationTxHash/0x3fe11542154f53dcf3134eacb30ea5ca586c9e134c223e56bbe1893862469bc5](https://stats-api.dln.trade/api/Orders/creationTxHash/0x3fe11542154f53dcf3134eacb30ea5ca586c9e134c223e56bbe1893862469bc5)

{% hint style="warning" %}
If multiple orders were created in a single transaction, this endpoint returns data only for the first order.
{% endhint %}

### Multiple orders created in the same transaction

In cases where multiple orders are created in a single transaction, retrieve all order IDs using [`GET /api/Transaction/{hash}/orderIds`](https://dln-api.debridge.finance/swagger/index.html#/Orders/Orders_GetOrderByCreationTx) .

For example, the transaction[`0x40ee524d5bb9c4ecd8e55d23c66c5465a3f137be7ae24df366c3fd06daf7de7e`](https://bscscan.com/tx/0x40ee524d5bb9c4ecd8e55d23c66c5465a3f137be7ae24df366c3fd06daf7de7e) has been submitted to the BNB Chain. Calling the endpoint:

> [`https://stats-api.dln.trade/api/Transaction/0x40ee524d5bb9c4ecd8e55d23c66c5465a3f137be7ae24df366c3fd06daf7de7e/orderIds`](https://stats-api.dln.trade/api/Transaction/0x40ee524d5bb9c4ecd8e55d23c66c5465a3f137be7ae24df366c3fd06daf7de7e/orderIds)

The response is an array, even if the transaction resulted in only one order:

```json
{
    "orderIds": [
        "0x9ee6c3d0aa68a7504e619b02df7c71539d0ce10e27f593bf8604b62e51955a01"
    ]
}
```

{% hint style="info" %}
An array instead of a single `orderId` is returned because a top-level transaction may perform several calls to DLN, thus leading to multiple orders being created.
{% endhint %}

#### Example:

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

## By orderId

The `orderId` is a deterministic identifier returned in the `create-tx` [response ](../creating-an-order/api-response/)or retrievable via the transaction hash.&#x20;

An order state can be monitored directly by using [`GET /api/Orders/{orderId}`](https://stats-api.dln.trade/swagger/index.html#/Orders/Orders_GetOrder) .

**Example:**

> [`https://stats-api.dln.trade/api/Orders/0x9ee6c3d0aa68a7504e619b02df7c71539d0ce10e27f593bf8604b62e51955a01`](https://stats-api.dln.trade/api/Orders/0x9ee6c3d0aa68a7504e619b02df7c71539d0ce10e27f593bf8604b62e51955a01)

**Response:**

```typescript
{
    "status": "ClaimedUnlock"
}
```

#### Example:

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

## Affiliate Fee Settlement

If set during order creation, the [affiliate fee](../../affiliate-fees/) is automatically transferred to the `affiliateFeeRecipient` once the order reaches the `ClaimedUnlock` status.
