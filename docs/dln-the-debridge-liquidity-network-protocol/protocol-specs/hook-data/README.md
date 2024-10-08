# Hook data

Hooks are on-chain actions that can be optionally attached to an order upon its creation, and become the inseparable and cryptographically signed part of it, and are executed on the destination chain upon order fulfillment. An action can perform actions of any complexity, including operations on the outcome of the order.&#x20;

Orders are identified by [deterministic order ID](../deterministic-order-id.md), and the hash of the hook's raw data is essentially a part of this ID (see the last two fields of the [deterministic order ID reference](../deterministic-order-id.md)), so once a user signs-off an order with a hook, he eventually makes a cryptographic confirmation that he is willing to sell input asset for output asset AND execute a specific action along with the output asset on the destination chain.

The proper execution of the hook during order fulfillment is guaranteed by [`DlnDestination`](../../deployed-contracts.md) — the DLN smart contract responsible for filling orders, which ensures that the given hook along with other properties of the order actually match the given order ID. This means that trying to spoof a hook would lead to a different ID of a non-existent order, so the solver is compelled to pass a specific hook data, otherwise they would fill the non-existent order and eventually lose given funds forever.

The raw data itself is not generalized, which allows the implementations of the `DlnDestination` smart contract for different blockchain engines impose different and platform-specific requirements.

Further reading:

* [anatomy-of-a-hook-for-the-evm-based-chains.md](anatomy-of-a-hook-for-the-evm-based-chains.md "mention")
* [anatomy-of-a-hook-for-solana.md](anatomy-of-a-hook-for-solana.md "mention")

