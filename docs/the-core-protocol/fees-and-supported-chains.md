# Fees and supported chains

The protocol takes a small fee for each transfer of message performed through deBridge. A small flat fee is what users pay for confidence and decentralization since half of all fees will go as a reward to deBridge validators who will be [financially liable](slashing-and-delegated-staking.md) for the proper operation of the protocol as liquid assets staked for them will act as protocol financial guarantees.&#x20;

The fee is paid in the blockchain's native token. For example, if the transfer is performed from the Ethereum chain, then the fixed ETH amount will be deducted from the user's wallet towards the protocol treasury on Ethereum. The fee depends on the chain where the cross-chain transaction is initiated.&#x20;

Fees paid for every sent message can be seen in [deBridge explorer](https://app.debridge.finance/explorer) or retrieved from the state of the DebridgeGate smart contract (check [getting-started.md](../build-with-debridge/getting-started.md "mention")).&#x20;

{% hint style="warning" %}
deBridge flat fees can be changed by Governance. Hence, for any on-chain interactions with deBridge, fees **must not** be hardcoded but queried dynamically from the state of the DebridgeGate smart contract.
{% endhint %}

### Current flat fee for messages sent from different chains

| Arbitrum  | 42161   | 0.001 ETH |
| --------- | ------- | --------- |
| Avalanche | 43114   | 0.01 AVAX |
| BNB Chain | 56      | 0.005 BNB |
| Ethereum  | 1       | 0.001 ETH |
| Polygon   | 137     | 0.5 MATIC |
| Fantom    | 250     | 4 FTM     |
| Solana    | 7565164 | 0.03 SOL  |
