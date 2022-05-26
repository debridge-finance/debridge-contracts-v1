---
description: >-
  Integrate decentralized cross-chain swaps between arbitrary assets into any
  applications (web apps, wallets, dApps) in just a few lines of code
---

# API Quick Start Guide

deSwap is the first-ever application that enables capital-efficient cross-chain swaps between arbitrary liquid assets. It provides users and protocols (DAOs) with the ability to perform atomic cross-chain conversion of assets at the best market rates. And thanks to an execution fee (included gas fee) — _a small amount of the intermediary token that incentivizes anyone to execute the transaction on the destination chain,_ end-users just need to sign a single transaction on the source chain, without the necessity to have native coins for claiming the transfer and paying gas on the destination chain themselves.

Under the hood, deSwap consists of the following layers:

* **the transport layer** (on-chain) is represented by the battle-tested and audited deBridge protocol, which is responsible for cross-chain messaging;
* **the forwarding layer** (on-chain) is represented by periphery smart contracts that are responsible for communicating with deBridge gate, DEXs and aggregators for on-chain swaps;
* **the application layer** (off-chain) is a set of off-chain services, responsible for finding the best swap routes across different DEXs (_the planner_), estimating cross-chain swaps (_the estimator_), and packing them into transactions ready to be submitted to the blockchains.

But don't be scared! The underlying complexity of deSwap is wrapped within a simple and intuitive B2B solution — [deSwap API](https://debridge.finance/api), which allows you to start constructing your very own cross-chain swap transactions in a matter of minutes!&#x20;

