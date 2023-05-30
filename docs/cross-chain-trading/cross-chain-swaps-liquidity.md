# Cross-Chain Swaps Liquidity

{% hint style="info" %}
[deSwap App](https://app.debridge.finance/deswap) and API were migrated to [DLN](https://dln.trade/) — a high-performance cross-chain trading infrastructure built on deBridge with a unique 0-TVL design (no liquidity pools).

Read the full announcement here: [https://twitter.com/deBridgeFinance/status/1655914135488696322](https://twitter.com/deBridgeFinance/status/1655914135488696322)

If you've provided liquidity to the deSwap pools listed below, please withdraw it
{% endhint %}

## **deSwap cross-chain pools at Curve**

deBridge is a decentralized infrastructure that is fully composable with the existing DeFi ecosystem. That’s why we don’t need to invent our own AMM or DEX, but just create liquidity pools for deAssets in existing DEXs. In every blockchain supported by deBridge, there will be a liquidity pool for deUSDC at Curve or protocols that support the concept of the stable swap.

Cross-chain swaps are one of the applications built on top of deBridge infrastructure that enables users to perform swaps from any asset on one chain to any asset on another.

Here are the instructions on how to deposit liquidity into the pool for each blockchain/L2.



| Blockchain/L2      | Link                                                                                                                                                 | Pool address                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Arbitrum (deUSDC)  | [https://arbitrum.curve.fi/factory/17](https://arbitrum.curve.fi/factory/17)                                                                         |  [0x76b44e0cf9bd024dbed09e1785df295d59770138](https://arbiscan.io/address/0x76b44e0cf9bd024dbed09e1785df295d59770138)    |
| Arbitrum (deETH)   | [https://arbitrum.curve.fi/factory/15](https://arbitrum.curve.fi/factory/15)                                                                         | [0x0a824b5d4c96ea0ec46306efbd34bf88fe1277e0](https://arbiscan.io/address/0x0a824b5d4c96ea0ec46306efbd34bf88fe1277e0)     |
| Polygon (deUSDC)   | [https://polygon.curve.fi/factory/111](https://polygon.curve.fi/factory/111)                                                                         | [0xda43bfd7ecc6835aa6f1761ced30b986a574c0d2](https://polygonscan.com/address/0xda43bfd7ecc6835aa6f1761ced30b986a574c0d2) |
| BNB Chain (deUSDC) | [https://ellipsis.finance/pool/0x5A7d2F9595eA00938F3B5BA1f97a85274f20b96c](https://ellipsis.finance/pool/0x5A7d2F9595eA00938F3B5BA1f97a85274f20b96c) | [0x5A7d2F9595eA00938F3B5BA1f97a85274f20b96c](https://bscscan.com/address/0x5A7d2F9595eA00938F3B5BA1f97a85274f20b96c)     |
| Avalanche (deUSDC) | [https://avax.curve.fi/factory/61](https://avax.curve.fi/factory/61)                                                                                 | [0xd39016475200ab8957e9c772c949ef54bda69111](https://snowtrace.io/address/0xd39016475200ab8957e9c772c949ef54bda69111)    |

### **Arbitrum deUSDC/2CRV pool**

This is a stablecoin pool at Curve that contains deUSDC (USDC bridged through deBridge) paired with 2CRV - Curve token that represents the basket of two stable coins (USDT+USDC)

In case you want to deposit $X amount of liquidity into this pool, please bridge half ($X/2) amount of USDC from Ethereum to deUSDC in Arbitrum through [dePort](https://app.debridge.finance/deport). The other half should be bridged through Arbitrum’s default bridge [https://bridge.arbitrum.io/](https://bridge.arbitrum.io/) in the form of USDT or USDC.

_Be aware that you will need to have some ETH on your wallet in Arbitrum in order to cover gas costs to broadcast the transaction._

Once you have deUSDC and USDC/USDT in your wallet balance on Arbitrum (you can check through [https://arbiscan.io/](https://arbiscan.io/)), you can deposit the liquidity at Curve.

1. Go to the Curve website of the pool: [https://arbitrum.curve.fi/factory/17/deposit](https://arbitrum.curve.fi/factory/17/deposit)&#x20;
2. Connect your wallet

![](<../.gitbook/assets/Screen Shot 2022-02-01 at 20.45.28.png>)

3\.  Deposit deUSDC and stable coins in a 1:1 ratio.

4\. Confirm the transaction in your wallet.

### **Arbitrum deETH/ETH pool**

In case you want to deposit N amount of ETH into this pool, please bridge half (N/2) amount of ETH from Ethereum to deETH in Arbitrum through [dePort](https://app.debridge.finance/deport). The other half should be bridged through Arbitrum’s default bridge [https://bridge.arbitrum.io/](https://bridge.arbitrum.io/)

Once you have deETH and ETH in your wallet balance on Arbitrum (you can check through [https://arbiscan.io/](https://arbiscan.io/)), you can deposit the liquidity at Curve.

1. Go to the Curve website of the pool: [https://arbitrum.curve.fi/factory/15/deposit](https://arbitrum.curve.fi/factory/15/deposit).
2. Connect your wallet

![](<../.gitbook/assets/Screen Shot 2022-02-01 at 20.51.01.png>)

3\. Deposit deETH and ETH in a 1:1 ratio.

4\. Confirm the transaction in your wallet.

### **Polygon deUSDC/am3CRV pool**

This is a stablecoin pool at Curve that contains deUSDC (USDC bridged through deBridge) paired with am3CRV - Curve token that represents the basket of two stable coins (USDT+USDC+DAI)

In case you’d like to deposit $X amount of liquidity into this pool, please bridge half ($X/2) amount of USDC from Ethereum to deUSDC on Polygon through [dePort](https://app.debridge.finance/deport). The other half should be bridged through Polygon's default bridge [https://wallet.polygon.technology/bridge/](https://wallet.polygon.technology/bridge/) ) in the form of USDT or USDC or DAI.

_Be aware that you will need to have some Matic in your wallet on Polygon in order to cover gas costs to broadcast the transaction._

Once you have deUSDC and USDC/USDT/DAI in your wallet balance on Polygon (you can check through [https://polygonscan.com/](https://polygonscan.com/)), you can deposit the liquidity at Curve.

1. Go to the Curve website of the pool: [https://polygon.curve.fi/factory/111/deposit](https://polygon.curve.fi/factory/111/deposit)&#x20;
2. Connect your wallet

![](<../.gitbook/assets/Screen Shot 2022-02-01 at 20.53.40.png>)

3\. Deposit deUSDC and stable coin in a 1:1 ratio.

4\. Confirm the transaction in your wallet.

### BNB Chain deUSDC/3EPS pool:

This is a stablecoin pool at [Ellipsis Finance](https://ellipsis.finance/) — a fork of Curve on BNB Chain that is endorsed by the Curve core team. The pool contains deUSDC (USDC bridged through deBridge) paired with 3EPS – a meta token that represents the basket of three stable coins (USDT+USDC+BUSD)

In case you want to deposit $X amount of liquidity into this pool, please bridge half ($X/2) amount of USDC from Ethereum to deUSDC on BNB Chain through [dePort](https://app.debridge.finance/deport). The other half should be bridged to BNB Chain through other bridges or centralized exchanges (e.g. Binance or FTX) in the form of [USDT](https://bscscan.com/token/0x55d398326f99059ff775485246999027b3197955), [USDC](https://bscscan.com/token/0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d), or [BUSD](https://bscscan.com/token/0xe9e7cea3dedca5984780bafc599bd69add087d56).

_Be aware that you will need to have some BNB on your wallet in BNB Chain in order to cover gas costs to broadcast the transaction._

Once you have deUSDC and USDC/USDT/BUSD in your wallet balance on BNB Chain (you can check through [https://bscscan.com/](https://bscscan.com/)), you can deposit the liquidity at EPS:

* Go to the EPS website of the pool: [https://ellipsis.finance/pool/4](https://ellipsis.finance/pool/4)&#x20;
* Click “Add liquidity” and connect your wallet

<img src="https://lh5.googleusercontent.com/TUXyBGZjooX1bFVmA_RAWq4ygvpiNDOl7BEQgqGzLISgQ-aE6eQVsyJMxQyxrxP23ar6S_gfGgaevE8WtRlHgHh1m19m1wDE7Pa-HG0XGIgyg-v__vuqU-zpTpWqfVzKfWEYEh_w" alt="" data-size="original">

* Deposit deUSDC and stable coin in a 1:1 ratio
* Confirm transaction in your wallet

Now LP tokens can be staked into the [Ellipsis Finance gauge](https://ellipsis.finance/pool/0x5A7d2F9595eA00938F3B5BA1f97a85274f20b96c) to receive additional $EPX rewards:

![](<../.gitbook/assets/image (2) (1).png>)

### **Avalanche deUSDC/av3CRV pool**

This is a stablecoin pool at Curve that contains deUSDC (USDC bridged through deBridge) paired with av3CRV - Curve token that represents the basket of three stable coins (USDT+USDC+DAI)

In case you’d like to deposit $X amount of liquidity into this pool, please bridge half ($X/2) amount of USDC from Ethereum to deUSDC on Avalanche through [dePort](https://app.debridge.finance/deport). The other half should be bridged through Avalanche's default bridge [https://bridge.avax.network/](https://bridge.avax.network/)) in the form of USDT or USDC or DAI.

_Be aware that you will need to have some AVAX in your wallet on Avalanche in order to cover gas costs to broadcast the transaction._

Once you have deUSDC and USDC/USDT/DAI in your wallet balance on Avalanche (you can check through [https://snowtrace.io/](https://snowtrace.io/)), you can deposit the liquidity at Curve.

1. Go to the Curve website of the pool: [https://avax.curve.fi/factory/61](https://avax.curve.fi/factory/61)&#x20;
2. Connect your wallet

![](<../.gitbook/assets/Screen Shot 2022-04-12 at 14.12.56.png>)

**Now all is done and liquidity will be used for all the cross-chain swaps 🚀**

