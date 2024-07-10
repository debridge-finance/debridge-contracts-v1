# Table of contents

* [Introduction](README.md)

## The deBridge Messaging Protocol

* [Protocol Overview](the-debridge-messaging-protocol/protocol-overview.md)
* [Fees and Supported Chains](the-debridge-messaging-protocol/fees-and-supported-chains.md)
* [🟢 Deployed Contracts](the-debridge-messaging-protocol/deployed-contracts.md)
* [Development Guides](the-debridge-messaging-protocol/development-guides/README.md)
  * [Building an EVM-based dApp](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/README.md)
    * [EVM smart contract interfaces](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/README.md)
      * [Interfaces](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/interfaces/README.md)
        * [ICallProxy](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/interfaces/icallproxy.md)
        * [IDeBridgeGate](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/interfaces/idebridgegate.md)
        * [IDeBridgeToken](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/interfaces/idebridgetoken.md)
        * [IDeBridgeTokenDeployer](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/interfaces/idebridgetokendeployer.md)
        * [IOraclesManager](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/interfaces/ioraclesmanager.md)
        * [ISignatureVerifier](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/interfaces/isignatureverifier.md)
        * [IWethGate](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/interfaces/iwethgate.md)
      * [Libraries](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/libraries/README.md)
        * [Flags](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/libraries/flags.md)
      * [Periphery](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/periphery/README.md)
        * [CallProxy](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/periphery/callproxy.md)
        * [DeBridgeToken](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/periphery/debridgetoken.md)
        * [DeBridgeTokenProxy](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/periphery/debridgetokenproxy.md)
        * [SimpleFeeProxy](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/periphery/simplefeeproxy.md)
      * [Transfers](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/transfers/README.md)
        * [DeBridgeGate](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/transfers/debridgegate.md)
        * [DeBridgeTokenDeployer](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/transfers/debridgetokendeployer.md)
        * [OraclesManager](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/transfers/oraclesmanager.md)
        * [SignatureVerifier](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/transfers/signatureverifier.md)
        * [WethGate](the-debridge-messaging-protocol/development-guides/building-an-evm-based-dapp/evm-smart-contract-interfaces/transfers/wethgate.md)
  * [Sending cross-chain messages from Solana](the-debridge-messaging-protocol/development-guides/sending-cross-chain-messages-from-solana/README.md)
    * [On-Chain external call preparation for Solana](the-debridge-messaging-protocol/development-guides/sending-cross-chain-messages-from-solana/on-chain-external-call-preparation-for-solana.md)
    * [Off-chain external call preparation for Solana](the-debridge-messaging-protocol/development-guides/sending-cross-chain-messages-from-solana/off-chain-external-call-preparation-for-solana.md)
  * [Lifecycle of a cross-chain call](the-debridge-messaging-protocol/development-guides/lifecycle-of-a-cross-chain-call.md)
  * [Gathering data for the claim](the-debridge-messaging-protocol/development-guides/gathering-data-for-the-claim.md)
* [Development Tools](the-debridge-messaging-protocol/development-tools.md)
* [Security](the-debridge-messaging-protocol/security.md)
* [Slashing and Delegated Staking](the-debridge-messaging-protocol/slashing-and-delegated-staking.md)

## 🔁 DLN: The deBridge Liquidity Network Protocol

* [Introduction](dln-the-debridge-liquidity-network-protocol/introduction.md)
* [Protocol Overview](dln-the-debridge-liquidity-network-protocol/protocol-overview.md)
* [Fees and Supported Chains](dln-the-debridge-liquidity-network-protocol/fees-and-supported-chains.md)
* [🟢 Deployed Contracts](dln-the-debridge-liquidity-network-protocol/deployed-contracts.md)
* [Market and Limit Orders](dln-the-debridge-liquidity-network-protocol/market-and-limit-orders.md)
* [Interacting with smart contracts](dln-the-debridge-liquidity-network-protocol/interacting-with-smart-contracts/README.md)
  * [Introduction](dln-the-debridge-liquidity-network-protocol/interacting-with-smart-contracts/introduction.md)
  * [Placing orders](dln-the-debridge-liquidity-network-protocol/interacting-with-smart-contracts/placing-orders.md)
  * [Filling orders](dln-the-debridge-liquidity-network-protocol/interacting-with-smart-contracts/filling-orders.md)
  * [Withdrawing Affiliate Fees](dln-the-debridge-liquidity-network-protocol/interacting-with-smart-contracts/withdrawing-affiliate-fees.md)
  * [Creating Calldata for Solana](dln-the-debridge-liquidity-network-protocol/interacting-with-smart-contracts/creating-calldata-for-solana.md)
* [Interacting with the API](dln-the-debridge-liquidity-network-protocol/interacting-with-the-api/README.md)
  * [Authentication](dln-the-debridge-liquidity-network-protocol/interacting-with-the-api/authentication.md)
  * [The lifecycle](dln-the-debridge-liquidity-network-protocol/interacting-with-the-api/the-lifecycle.md)
  * [Requesting Order Creation Transaction](dln-the-debridge-liquidity-network-protocol/interacting-with-the-api/requesting-order-creation-transaction.md)
  * [Submitting an Order Creation Transaction](dln-the-debridge-liquidity-network-protocol/interacting-with-the-api/submitting-an-order-creation-transaction.md)
  * [Tracking a Status of the Order](dln-the-debridge-liquidity-network-protocol/interacting-with-the-api/tracking-a-status-of-the-order.md)
  * [Cancelling the Order](dln-the-debridge-liquidity-network-protocol/interacting-with-the-api/cancelling-the-order.md)
  * [Affiliate fees](dln-the-debridge-liquidity-network-protocol/interacting-with-the-api/affiliate-fees.md)
* [Interacting with the deBridge App](dln-the-debridge-liquidity-network-protocol/interacting-with-the-debridge-app/README.md)
  * [Custom Linking](dln-the-debridge-liquidity-network-protocol/interacting-with-the-debridge-app/custom-linking.md)
* [deBridge Widget](dln-the-debridge-liquidity-network-protocol/debridge-widget.md)

## 💸 dePort

* [Getting started](deport/getting-started.md)
* [Transfers Flow](the-core-protocol/transfers.md)

## ⚡ deBridge Points

* [Referrers Overview](debridge-points/referrers-overview.md)
* [Integrators Overview](debridge-points/integrators-overview.md)

## 🌐 deBridge IaaS

* [Getting started](debridge-iaas/getting-started.md)

## External Links

* [deBridge Use Cases](external-links/debridge-use-cases.md)
  * [💡 Examples](external-links/debridge-use-cases/examples.md)
* [Talks, Videos, and Articles](talks-and-videos.md)
* [Website](https://debridge.finance)
* [Github](https://github.com/debridge-finance)
* [Twitter](https://twitter.com/deBridgeFinance)
* [Social channels](external-links/social-channels/README.md)
  * [Discord](https://discord.gg/debridge)
  * [Facebook](https://www.facebook.com/deBridgeFinance)
  * [LinkedIn](https://www.linkedin.com/company/debridge-finance)
  * [Medium](https://debridge.medium.com)
  * [Telegram](https://t.me/deBridge\_finance)
  * [YouTube](https://www.youtube.com/channel/UCtafhZxGqbjd\_cJR6rVLz0A)