{% hint style="info" %}
Find the API specifications at our Swagger available at [https://deswap.debridge.finance/](https://deswap.debridge.finance/) along with examples and schemas.
{% endhint %}

### Use case: Swap USDT on Ethereum to MATIC on Polygon

Let's consider a real-life example: a user, who has 50 USDT on Ethereum, would like to receive MATIC on Polygon.

#### Estimating a swap

First, let's estimate the swap by calling the `/estimate` endpoint:

> `https://deswap.debridge.finance/v1.0/estimation?srcChainId=1&srcChainTokenIn=0xdAC17F958D2ee523a2206206994597C13D831ec7&srcChainTokenInAmount=50000000&slippage=1&dstChainId=137&dstChainTokenOut=0x0000000000000000000000000000000000000000&executionFeeAmount=auto`

This request contains at least the following parameters representing our initial case:

* `srcChainId` specifies the Ethereum chain id (`1`) as the chain swap is being initiated
* `srcChainTokenIn` specifies the USDT token address (`0xdAC17F958D2ee523a2206206994597C13D831ec7`)
* `srcChainTokenInAmount` specifies the desired input amount: since USDT token contract uses 6 decimals (_the number of digits that come after the decimal place when displaying token values on-screen_), the simple math: `50 * 10^6` leads to `50000000` as the value representing 50 USDT tokens
* `dstChainId` specified the Polygon network chain id (`137`) as the target (destination) chain
* `dstChainTokenOut` specifies the address of the target token; since MATIC is not a typical ERC-20 token represented by a smart contract but rather a native coin (a one-of-a-kind token within each EVM chain), we use a [null (or zero) address](https://etherscan.io/address/0x0000000000000000000000000000000000000000) to distinguish it from other tokens.

The following mandatory parameters are important as well:

* The `slippage` parameter defines a constraint that acts as a safeguard to protect from a possible price drop. By specifying `1` (means 1%) we allow a DEX to perform exchange only if the actual outcome is not less than 99% of the estimated outcome.
* `executionFeeAmount=auto` asks the estimator to include (and subtract it from the outcome) a minimum execution fee (included gas fee) sufficient to incentivize anyone to execute the transaction on the destination chain

Sending this request will give us enough data to understand the outcome and its reasons. Under the `estimation.dstChainTokenOut` we can see the actual amount of MATIC the user may receive as a result of the swap:

```json
"estimation": {
    "dstChainTokenOut": {
        "address": "0x0000000000000000000000000000000000000000",
        "name": "MATIC",
        "symbol": "MATIC",
        "decimals": 18,
        "amount": "29570160331501581528",
        "minAmount": "29274458728186565713"
    },
}
```

This implies that the user is expected to receive 29.57 MATIC (`29570160331501581528 / 10^18`), and at least 29.27 MATIC in a worst-case scenario (which corresponds to 99% of the estimated value since the slippage was initially set to 1%).

Other than that, we can find the `estimation.executionFee` object containing details about the execution fee token and the amount which has been subtracted from the estimated outcome:

```json
"estimation": {
    "executionFee": {
        "token": {
            "address": "0x1dDcaa4Ed761428ae348BEfC6718BCb12e63bFaa",
            "name": "deBridge USD Coin",
            "symbol": "deUSDC",
            "decimals": 6
        },
        "recommendedAmount": "89031",
        "actualAmount": "89031"
    }
}
```

This means that the planner has picked deUSDC token as the intermediary token (used to bridge liquidity across chains), and the deBridge gate will withhold 0.089031$ (nine cents!) of it as an incentive to anyone who is willing to execute the transaction on the destination chain. In other words, by giving the deBridge gate an explicit permission to hold a small amount as an execution fee, you don't have to worry about claiming the final transaction on the Polygon chain (which implies that you need to have some MATIC token beforehand to do this!), the cross-chain swap will finish automatically on your behalf!

#### Getting a transaction

Okay, you've received an estimation, the expected execution fee and the outcome are satisfactory. Now it's time to get the transaction that initiates the desired cross-chain swap. There is the `/transaction` endpoint for that, which expects at least all the parameters the `/estimation` endpoint does, and additionally two wallet addresses on the destination chain:

* `dstChainTokenOutRecipient`, the address target tokens should be transferred to after the swap, and
* `dstChainFallbackAddress`, the address target or intermediary tokens should be transferred in case of a failed swap (e.g., a swap may fail due to slippage constraints).

Putting it all together, the following request may be made:

> `https://deswap.debridge.finance/v1.0/transaction?srcChainId=1&srcChainTokenIn=0xdAC17F958D2ee523a2206206994597C13D831ec7&srcChainTokenInAmount=50000000&slippage=1&dstChainId=137&dstChainTokenOut=0x0000000000000000000000000000000000000000&executionFeeAmount=auto&dstChainTokenOutRecipient=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&dstChainFallbackAddress=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`

The result of this request contains two objects. The `estimation` object has the same name and structure as inside the result of the `/estimation` endpoint, you are already familiar with. It may contain values that are slightly differ from the previous call, as the prices of crypto assets are highly volatile, so don't be surprised to see a corrected estimation.

The `tx` object has the following structure:

```json
"tx": {
    "to": "0x663DC15D3C1aC63ff12E45Ab68FeA3F0a883C251",
    "data": "0x61b36437000000000000000000000000dac17f958d2ee523a2206206994597c13d[...]",
    "value": "1000000000000000"
}
```

and represents the constructed transaction ready to be signed and sent to the blockchain!

#### Submitting a transaction

Field names from the `tx` object speak for themselves:

* the `to` is the field the transaction should be sent to, and typically you should expect the address of one of the smart contracts responsible for forwarding;
* the `data` is the contents of the transaction, containing instructions related to swaps planned on the source or (and) on the destination chains, bridging settings, etc;
* the `value` is the amount of native coins that must be sent along with the transaction.

However, there are a few things you must consider:

First, the `value` is always positive, even if you plan to swap an ERC-20 token. This is because the underlying deBridge protocol takes a fixed amount in the base asset of the blockchain, and the API always includes it as the transaction value. In the above example, the `value` equals the current fixed fee, which is 0.001 ETH on the Ethereum blockchain. You can learn more about this by reading the deBridge protocol [documentation](https://docs.debridge.finance/the-core-protocol/protocol-overview#protocol-fees). Soon we'll give everyone the ability to pay this fixed fee in the input asset rather than the native coin.

Second, in case you plan to swap an ERC-20 token, you need to give approval to the smart contract address specified in the `tx.to` field prior to submitting this transaction so it can transfer them on the behalf of the sender. This can be typically done by calling either `approve()` or `increaseAllowance()` method of the smart contract which implements the token you are willing to swap. Approve at least the amount of tokens you are going to swap.

Third, our smart contracts support [EIP-2612-compliant](https://eips.ethereum.org/EIPS/eip-2612) signed approvals, so the necessity to give the approval (described above) can be eliminated by providing an approval signed off-chain by the sender.

Other than that, the transaction is ready to be signed by the sender and sent to the blockchain via your favorite RPC node.

### Best practices

Don't forget to specify your invitation code as the `referralCode` parameter when calling the `/transaction` endpoint. If you don't have it, you can get one by pressing the WAGMI button at https://app.debridge.finance/. Governance may thank you later for being an early builder.

Don't delay the transaction: since cryptoassets are highly volatile, the prices may change drastically within a short period of time which may cause swaps to fail because of changed prices and outdated slippage constraints. We recommend submitting the transaction within two minutes after construction or refreshing it's `data` by calling the `/transaction` endpoint again.

### Understanding the execution fee

The execution fee is a small amount of the intermediary token that incentivizes anyone to execute the transaction on the destination chain. In other words, the execution fee must cover the cost of gas needed to execute the transaction. To estimate the execution fee, the estimator estimates the amount of gas units the transaction is expected to consume, multiplies it by the current price per gas unit, and adds a 30% margin to make it profitable for a claimer.

This means that the execution fee dramatically differs across different chains: a few cents on the Polygon network, a few dollars on the BNB chain, $10-20 on the Arbitrum One chain, and more than $50 on the Ethereum chain.

### Understanding the asset of the execution fee

The execution fee is a small amount of the _intermediary token_ that incentivizes anyone to execute the transaction on the destination chain. It is important to understand that the intermediary token is a select token used to transfer liquidity between chains. In the example above, we saw the deUSDC token as an intermediary token baked 1:1 by USDC collateral on Ethereum, but there may be other tokens as well. For example, there is a deETH intermediary token on the Arbitrum One chain baked 1:1 by ETH collateral hold on Ethereum. We are working to provide more intermediary tokens and increase liquidity on popular DEXs.

This means that you must never have a fixed amount as the execution fee, since the values may be represented in various assets. For example, at the time of writing, there are two intermediary tokens on the Arbitrum blockchain, and the execution fees may look as follows:

* 0.003653 deETH (≈12.2$), if the planner picks deETH as the intermediary token,
* 18.772567 deUSDC, if the planner picks deUSDC as the intermediary token.

It is also important to understand that the planner picks the best route by the maximum outcome (with execution fee subtracted), not by the lowest execution fee itself.

### FAQ

#### What is the difference between the `/estimation` and the `/transaction` endpoints?

You might have noticed that the `/transaction` endpoint provides the complete estimation of the route, so you might wonder about the purpose of the separate `/estimation` endpoint. The reason is the performance and latency: doing numerous estimations in a row may be faster when calling `/estimation` as it does not use some heavyweight calls used by the `/transaction` endpoint.

#### Why can't I swap to/from token X?

We use data from the 1inch aggregator (more aggregators are on the way!) to find the best market rates across known DEXs. However, there may be tokens that are not listed on any DEX or miss adequate liquidity for their token. In any of these cases, we cannot provide you with a route for a swap.
