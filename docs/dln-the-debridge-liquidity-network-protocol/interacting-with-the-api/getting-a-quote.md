# Getting a Quote

{% hint style="info" %}
The [`/quote`](https://dln.debridge.finance/v1.0#/DLN/DlnOrderControllerV10\_estimateTakeAmountOrder) endpoint of DNL API should be used only to display outcomes of the trades when the address of the user is unknown (e.g. to let the user see prices of cross-chain trades before one connects the wallet to the dApp).

Whenever an address is known, make sure to call `/create-tx` directly.
{% endhint %}

To place an order that would be reasonably profitable to incentivize a solver to fulfill it, a quote must not only reflect the current market exchange rate but also include relevant fees: the affiliate fee (in case you are going to collect an affiliate fee), the DLN protocol fee, the taker's margin fee; additionally, a quote must cover all implicit operating expenses incurred by a taker during and after order fulfillment (that includes Taker's gas costs for fulfillment and unlock of liquidity in the source chain).

The `/v1.0/dln/order/quote` endpoint performs all necessary calculations to provide the best reasonable quote for the given input.

Let's get a quote for our use-case by calling the `/v1.0/dln/order/quote` endpoint with the following parameter values:

| Parameter                 | Value                                                               | Description                                                                                                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `srcChainId`              | `56`                                                                | specifies the ID of the BNB Chain as the chain where an order would be placed                                                                                                                                                                                                                 |
| `srcChainTokenIn`         | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`                        | sets the input token (the user is willing to give) to the USDC token address on the BNB Chain                                                                                                                                                                                                 |
| `srcChainTokenInAmount`   | `100000000000000000000`                                             | specifies the desired input amount: since the USDC token contract uses 18 decimals (_the number of digits that come after the decimal place when displaying token values on-screen_), the simple math: `100*10^18` leads to `100000000000000000000` as the value representing 100 USDC tokens |
| `dstChainId`              | `43114`                                                             | specified the Avalanche network chain ID as the destination chain where an order should be fulfilled                                                                                                                                                                                          |
| `dstChainTokenOut`        | <pre><code>0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7
</code></pre> | sets the output token (the user is willing to take) to the USDT token address on Avalanche                                                                                                                                                                                                    |
| `prependOperatingExpense` | `true`                                                              | asks the API to add the approximate amount of operating expenses to the amount of input token before making a quote                                                                                                                                                                           |
| `affiliateFeePercent`     | `0.1`                                                               | asks the order to accrue the given share of input amount, which would be paid after an order gets fulfilled and unlocked                                                                                                                                                                      |

Calling the endpoint:

> `https://dln.debridge.finance/v1.0/dln/order/quote?srcChainId=56&srcChainTokenIn=0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d&srcChainTokenInAmount=100000000000000000000&dstChainId=43114&dstChainTokenOut=0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7&prependOperatingExpenses=true&affiliateFeePercent=0.1`

gives a response with the recommended amount of input token, and several details describing how it has been calculated. The recommended amount of the output token (USDT in our case) available in the `estimation.dstChainTokenOut.recommendedAmount` property — this is the amount that can be suggested to a user for explicit approval before placing an order.

At the time of writing, the response contains the following values:

```
{
    "estimation": {
            "srcChainTokenIn": {
                    "address": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
                    "decimals": 18,
                    "name": "USD Coin",
                    "symbol": "USDC",
                    "chainId": 56,
                    ,
                    ,
                    "approximateOperatingExpense": "722632000000000000",
            },
            "dstChainTokenOut": {
                    "address": "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7",
                    "decimals": 6,
                    "name": "TetherToken",
                    "symbol": "USDt",
                    "chainId": 43114,
                    "amount": "99623050",
                    
            },
            
            [...]
    },
    
    [...],
        
    "tx": {
        "allowanceTarget": "0xeF4fB24aD0916217251F553c0596F8Edc630EB66",
        "allowanceValue": "100722632000000000000"
    },
}
```

This response states that executing an order to swap 100 USDC on BNB Chain to USDT on Avalanche requires approximately 0.722632 USDC, so this has been added to the input amount, resulting 100.722632 USDC to be charged from the user upon order creation.

Additionally, 0.100722632 USDC is accrued as an affiliate fee upon order creation.

{% hint style="info" %}
The affiliate fee is paid only after the order gets fulfilled, and after the taker has unlocked the order in the source chain.
{% endhint %}

The most important part is the recommended amount of the output token: the API endpoint assumes that takers would be incentivized to fulfill an order with the given input at the time of the request if taking 99.623050 USDT. Not bad for a cross-chain swap/value transfer!

If a user is comfortable with the quote, a transaction to create a limit order with the given quote can be requested.
