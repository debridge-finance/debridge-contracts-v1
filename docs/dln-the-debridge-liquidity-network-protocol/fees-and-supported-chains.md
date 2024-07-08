# Fees and Supported Chains

## Fees and supported chains

deBridge charges a small fee when an order is created through `DlnSource` smart contracts. The fee is what users pay for confidence and decentralization. It consists of two parts:

* A flat fee is paid in the native gas token of the chain where the order is created
* A variable fee of 4bps is paid in the input token

| Chain (Chain id) | Chain Id  | Flat Fee   |
| ---------------- | --------- | ---------- |
| Arbitrum         | 42161     | 0.001 ETH  |
| Avalanche        | 43114     | 0.05 AVAX  |
| BNB Chain        | 56        | 0.005 BNB  |
| Ethereum         | 1         | 0.001 ETH  |
| Polygon          | 137       | 0.5 MATIC  |
| Solana           | 7565164   | 0.015 SOL  |
| Linea            | 59144     | 0.001 ETH  |
| Base             | 8453      | 0.001 ETH  |
| Optimism         | 10        | 0.001 ETH  |
| Neon             | 245022934 | 0.75 NEON  |
| Gnosis           | 100       | 1 xDAI     |
| Lightlink        | 1890      | 0.0005 ETH |
| Metis            | 1088      | 0.02 METIS |

The fee is fully refunded in case the limit order is canceled.

**Protocol fees can be changed. Hence, for any on-chain interactions with deBridge, fees must not be hardcoded but queried dynamically from the state of the DLN smart contract. Please refer to Estimating the order to learn how to query the actual flat fee from the smart contract.**
