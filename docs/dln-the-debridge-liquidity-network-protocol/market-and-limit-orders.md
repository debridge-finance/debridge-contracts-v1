# Market and Limit Orders

The main trade-off of the deBridge Liquidity Network design is that order execution is not guaranteed in advance, just as it is not guaranteed by classical bridges based on liquidity pools, where a transaction may fail in the destination chain if slippage exceeds the slippage tolerance specified by the sender.

With the deBridge Liquidity Network Protocol, a transaction can’t fail on the destination chain. An order is either fulfilled or not fulfilled, and if it’s not fulfilled, it means there is no taker willing to take the order. This may happen due to the following reasons:

* The order doesn’t generate sufficient profit for a taker. In this case, it’s a limit order that will be fulfilled as soon as market conditions will make it profitable
* The order bears certain systemic risks. The advantage of the deBridge Liquidity Network Protocol is that it allows risks to be dynamically priced. Takers may not be willing to fulfill orders coming from chains where exploit or ecosystem-level hacks have happened. In this case, takers will expect a bigger premium laid into the spread of the order so that additional risks are compensated

Users can place orders to exchange any assets at any price, but if the order premium covers all overhead costs for takers and brings them a profit, they are economically incentivized to fulfill the order as fast as possible. In this case, this is a market order that will be settled shortly.

To facilitate the creation of market orders, deBridge provides a [Quick Start Guide](interacting-with-the-api/the-lifecycle.md). Any integrator or an app can query the API in order to retrieve the recommended price for the order for their users and secure its immediate execution. The quote recommended by the API lays in a spread that includes a 4bps incentive for takers and covers overhead costs such as gas.

#### Joining the deBridge Liquidity Network Protocol as a Solver <a href="#joining-dln-as-taker" id="joining-dln-as-taker"></a>

Solvers perform active on-chain liquidity management by fulfilling limit orders created through DLN.

Check this Github Repository to learn more about how to get started as a Solver in DLN: [https://github.com/debridge-finance/dln-taker](https://github.com/debridge-finance/dln-taker)

Solvers don't need to lock liquidity into pools, they always maintain ownership over their funds and have the sole ability to fulfill limit orders they deem profitable.

#### Minimization of volatility risks for Solvers <a href="#minimization-of-volatility-risks-for-takers" id="minimization-of-volatility-risks-for-takers"></a>

To minimize price fluctuation risks for takers, all transactions formed through DLN API automatically route any swap through the paired asset (USDC or ETH). For example, if the user wants to exchange a token (e.g. AAVE on Ethereum) for another volatile token (e.g. Matic on Polygon), then DLN API will form the transaction data where AAVE is pre-swapped into USDC, and a USDC->Matic DLN order is created in the same transaction.

<figure><img src="../.gitbook/assets/Slide 16_9 - 10.png" alt=""><figcaption></figcaption></figure>

On the destination chain, solvers may hold USDC or ETH on a balance sheet of their on-chain addresses and swap their asset into the token requested in the order (e.g. MATIC), and fulfill it in the same transaction. When DlnDestination.sendUnlock() is called, the solver will receive the same paired asset (e.g. USDC) on the source chain, avoiding any price fluctuations of volatile assets.
