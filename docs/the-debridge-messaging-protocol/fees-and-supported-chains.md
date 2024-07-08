# Fees and Supported Chains

deBridge takes a flat fee for each cross-chain message transfer, which users pay for decentralization and confidence since half of all fees will go as a reward to [deBridge validators](https://app.debridge.finance/validation-progress) who will be [financially liable](https://docs.debridge.finance/the-core-protocol/slashing-and-delegated-staking) for the proper operation of the protocol as liquid assets staked for them will act as protocol financial guarantees.

The fee is paid in the blockchain's native (gas) token. For example, if the transfer is performed from the Ethereum chain, then the fixed ETH amount will be deducted from the user's wallet towards the protocol treasury on Ethereum.

Fees paid for every sent message can be seen in [deBridge Explorer](https://app.debridge.finance/explorer) or retrieved from the state of the DebridgeGate smart contract (check [Getting started](https://docs.debridge.finance/build-with-debridge/getting-started)).

{% hint style="info" %}
deBridge flat fees can be changed by governance. Hence, for any on-chain interactions with deBridge, fees **must not** be hardcoded but queried dynamically from the state of the DebridgeGate smart contract.
{% endhint %}

### Current flat fee for messages sent from different chains <a href="#current-flat-fee-for-messages-sent-from-different-chains" id="current-flat-fee-for-messages-sent-from-different-chains"></a>

| Chain     | Chain Id  | Message Transfer Fee | Block finality   |
| --------- | --------- | -------------------- | ---------------- |
| Arbitrum  | 42161     | 0.001 ETH            | 12               |
| Avalanche | 43114     | 0.05 AVAX            | 12               |
| BNB Chain | 56        | 0.005 BNB            | 12               |
| Ethereum  | 1         | 0.001 ETH            | 12               |
| Polygon   | 137       | 0.5 MATIC            | 256              |
| Fantom    | 250       | 4 FTM                | 12               |
| Solana    | 7565164   | 0.03 SOL             | Status Finalized |
| Linea     | 59144     | 0.001 ETH            | 12               |
| Optimism  | 10        | 0.001 ETH            | 12               |
| Base      | 8453      | 0.001 ETH            | 12               |
| Neon      | 245022934 | 0.75 NEON            | 32               |
| Gnosis    | 100       | 1 xDAI               | 12               |
| Lightlink | 1890      | 0.0005 ETH           | 12               |
| Metis     | 1088      | 0.02 METIS           | 12               |

