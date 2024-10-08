---
description: >-
  DLN Hooks is a core feature of the DLN protocol that allows users, protocols
  and market makers to attach arbitrary on-chain actions to the orders that
  would get executed upon their fulfillment.
---

# DLN Hooks

The DLN protocol allows users to place cross-chain orders with an arbitrary on-chain action attached as an inseparable part of it, enabling cryptographically signed operations to be performed on the destination chain upon order fulfillment.

An action itself — called _a hook_ — is a raw destination chain-specific data, that represents either an instruction (or a set of instructions) to be executed on Solana, or a hook enriched with a custom payload, or even a transaction call to be executed on a EVM-based chain. A hook can perform actions of any complexity, including operations on the outcome of the order. This effectively enriches the interactions between users and protocols, enabling cross-chain communications that were not possible before. A few possible use cases:

* **asset distribution**: one can place a cross-chain order that buys an asset and immediately distributes it across a set of addresses;
* **blockchain abstraction**: a dApp can place a cross-chain order that buys an asset and deposits it onto the staking protocol on behalf of a signing user;
* **user onboarding**: a service can place a cross-chain order (from a user's familiar blockchain to a blockchain a user has not tried before) that buys a stable coin and tops up user's wallet with a small amount of native blockchain currency to enable the user to start submitting transactions right away;
* **action triggers**: a cross-chain order could trigger conditional actions that emit events, change state, even to prevent an order from being filled;
* and anything else you might thought about!

Additionally, a hook is bundled with a bunch of properties (a hook metadata) that define hook behaviour.

***

### Hooks are a part of an order

Orders are identified by [deterministic order ID](protocol-specs/deterministic-order-id.md), and the hash of the hook's raw data is essentially a part of this ID (see the last two fields of the [deterministic order ID reference](protocol-specs/deterministic-order-id.md)), so once a user signs-off an order with a hook, he eventually makes a cryptographic confirmation that he is willing to sell input asset for output asset AND execute a specific action along with the output asset on the destination chain.

The proper execution of the hook during order fulfillment is guaranteed by [`DlnDestination`](deployed-contracts.md) — the DLN smart contract responsible for filling orders, which ensures that the given hook along with other properties of the order actually match the given order ID. This means that trying to spoof a hook would lead to a different ID of a non-existent order, so the solver is compelled to pass a specific hook data.

### Hooks are trustless

DLN is an open market, so anyone can place arbitrary orders (even non-profitable, or having fake hooks), and anyone with available liquidity can be a solver and fill any open order. The  [`DlnDestination`](deployed-contracts.md) smart contract simply ensures that requested amount is provided in full and further forwarded either to the recipient or to a hook's target (via the [`DlnExternalCallAdapter`](deployed-contracts.md) smart contract). This means that a hook's target should be designed with an assumption that anyone can place and fill arbitrary orders with arbitrary hooks, and thus never expose permissions only on the fact that the caller is a trusted DLN contract, because the DLN contract here is only an intermediary, not a guard.

### Hooks atomicity

Even though hooks are an inseparable part of DLN orders, their execution scenario is a matter of hook configuration.&#x20;

Hooks can be **success-required** and **optional-success**:

* **success-required hooks** ARE REQUIRED to finish successfully. If the hook gets reverted, entire transaction gets reverted as well, which is guaranteed by the DLN smart contract.&#x20;
* **optional-success hooks** ARE ALLOWED to fail. In the event of failure, the DLN smart contract would send the order's outcome further to the **fallback address** specified as a part of a hook envelope.

Hooks can be atomic and non-atomic:&#x20;

* **atomic hooks** ARE REQUIRED be executed atomically along with the order fulfillment. In other words, the order with such hook is either filled and the hook is executed, or not at all. Mind that if the hook is an **success-required hook** and it fails, the entire order would not get filled, and the order's authority would need to cancel the order. If the hook an **optional-success hook** and it fails, then the order would get filled, and the order's outcome would get sent further to the **fallback address** specified as a part of a hook envelope.
* **non-atomic hooks** ARE ALLOWED (but not required) to be executed later, which is up to the solver who fills the order. If the solver fills the order but does not execute a hook, the order is marked is filled, but its outcome is stored securely in the DLN intermediary contract along with the hook, waiting until anyone (a trustless third party, like a solver) initiates a transaction to execute the hook, OR until the trusted authority of an order on the destination chain cancels the hook to receive the order's outcome in full.

Smart contracts on the EVM-based chains support all options above. Smart contracts on Solana only support **non-atomic** **success-required hooks** due to limitations of this platform.

### Hook cancellation policy

Even though hooks are indivisible part of orders placed onto DLN, their execution and cancellation flow may vary.

Atomic hooks are executed along with an order fulfillment, so they either succeed, or silently fail (if they are **optional-success hooks**), or revert and prevent the order from getting filled (if they are **success-required hooks**). In the worst case scenario, when they get reverted, the trusted authority of an order in the destination chain may only cancel entire order.

Non-atomic hooks are allowed to be executed later in a separate transaction after an order gets filled. In this case, the hook (along with the outcome of an order) remains pending execution in the intermediary smart contract, and the trusted authority of an order on the destination chain may cancel the hook and receive the order's outcome in full.

### Who pays for hook execution?

Submitting a transaction to execute a hook implies paying a transaction fee. The DLN Hooks engine provides two distinct ways to incentivize solvers and other trustless third parties to submit transactions to execute hooks.

The most straightforward way to cover hook execution is to lay the cost in the spread of an order: say, there is an order to sell 105 USDC on Solana and buy 100 USDC on Ethereum with a hook that deposits the bought amount to the LP: in this case, the difference between sell amount and buy amount (5 USDC) must cover all the fees and costs, including the cost of this hook execution. This is the preferred approach for **atomic hooks** that target **EVM-based chains**, because in this case the hook is the part of the execution flow of a transaction that fills the order.&#x20;

Additionally, a hook metadata may explicitly define a reward that the DLN Hooks engine contract should cut off an order outcome (before the outcome is transferred to a hook) in favor of a solver who pays for a transaction: for example, there could be an order to sell 106 USDC on Ethereum, buy 101 USDC on Solana with a hook that deposits exactly 100 USDC to the LP and leaves 1 USDC as a reward. This approach works for non-atomic hooks, and the smart contract guarantees that a solver would get exactly the specified amount of the outcome.

The DLN API simplifies a hook's cost estimation by automatically simulating transaction upon order creation.

### Common pitfalls

A common source of frustration is a blockchain where a hook is expected to run: hooks are built for destination chains. For example, an order that sells SOL on Solana and buys ETH on Ethereum would get placed on Solana with the hook data encoded specifically for EVM, and vice versa.

Atomic **success-required hooks** that get reverted would prevent their orders from getting fulfilled, causing users' funds to stuck, which would require users to initiate [a cancellation procedure](interacting-with-the-api/cancelling-the-order.md). This increases friction and worsens overall user experience, so it is advised to carefully test hooks and estimate potential fulfillments prior placing orders with such hooks. The API [takes the burden](interacting-with-the-api/integrating-dln-hooks/) of proper hook data validation, encoding, and hook simulation, ensuring that an order could get filled on the destination chain.&#x20;

### Examples

* [Order from Ethereum to Solana](https://app.debridge.finance/order?orderId=0xd78af2a21f4c7dc1fb11e85fff608739d8af167b4ff91b03bc3a097822fcc966) with a non-atomic hook
* [Order from Ethereum to Polygon](https://app.debridge.finance/order?orderId=0x401c8eb93a1358bbe2924e98446ed35fbb73dabd638aa183de3aca0af2582a40) with an atomic success-required hook

### Availability

DLN Hooks are available on all supported blockchains. Hooks can be encoded programmatically while interacting directly with smart contracts, or passed to the DLN API via a simple high level interface.

Further reading:

* Easy usage with the DLN API: [integrating-dln-hooks](interacting-with-the-api/integrating-dln-hooks/ "mention")
* Technical specification: [hook-data](protocol-specs/hook-data/ "mention")
