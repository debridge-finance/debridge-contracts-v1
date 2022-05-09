# Custom Linking

The deBridge web application enables users to create custom links with a pre-defined set of parameters using URL query parameters. Users and developers can use their own prefilled settings for deSwap or dePort.​

| Parameter      | Description                                                                            |
| -------------- | -------------------------------------------------------------------------------------- |
| inputChain     | Id of the chain where deSwap is initiated.                                             |
| inputCurrency  | Token contract address of the input currency that will be swapped for output currency. |
| outputChain    | Id of the destination chain                                                            |
| outputCurrency | Token contract address of the output currency that input currency will be swapped for. |
| r              | Your generated referral code                                                           |
| address        | Recipient address                                                                      |

## Example <a href="#example" id="example"></a>

> https://app.debridge.finance/deswap?inputChain=\&inputCurrency=\&outputChain=\&outputCurrency=\&r=\&address=

deSwap

> BSC(USDC) - ETHEREUM (USDT)
>
> ​[https://app.debridge.finance/deswap?inputChain=56\&inputCurrency=0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d\&outputChain=1\&outputCurrency=0xdac17f958d2ee523a2206206994597c13d831ec7\&r=111\&address=0x0000000000000000000000000000000000000000](https://app.debridge.finance/deswap?inputChain=56\&inputCurrency=0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d\&outputChain=1\&outputCurrency=0xdac17f958d2ee523a2206206994597c13d831ec7\&r=111\&address=0x0000000000000000000000000000000000000000)​

dePort

> BSC(USDC) - deUsdc
>
> ​[https://app.debridge.finance/deport?inputChain=56\&inputCurrency=0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d\&r=111](https://app.debridge.finance/deport?inputChain=56\&inputCurrency=0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d\&r=111)​

## Chains and Tokens ID <a href="#chains-and-tokens-id" id="chains-and-tokens-id"></a>

The Chain IDs of all chains can be found at [https://chainlist.org/](https://chainlist.org) or in the spreadsheet below

|   ID  | Chain               | Token request                          |
| :---: | ------------------- | -------------------------------------- |
|   1   | Ethereum            | GET https://tokens.1inch.io/v1.1/1     |
|   56  | Binance Smart Chain | GET https://tokens.1inch.io/v1.1/56    |
|  128  | Heco                | GET https://tokens.1inch.io/v1.1/128   |
|  137  | Polygon             | GET https://tokens.1inch.io/v1.1/137   |
| 42161 | Arbitrum            | GET https://tokens.1inch.io/v1.1/42161 |
| 43114 | Avalanche           | GET https://tokens.1inch.io/v1.1/43114 |
