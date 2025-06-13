---
description: >-
  Quoting strategies supported by DLN, explaining how source and destination
  amounts are configured for each strategy, with guidance on when to use each.
---

# Quoting Strategies

DLN supports multiple quoting strategies that allow users to control how much is spent on the source chain and how much is received on the destination chain. Each strategy is expressed by how the `srcChainTokenInAmount` and `dstChainTokenOutAmount` fields are set in the order input.&#x20;

Below is an overview of all currently supported quoting strategies.

### Market Order

```typescript
const orderInput: deBridgeOrderInput = {
    ...,
    srcChainTokenInAmount: "<fixed_amount>",
    dstChainTokenOutAmount: "auto",
    ...
}
```

This is the default and most commonly used quoting strategy. It specifies an exact source amount to be transferred, while allowing the protocol to calculate the best possible amount to be received on the destination chain based on current market conditions and solver competition.

* Recommended for most standard transfers
* `srcChainTokenInAmount` must be set to a concrete numeric value
* `dstChainTokenOutAmount` must be set to `"auto"`

### Market Order with Full Balance Utilization

```typescript
const orderInput: deBridgeOrderInput = {
    ...,
    srcChainTokenInAmount: "max",
    dstChainTokenOutAmount: "auto",
    ...
}
```

This strategy attempts to spend **the full wallet balance** of the source token. It is useful when the intention is to "empty" the source wallet of a given asset, such as in account abstraction flows, automated batch processing, or non-custodial smart wallets.

* `srcChainTokenInAmount` must be set to `max`
* `dstChainTokenOutAmount` must be set to `"auto"`

### Reverse Market Order

```typescript
const orderInput: deBridgeOrderInput = {
    ...,
    srcChainTokenInAmount: "auto",
    dstChainTokenOutAmount: "<fixed_amount>",
    ...
}
```

This strategy specifies a desired amount to be received on the estination chain, and allows the protocol to determine how much must be spent on the source chain to fulfill the request. It is commonly used in cases where a precise destination amount is required, such as payments or on-chain contract interactions.

* `` `srcChainTokenInAmount` `` must be set to `"auto"`
* `dstChainTokenOutAmount` must be set to a concrete numeric value

### Limit Order (Not Recommended)

```typescript
const orderInput: deBridgeOrderInput = {
    ...,
    srcChainTokenInAmount: "<fixed_amount>",
    dstChainTokenOutAmount: "<fixed_amount>",
    ...
}
```

This strategy attempts to enforce **both** the source amount to be sent and the destination amount to be received. It effectively functions as a limit order, and will only be fulfilled if a solver is willing to match both values.

* High likelihood of non-fulfillment if the order is unattractive to solvers
* Not recommended for production usage
* Both `srcChainTokenInAmount` and `dstChainTokenOutAmount` must be concrete values

### Example: Order Input Structure

All quoting strategies use the same order input interface, with key fields adjusted per strategy:

```typescript
  const arbUsdcAddress = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";
  const bnbUsdcAddress = "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d";
  const usdcDecimals = 18; // BNB USDC has 6 decimals
  const amountToSend = "0.01"; // The amount of USDC to send

  const amountInAtomicUnit = ethers.parseUnits(amountToSend, usdcDecimals);

  const orderInput: deBridgeOrderInput = {
    srcChainId: '56', // BNB Chain Id
    srcChainTokenIn: bnbUsdcAddress,
    srcChainTokenInAmount: amountInAtomicUnit.toString(),
    dstChainTokenOutAmount: "auto",
    dstChainId: '42161', // Arbitrum Chain Id
    dstChainTokenOut: arbUsdcAddress,
    dstChainTokenOutRecipient: wallet.address,
    account: wallet.address,
    srcChainOrderAuthorityAddress: wallet.address,
    dstChainOrderAuthorityAddress: wallet.address,
    referralCode: 31805 // Optional
    // ... Other optional parameters
  };
```

### Choosing a Stratrgy

| Use Case                               | Recommended Strategy           |
| -------------------------------------- | ------------------------------ |
| Standard transfer with known input     | Market Order                   |
| Full wallet balance transfer           | Market Order with Full Balance |
| Target fixed destination output        | Reverse Market Order           |
| Exact 1-to-1 trade with specific terms | Limit Order (not recommended)  |
