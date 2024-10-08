# Integrating DLN hooks

The DLN API provides a convenient high-level interface to attach hooks to orders upon [requesting an order creation transaction](../requesting-order-creation-transaction.md). The API takes the burden of proper hook data validation, encoding, cost estimation, and simulation, ensuring that an order would get filled on the destination chain and there is no technical inconsistencies that may prevent it. This is especially important for **atomic** **success-required hooks**, as an error during such hook execution would prevent an order from getting filled, and an order's authority would need to initiate [a cancellation procedure](../cancelling-the-order.md) from the destination chain, which increases friction and worsens UX.&#x20;

To specify the hook, use the `dlnHook` parameter of the [`create-tx`](https://dln.debridge.finance/v1.0#/DLN/DlnOrderControllerV10\_createOrder) endpoint. The value for this parameter must be a JSON in a specific format that describes the hook for the given destination chain. Depending on the destination chain, different templates are available.

### Serialized instructions hook for Solana

To set the hook to be executed upon filling order on Solana (`dstChainId=7565164`), the following template should be used:

```javascript
{ type: "solana_serialized_instructions"; data: "0x..." }
```

where data is represented as a versioned transaction with one or more instructions. Thus, only **non-atomic** **success-required hooks** are supported.

To craft a proper versioned transaction, use the guide: [creating-hook-data-for-solana.md](creating-hook-data-for-solana.md "mention")

<details>

<summary>Example</summary>

Example of encoding `dlnHook` parameter:

```javascript
dlnHook: JSON.stringify({
  type: "solana_serialized_instructions";
  data: "0x000000000000000001000000000000000000000000010000000000000000010000000000000000135d3e6be2a2ae5274cfe4007df2f62ed31c618f048337fd1435ca2dee2a0d5d12000000000000001968562fef0aab1b1d8f99d44306595cd4ba41d7cc899c007a774d23ad702ff60101fd97b70d573d364ef44769540777b1ecdc21b88ff7def38c45d020e271c589dc00010000000000000000000000000000000000000000000000000000000000000000000062584959deb8a728a91cebdc187b545d920479265052145f31fb80c73fac5aea00009845350d27001686985bbc5c4a3646c928d7de27ddab09f2de56d21537201c4300019845350d27001686985bbc5c4a3646c928d7de27ddab09f2de56d21537201c4300010c1e5ba8fe0ec5c5e44d12c2b6317a8781ca19ddb0e1532b136f418e1d588f9500010c1e5ba8fe0ec5c5e44d12c2b6317a8781ca19ddb0e1532b136f418e1d588f95000106ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a900000000000000000000000000000000000000000000000000000000000000000000000006a7d517187bd16635dad40455fdc2c0c124c68f215675a5dbbacb5f0800000000008c97258f4e2489f1bb3d1029148e0d830b5a1399daff1084048e7bd8dbe9f8590000ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000974d0b69f43d964da48af118a28037ab921a95eae1e637497b22867ce416255a00016be7362bf52e4ea29063d29ab43a832253ed7c68b62cf68e8d706a2f9531c1eb0001c6fa7af3bedbad3a3d65f36aabc97431b1bbe4c2d2f6e0e47ca60203452f5d610000040000000000000000736f6c"
})
```

</details>

### Transaction call hook for EVM

To easily attach an atomic success-required hook that executes an arbitrary transaction call via the default [Universal hook](../../protocol-specs/hook-data/anatomy-of-a-hook-for-the-evm-based-chains.md#universal-hook), the DLN API provides a simple shortcut for that:

```javascript
{
  type: "evm_transaction_call";
  data: {
    "to": "0x...",
    "calldata": "0x...",
    "gas": 0
  }
}
```

The `data.to` and `data.calldata` properties represent the transaction call that should be made, as explained in the [Universal hook](../../protocol-specs/hook-data/anatomy-of-a-hook-for-the-evm-based-chains.md#universal-hook) section. The `gas` property **must** be specified if:

* the underlying call handles errors gracefully, which leads to underestimation of gas (see [our investigation](https://twitter.com/AlexSmirnov\_\_/status/1538903343455772673) on this)
* the transaction call can't be estimated currently, which leads to inability of the DLN API to properly estimate transaction costs.&#x20;

<details>

<summary>Example of a hook that deposits 0.1 USDC to AAVE</summary>

The following snippet produces a `dlnHook` parameter that results a hook to deposit 0.1 USDC to AAVE on behalf of `0xc31dcE63f4B284Cf3bFb93A278F970204409747f`:

```javascript
const query = new URLSearchParams({
  // other parameters were omitted for clarity
  dstChainId: 137,
  dstChainTokenOut: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
  dstChainTokenOutAmount: '100000',
  dlnHook: JSON.stringify({
    type: "evm_transaction_call";
    data: {
      "to": "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
      "calldata": "0x617ba0370000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c335900000000000000000000000000000000000000000000000000000000000186a0000000000000000000000000c31dce63f4b284cf3bfb93a278f970204409747f0000000000000000000000000000000000000000000000000000000000000000",
      "gas": 0
    }
  })
})
```

</details>

This simple shortcut would be transparently converted by the DLN API to a hook with the following properties:

```javascript
{
    fallbackAddress: dstChainTokenOutRecipient,
    target: '0x0000000000000000000000000000000000000000',
    reward: 0,
    isNonAtomic: false,
    isSuccessRequired: true,
    targetPayload: {
        to: dlnHook.data.to,
        callData: dlnHook.calldata.data,
        gas: dlnHook.data.gas
    }
}
```

### Arbitrary hook for EVM

To provide a complete customization of a hook, the DLN API offers a template that fully replicates the [HookDataV1 struct](../../protocol-specs/hook-data/anatomy-of-a-hook-for-the-evm-based-chains.md#hook-data-layout):

```json
{
  "type": "evm_hook_data_v1",
  "data": {
    "fallbackAddress": "0x...",
    "target": "0x...",
    "reward": "0",
    "isNonAtomic": boolean,
    "isSuccessRequired": boolean,
    "targetPayload": "0x"
  }
}
```

The DLN API would encode it and inject into an order.

<details>

<summary>Example of a hook that deposits 0.1 USDC to AAVE</summary>

The following snippet produces a `dlnHook` parameter that results a hook to deposit 0.1 USDC to AAVE on behalf of `0xc31dcE63f4B284Cf3bFb93A278F970204409747f` via the default Univarsal hook:

```javascript
const query = new URLSearchParams({
  // other parameters were omitted for clarity
  dstChainId: 137,
  dstChainTokenOut: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
  dstChainTokenOutAmount: '100000',
  dlnHook: JSON.stringify({
    type: "evm_hook_data_v1";
    data: {    
      "fallbackAddress": "0xc31dcE63f4B284Cf3bFb93A278F970204409747f",
      "target": "0x0000000000000000000000000000000000000000",
      "reward": "0",
      "isNonAtomic": false,
      "isSuccessRequired": true,
      "targetPayload": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000794a61358d6845594f94dc1db02a252b5b4814ad000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000084617ba0370000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c335900000000000000000000000000000000000000000000000000000000000186a0000000000000000000000000c31dce63f4b284cf3bfb93a278f970204409747f000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    }
  })
})
```

</details>

### Hook validity considerations

{% hint style="warning" %}
To ensure best and frictionless user experience, the DLN API would refuse to return a transaction to create an order if it is impossible to fulfill an order with the given hook.
{% endhint %}

The hook is attached to the order during order's placement on the source chain, however actual fulfillment occurs on the destination chain. If the attached hook is success-required and exits unsuccessfully upon fulfillment, it prevents the entire order from getting filled. This would necessitate an order's authority to initiate [a cancellation procedure](../cancelling-the-order.md) from the destination chain, which increases friction and worsens UX.&#x20;

To prevent this, the DLN API constructs a potential transaction to fulfill the order to be created, and simulates this transaction internally to ensure that the order to be created could actually be filled. If such simulation causes an error, that points to the problem within the hook, the API would refuse to return a transaction, but would return an error with details instead, so you can debug the potential fulfillment transaction to find a pitfalls in the hook:

```typescript
{
    "errorId": "HOOK_FAILED",
    "errorPayload": {
        "potentialFulfillOrderTxSimulation": {
            "simulationInput": {
                "chainId": number,
                "blockNumber": number,
                "tx": {
                    "from": string,
                    "to": string,
                    "data": string,
                    "value"?: string
                },
            },

            "simulationError": {
                "errorName": string,
                "data": string,
            }
        }
    }
}
```
