# Protocol Overview

deBridge uses a high-performance cross-chain trading infrastructure that consists of two layers:

* Protocol layer: on-chain smart contracts
* Infrastructure layer: solvers who perform off-chain matching and on-chain settlement of trades

The deBridge Liquidity Network Protocol is represented by a set of smart contracts that can be called by any on-chain address to create limit orders for cross-chain trades. When an order is created, the Maker provides a specific amount of an input token on the source chain and specifies the parameters of the order, such as the token address and the amount he accepts to receive in the destination chain.&#x20;

The given amount is then temporarily locked by the DLN smart contract on the source chain, and any on-chain address (named a **solver**) with sufficient liquidity in the destination chain can attempt to fulfill the order by calling the corresponding method of DLN smart contract and supplying the liquidity as requested by the maker in the DLN order parameters. After the order is fulfilled, a solver initiates a cross-chain message to be sent by the DLN smart contract to the source chain via the deBridge messaging protocol. When the message is delivered, it unlocks the funds on the source chain to the solver’s address, effectively completing the order. Below is a graphic outlining the process:

<figure><img src="../.gitbook/assets/Slide 16_9 - 12.png" alt=""><figcaption></figcaption></figure>

Order Creation

Specifically, there are two contracts deployed per supported chain: the `DlnSource` and the `DlnDestination` contracts. Whenever a maker decides to trade liquidity, it places an order by calling the `DlnSource.createOrder()` method on the source chain, providing the typed structure with precise requirements, specifically: the destination chain id, the address of a token, and the amount they expect to receive, the address of the receiver where the requested tokens should be sent to on the destination chain, and other system parameters. The smart contract assigns a unique identifier (hash) to the order, made of the values of its typed structure including the maker-specific determinants (address and nonce). The given amount of input token is taken from the user by the DlnSource contract and locked until the order is either unlocked or canceled, which can happen only through the DlnDestination smart contract on the destination chain.

<figure><img src="../.gitbook/assets/Slide 16_9 - 11.png" alt=""><figcaption></figcaption></figure>

#### Order fulfillment <a href="#order-fulfillment" id="order-fulfillment"></a>

Solvers perform off-chain tracking of all orders created through DlnSource smart contract, and whenever an order meets the solver's requirements (for example, the profitability, the margin, or even if the input token is whitelisted), they can attempt to fulfill the order by calling the `DlnDestination.fulfillOrder()` on the destination chain, supplying the amount of tokens requested in the order, and the typed structure representing the order placed on the source chain and order Id. At this point, no cross-chain communication is performed. The DlnDestination contract relies on the fact that the given order being placed on another chain can only be handled once on the destination chain, so it calculates the order identifier (hash) using the values from the given structure. It then checks that it matches the order Id passed by the solver and if the order status hasn’t been assigned as fulfilled or canceled. The smart contract processes the order by pulling the necessary amount of requested tokens from the solver and sending it to the receiver address, finally assigning ‘fulfilled status’ to the order.

<figure><img src="../.gitbook/assets/Slide 16_9 - 8.png" alt=""><figcaption></figcaption></figure>

If the order generates some profit for the one who fulfills it, then solvers will have fair competition for its fulfillment. For example, an order to exchange 1000 USDC on BNB Chain for 990 USDC on Solana will bring 10 USDC profit to the solver that is the first to fulfill the order. Solvers are free to set their own requirements for transaction finality on the source chain. For example, solvers with an aggressive risk profile may decide to fulfill orders after one block confirmation and try to replay the maker’s transaction in case a reorg of the source chain happens after the order is fulfilled on the destination chain.

#### Unlocking fulfilled orders <a href="#unlocking-fulfilled-orders" id="unlocking-fulfilled-orders"></a>

The first solver that manages to change the status of the order in the DlnDestination smart contract to Fulfilled, gets the ability to call `DlnDestination.sendUnlock()`method which sends a cross-chain message through deBridge infrastructure to the DlnSource smart contract on the source chain. This message encodes a command to unlock funds initially locked for the given order identifier, and sends them to the address specified by the solver.



<figure><img src="../.gitbook/assets/Slide 16_9 - 9.png" alt=""><figcaption></figcaption></figure>

When the DlnSource smart contract receives a message, before executing the command, it checks the identity of the message sender (address and chain id), to make sure it matches the identity of the DlnDestination smart contract stored in its state.

If a maker decides to cancel their order, it must use a similar flow, and call the `DlnDestination.sendCancel()` method which will succeed only if the order is neither at the ‘fulfilled’ nor ‘canceled’ status. This method makes the smart contract send a cross-chain message to the DlnSource contract that encodes a command to unlock funds to the maker's address and change the order status to ‘canceled’. In this case, the DlnDestination contract on the destination chain acts as a source of trust for the propagation of the order status and sending corresponding commands.

Note: In the lifecycle of an order, cross-chain communication (messaging) is only needed once the order has achieved its final status on the destination chain. This is so the DlnDestination smart contract can send a command to the DlnSource to unlock the order’s liquidity to the solver's address (in case of fulfillment) or to the maker address (in case of cancellation). When a cross-chain message is transferred through the deBridge infrastructure, strict finality requirements are applied before the message is signed by validators. The number of required block confirmations needed for each chain can be found [here](../the-debridge-messaging-protocol/fees-and-supported-chains.md).

### Risk distribution <a href="#risk-distribution" id="risk-distribution"></a>

Since the protocol doesn’t have any continuously locked liquidity, all DLN participants bear risks asynchronously. Makers bear the risk of cross-chain infrastructure only during the short time span from the moment an order has been created, until the moment when the order is fulfilled on the destination chain, which is typically an extremely short time period of seconds.

Solvers bear risks only from the moment an order has been fulfilled, until the moment when the liquidity is unlocked on the source chain. These risks consist of two components:

* The risk of order reversal due to source chain reorganization or fork. This risk is taken by solvers consciously, and is controlled by setting requirements for transaction finality: they fulfill orders only after the number of block confirmations in the source chain aligns with their risk profile. For example, a solver may execute small orders as soon as they appear on the source chain, but wait for extra block confirmations in the case of an exceptionally large order; more complex rules can be applied to meet the needs of solvers. This also creates the potential to compete for orders that are not yet broadcasted, fulfilling them even BEFORE they are included on the source blockchain, which is a win-win case: users get to receive the exact amount of funds they have requested quickly, and professional market makers take profits according to their risk profiles without affecting users.
* Risk of the cross-chain messaging infrastructure. The collusion of consensus participants is a trade-off that is born by all interoperability solutions without exception. The deBridge messaging infrastructure has a [delegated staking and slashing](../the-debridge-messaging-protocol/slashing-and-delegated-staking.md) module as part of the protocol design which prevents any theoretical collusion of validators.

<figure><img src="../.gitbook/assets/Header (3).png" alt=""><figcaption></figcaption></figure>
