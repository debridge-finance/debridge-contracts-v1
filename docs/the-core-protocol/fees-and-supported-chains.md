# Fees and supported chains

deBridge infrastructure takes a flat fee for each cross-chain message transfer, which users pay for decentralization and confidence since half of all fees will go as a reward to [deBridge validators](https://app.debridge.finance/validation-progress) who will be [financially liable](slashing-and-delegated-staking.md) for the proper operation of the protocol as liquid assets staked for them will act as protocol financial guarantees.&#x20;

The fee is paid in the blockchain's native (gas) token. For example, if the transfer is performed from the Ethereum chain, then the fixed ETH amount will be deducted from the user's wallet towards the protocol treasury on Ethereum.&#x20;

Fees paid for every sent message can be seen in [deBridge Explorer](https://app.debridge.finance/explorer) or retrieved from the state of the DebridgeGate smart contract (check [getting-started.md](../build-with-debridge/getting-started.md "mention")).&#x20;

{% hint style="warning" %}
deBridge flat fees can be changed by Governance. Hence, for any on-chain interactions with deBridge, fees **must not** be hardcoded but queried dynamically from the state of the DebridgeGate smart contract.
{% endhint %}

### Current flat fee for messages sent from different chains

<table><thead><tr><th>Chain</th><th width="123.33333333333331">Chain Id</th><th>Message Transfer Fee</th><th>Blocks finality</th></tr></thead><tbody><tr><td>Arbitrum</td><td>42161</td><td>0.001 ETH</td><td>12</td></tr><tr><td>Avalanche</td><td>43114</td><td>0.05 AVAX</td><td>12</td></tr><tr><td>BNB Chain</td><td>56</td><td>0.005 BNB</td><td>12</td></tr><tr><td>Ethereum</td><td>1</td><td>0.001 ETH</td><td>12</td></tr><tr><td>Polygon</td><td>137</td><td>0.5 MATIC</td><td>256</td></tr><tr><td>Fantom</td><td>250</td><td>4 FTM</td><td>12</td></tr><tr><td>Solana</td><td>7565164</td><td>0.03 SOL</td><td>Status Finalized</td></tr><tr><td>Linea</td><td>59144</td><td>0.001 ETH</td><td>12</td></tr><tr><td>Optimism</td><td>10</td><td>0.001 ETH</td><td>12</td></tr><tr><td>Base</td><td>8453</td><td>0.001 ETH</td><td>12</td></tr></tbody></table>
