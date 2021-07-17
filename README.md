# Debridge Smart Contracts

UI deployed on [testv2.debridge.finance](https://testv2.debridge.finance/)

The contracts directory contains the following subfolders:

```jsx
contracts/
	chainlink/ - related to chainlink integration
	interfaces/ - contains interfaces of the project contracts        
	mock/ - contracts for tests            
	oracles/ - related to oracle's stake management        
	periphery/ - periphery contracts
	transfers/ - related to core cross-chain functionality
```
A detailed description of each method of the smart contracts can be found in [documentation portal](https://docs.debridge.finance/smart-contracts/whitedebridge)

The full list of contracts:

- Aggregator
- WhiteLightAggregator
- WhiteFullAggregator
- WhiteLightVerifier
- GovToken
- DelegatedStaking
- CallProxy
- FeeProxy
- WrappedAsset
- DefiController
- Pausable
- WhiteDebridge
- WhiteFullDebridge
- WhiteLightDebridge

## Chainlink

**Aggregator**

The base contract for Chainlink oracles management. Allows to add/remove oracles, pay and withdraw oracles reward, manage the minimal required amount of confirmations and assign oracle admins.

**WhiteFullAggregator**         

Extends the **Aggregator** with confirmation-related methods; is deployed to the chain with low fees and is used to collect confirmations from oracles. 

**WhiteLightAggregator**

Extends the **Aggregator** with confirmation-related methods; is deployed to the chain with low fees and is used to collect signatures from oracles that confirm the transfers. 

**WhiteLightVerifier.sol**

Is deployed to the chain with high fees and is used to verify the transfer by oracles signatures. 

## Oracles

Contains variety of the contracts interfaces.

**DelegatedStaking**

Manages oracle and delegator stakes. Oracles are required to stake LINK token to be accepted as an oracle on aggregators.

**GovToken**

Governance token.

## Periphery

**WrappedAsset**

ERC20 token that is used as wrapped asset to represent the native token value on the other chains.

**DefiController**      

Mock contract responsible for using the asset from the Debridge contracts in other DeFi protocols to earn extra reward.

**FeeProxy** 

Helper to swap any token to Link.           ****

**CallProxy**           

Proxy to execute the other contract calls. This contract is used when the user requests transfer with specific call of other contract.  

**Pausable**

Helper for pausable contracts.

## Transfers

**WhiteDebridge**

Base contract for assets transfers. The admin manages the assets, fees and other important protocol parameters. The user can transfer the asset to any of the approved chains. 

**WhiteFullDebridge**

Extends **WhiteDebridge** with the implementation of transfer methods for chains with low fees.

**WhiteLightDebridge**

Extends **WhiteDebridge** with the implementation of transfer methods to blockchains with high transaction fees (e.g. transfers to Ethereum).

The detailed methods description can be found in the contracts themselves.


## How White Transfers Works

The transfer of the asset from chain A to chain B goes through the followed steps:

1. If the transfered asset isn't the native blockchain token (i.e ETH, BNB) the `approve` is done otherwise the transfered amount is attached to the next method.
2. The `send` method of `WhiteDebridge` contract is called. The `amount` of asset is locked on the contract, the fee is charged from the `amount` and the `Sent` event is emited.
3. The ChainLink nodes listen to the event on the `WhiteDebridge` contract and after 3 blocks confirmations submit the sent request identifier(`submissionId`) which is hash of concatination of `debridgeId`, `amount`, `receiver`, `nonce`. `DebridgeId` is hash of network id of the chain where the original token exists and token address on the original chain. The oracles are rewarded with LINKs immediatly after the submission.
4. After enough confirmations from Chainlink oracles (lets say 3 out of 5) the send request status becomes `confirmed`.
5. The user or any other party can call `mint` method of `WhiteDebridge` contract with the correct `debridgeId`, `amount`, `receiver`, `nonce` parameters that results into `submissionId`. If the submission is confirmed the wrapped asset is minted to the `receiver` address.

The transfer of the wrapped asset on chain B back to the original chain A to chain B goes through the followed steps:

1. The `approve` to spent the wrapped asset by `WhiteDebridge` is done.
2. The `burn` method of `WhiteDebridge` contract is called. The `amount` of the asset is burnt and the `Burnt` event is emited.
3. The ChainLink nodes listen to the event on the `WhiteDebridge` contract and after 3 blocks confirmations submit the burnt request identifier(`submissionId`) which is hash of concatination of `debridgeId`, `amount`, `receiver`, `nonce`. `DebridgeId` is hash of network id of the chain where the original token exists and token address on the original chain. The oracles are rewarded with LINKs immediatly after the submission.
4. After enough confirmations from Chainlink oracles (lets say 3 out of 5) the burnt request status becomes `confirmed`.
5. The user or any other party can call `claim` method of `WhiteDebridge` contract with the correct `debridgeId`, `amount`, `receiver`, `nonce` parameters that results into `submissionId`. If the submission is confirmed the fee is transfer fee is charged and original asset is sent to the `receiver` address.

**Note**: the chainlink node can only submit up to 32 bytes per one transaction to the chain that is why `debridgeId`, `amount`, `receiver`, `nonce` can't be submitted by the node in one transaction. To solve it the hash of the parameters is used.

## Aggregator

## Test

```
yarn start-ganache &
yarn test
```

# Ideas Backlog

- [ ] use assets in other protocols

- [ ] support NFT to make transfer fee lower
