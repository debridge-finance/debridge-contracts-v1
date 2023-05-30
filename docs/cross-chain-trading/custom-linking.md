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
| amount         | Token amount to swap                                                                   |

## Example <a href="#example" id="example"></a>

> https://app.debridge.finance/deswap?inputChain=\&inputCurrency=\&outputChain=\&outputCurrency=\&r=\&address=\&amount=

deSwap

> BSC(USDC) - ETHEREUM (USDT)
>
> ​[https://app.debridge.finance/deswap?inputChain=56\&inputCurrency=0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d\&outputChain=1\&outputCurrency=0xdac17f958d2ee523a2206206994597c13d831ec7\&r=111\&address=0x0000000000000000000000000000000000000000](https://app.debridge.finance/deswap?inputChain=56\&inputCurrency=0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d\&outputChain=1\&outputCurrency=0xdac17f958d2ee523a2206206994597c13d831ec7\&r=111\&address=0x0000000000000000000000000000000000000000)​

dePort

> BSC(USDC) - deUsdc
>
> ​[https://app.debridge.finance/deport?inputChain=56\&inputCurrency=0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d\&r=111](https://app.debridge.finance/deport?inputChain=56\&inputCurrency=0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d\&r=111)​

## Chains and Tokens ID <a href="#chains-and-tokens-id" id="chains-and-tokens-id"></a>

The Chain IDs of all chains can be found at [https://chainlist.org/](https://chainlist.org/) or in the spreadsheet below

<table><thead><tr><th width="150" align="center">ID</th><th width="218.51602023608768">Chain</th><th>Token request</th></tr></thead><tbody><tr><td align="center">1</td><td>Ethereum</td><td>GET https://tokens.1inch.io/v1.1/1</td></tr><tr><td align="center">56</td><td>Binance Smart Chain</td><td>GET https://tokens.1inch.io/v1.1/56</td></tr><tr><td align="center">128</td><td>Heco</td><td>GET https://tokens.1inch.io/v1.1/128</td></tr><tr><td align="center">137</td><td>Polygon</td><td>GET https://tokens.1inch.io/v1.1/137</td></tr><tr><td align="center">42161</td><td>Arbitrum</td><td>GET https://tokens.1inch.io/v1.1/42161</td></tr><tr><td align="center">43114</td><td>Avalanche</td><td>GET https://tokens.1inch.io/v1.1/43114</td></tr><tr><td align="center">250</td><td>Fantom</td><td>GET https://tokens.1inch.io/v1.1/250</td></tr></tbody></table>
