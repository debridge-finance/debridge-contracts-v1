# Fees and supported chains

deBridge infrastructure takes a flat fee for each cross-chain message transfer, which users pay for decentralization and confidence since half of all fees will go as a reward to [deBridge validators](https://app.debridge.finance/validation-progress) who will be [financially liable](slashing-and-delegated-staking.md) for the proper operation of the protocol as liquid assets staked for them will act as protocol financial guarantees.&#x20;

The fee is paid in the blockchain's native (gas) token. For example, if the transfer is performed from the Ethereum chain, then the fixed ETH amount will be deducted from the user's wallet towards the protocol treasury on Ethereum.&#x20;

Fees paid for every sent message can be seen in [deBridge Explorer](https://app.debridge.finance/explorer) or retrieved from the state of the DebridgeGate smart contract (check [getting-started.md](../build-with-debridge/getting-started.md "mention")).&#x20;

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
