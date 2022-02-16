# Liquidity Provision

## **Provision of liquidity for cross-chain pools at Curve**

deBridge is a decentralized infrastructure that is fully composable with the existing DeFi ecosystem. That’s why we don’t need to do our own AMM or DEX, but just create different liquidity pools for deAssets in existing DEXes. In every blockchain supported by deBridge, there will be a liquidity pool for deUSDC at Curve or protocols that support the concept of the stable swap.

When the protocol is opened for the public and cross-chain swaps will be the first B2C application that will enable users to perform swaps from any asset on one chain to any asset on another.

To begin with, cross-chain swaps will be supported between the following chains: Arbitrum, Polygon, Ethereum.

Here are the instructions on how to deposit liquidity into the liquidity pool for each blockchain/L2.



### **Arbitrum deUSDC/2CRV pool**

This is a stablecoin pool at Curve that contains deUSDC (USDC bridged through deBridge) paired with 2CRV - Curve token that represents the basket of two stable coins (USDT+USDC)

In case you want to deposit $X amount of liquidity into this pool, please bridge half ($X/2) amount of USDC from Ethereum to Arbitrum through deBridge at https://debridge.finance/. The other half should be bridged through Arbitrum’s default bridge https://bridge.arbitrum.io/ in the form of USDT or USDC.

_Be aware that you will need to have some ETH on your wallet in Arbitrum in order to cover gas costs to broadcast the transaction._

Once you have deUSDC and USDC/USDT in your wallet balance on Arbitrum (you can check through https://arbiscan.io/), you can deposit the liquidity at Curve.

1. Go to the Curve website of the pool: https://arbitrum.curve.fi/factory/17/deposit&#x20;
2. Connect your wallet

![](<../.gitbook/assets/Screen Shot 2022-02-01 at 20.45.28.png>)

3\.  Deposit deUSDC and stable coins in a 1:1 ratio.

4\. Confirm transaction in your wallet.



### **Arbitrum deETH/ETH pool**

In case you want to deposit N amount of ETH into this pool, please bridge half (N/2) amount of ETH from Ethereum to Arbitrum through deBridge at https://debridge.finance/. The other half should be bridged through Arbitrum’s default bridge https://bridge.arbitrum.io/

Once you have deETH and ETH in your wallet balance on Arbitrum (you can check through https://arbiscan.io/), you can deposit the liquidity at Curve.

1. Go to the Curve website of the pool: https://arbitrum.curve.fi/factory/15/deposit.
2. Connect your wallet

![](<../.gitbook/assets/Screen Shot 2022-02-01 at 20.51.01.png>)

3\. Deposit deETH and ETH in a 1:1 ratio.

4\. Confirm transaction in your wallet.



### **Polygon deUSDC/am3CRV pool**

This is a stablecoin pool at Curve that contains deUSDC (USDC bridged through deBridge) paired with am3CRV - Curve token that represents the basket of two stable coins (USDT+USDC+DAI)

In case you’d like to deposit $X amount of liquidity into this pool, please bridge half ($X/2) amount of USDC from Ethereum to Polygon through deBridge at https://debridge.finance/. The other half should be bridged through Arbitrum’s default bridge https://wallet.polygon.technology/bridge/ ) in the form of USDT or USDC or DAI.

_Be aware that you will need to have some Matic in your wallet on Polygon in order to cover gas costs to broadcast the transaction._

Once you have deUSDC and USDC/USDT/DAI in your wallet balance on Polygon (you can check through https://polygonscan.com/), you can deposit the liquidity at Curve.

1. Go to the Curve website of the pool: https://polygon.curve.fi/factory/111/deposit&#x20;
2. Connect your wallet

![](<../.gitbook/assets/Screen Shot 2022-02-01 at 20.53.40.png>)

3\. Deposit deUSDC and stable coin in a 1:1 ratio.

4\. Confirm transaction in your wallet.

**Now all is done and liquidity will be used for all the cross-chain swaps 🚀**

