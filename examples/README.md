<br/>
<p align="center">
<a href="https://debridge.finance/" target="_blank">
<img src="https://user-images.githubusercontent.com/10200871/137014801-40decb80-0595-4f0f-8ee5-f0f1ab5c0380.png" width="225" alt="logo">
</a>
</p>
<br/>

[deBridge](https://debridge.finance/) — cross-chain interoperability
 and liquidity transfer protocol that allows the truly decentralized transfer of data and assets between various blockchains.

## Demo Scripts of Interaction with deBridge Protocol

This repository demonstrates how to interact with deBridge infrastructure in order to send arbitrary data and liquidity between any blockchains supported by the protocol.

In order to run scripts please configure your local environment first:

1. ```yarn install``` <br />
2. Configure .env file — copy values from .env.testnet or .env.mainnet for the testnet and mainnet environments respectively. You may copy them to .env either in top-level or inside this dir

### Sending of the Base Asset

execute ```yarn ts-node examples/src/sendScripts/sendETH.ts``` to send the base asset of the blockchain where the transaction is initiated.

You will see the following output:
![telegram-cloud-photo-size-2-5384605653412199381-y](https://user-images.githubusercontent.com/10200871/148461193-b7039b8f-99f9-4d61-8fd8-69d08a44a566.jpg)

Please note  the resulted `SubmissionID` which will be needed during the claim step

### Sending of the ERC-20 token

execute ```yarn ts-node examples/src/sendScripts/sendETH.ts``` to send ERC-20 token

Please note the resulted `SubmissionID` which will be needed during the claim step

### Track Status of the Cross-Chain Transactions
deBridge provides an explorer that allows tracking the status of all cross-chain transactions that pass through the protocol. Just put in txId in the search bar in order to see your transaction details

#### Links to the explorer:
**Testnet:** https://testnet-explorer.debridge.finance/

**Mainnet:** https://mainnet-explorer.debridge.finance/

### Claim transaction in the destination chain
The protocol implements [locking and minting](https://docs.debridge.finance/the-core-protocol/protocol-overview#naming) mechanics and guarantees that all wrapped assets (deAssets) are 1:1 backed by the collateral locked in the native chain of each respective asset

In order to have the transaction executed in the target chain, it should be claimed by passing all parameters of the transaction alongside signatures of submissionId from all deBridge validators. 

In order to claim transaction execute
```yarn ts-node examples/src/sendScripts/calim.ts [submissionId]```


# [BridgeAppBase.sol](/contracts/examples/BridgeAppBase.sol) — cross-chain application base contract called from other chains

BridgeAppBase.sol is an abstract contract that allows setting chain_ids and addresses in other chains that can call its' methods. This base contract allows the implementation of different cross-chain intercommunication scenarios

### How to use
1. Copy ICallProxy from contracts/interfaces and IDeBridgeGate from contracts/examples
2. Copy contracts/libraries/Flags.sol
3. Copy contracts/examples/BridgeAppBase/BridgeAppBase.sol
4. Inherit BridgeAppBase.sol and create `send` and `onBridgedMessage` or similar functions you would like to use.

**See `Incrementor.sol` smart contract below as an example**
- `onBridgedMessage` must have `onlyControllingAddress` modifier because otherwise it may be called by anyone through callProxy

In case it's needed to call another smart contract once cross-chain message is received, the following method can be used:
```solidity
    /// @param data Encoded receiver + dataToPassToReceiver
    function onBridgedMessage (
        bytes calldata data
    ) external payable virtual onlyControllingAddress whenNotPaused returns (bool)
    {
         (address receiver, bytes memory dataToPassToReceiver) = abi.decode(
             data,
             (address, bytes)
         );

         (bool result,) = receiver.call{value: msg.value}(dataToPassToReceiver);
         return result;
    }
```

## [Incrementor.sol](/contracts/examples/Incrementor.sol) — an example contract that extends BridgeAppBase

### Description
This example shows how to send a message between two chains using Incrementor.sol contract to increment a variable in this contract on a receiving chain

### General steps
1. Copy BridgeAppBase using instruction above
2. Copy this contract, Incrementor.sol
3. Deploy Incrementor on two chains
4. Call setContractAddressOnChainId on sending chain with
 - `_address` set to the contract address on the receiving chain
 - `__chainIdTo` set to the receiving chain id
5. Call addControllingAddress on receiving chain with
 - `_nativeSender` set to the contract address on the sending chain
 - `_chainIdFrom` set to the sending chain id
6. Call Incrementor.send on sending chain
 - _data will be ignored, so you may set any value, for example empty string ""
7. Wait for the message to go through the bridge and for execution on https://testnet-explorer.debridge.finance/explorer
8. Check that claimTimes is incremented

### Sending a message using example scripts
1. Add `networks` to your hardhat.config.ts, see hardhat.config.ts in this repo for reference
2. Deploy
```shell
yarn hardhat run --network bsctest examples/src/incrementorScripts/deploy.ts
yarn hardhat run --network kovan examples/src/incrementorScripts/deploy.ts
```
3. Update addresses (INCREMENTOR_ADDRESS_ON_*) in constants.ts to `Incrementor proxy` addresses (will be printed in console)
4. Verify (optional)
 - Add `import "@nomiclabs/hardhat-etherscan";` to your hardhat.config.ts, install it if it's not installed
 - Also add this line
    ```typescript
    etherscan: { apiKey: process.env.ETHERSCAN_API_KEY }
    ```
 - IMPLEMENTATION_ADDRESS is `Incrementor implementation` printed in console
   ```shell
   ETHERSCAN_API_KEY=YOUR_KEY yarn hardhat verify --show-stack-traces --network bsctest IMPLEMENTATION_ADDRESS 
   ETHERSCAN_API_KEY=YOUR_KEY yarn hardhat verify --show-stack-traces --network kovan IMPLEMENTATION_ADDRESS
   ```
5. Let both contracts know about each other
   ```shell
   yarn hardhat run --network bsctest examples/src/incrementorScripts/setContractAddressOnChainId.ts
   yarn hardhat run --network kovan examples/src/incrementorScripts/addControllingAddress.ts
   ```
6. Send
   ```shell
   yarn hardhat run --network bsctest examples/src/incrementorScripts/send.ts
   ```
7. Use printed submission id to track execution
8. Verify that claimedTimes is incremented
   ```shell
   yarn hardhat run --network kovan examples/src/incrementorScripts/getClaimedTimesOnReceivingChain.ts
   ```

### Sending a cross-chain Message using the example of an already deployed contract

This example shows how to send a message between two chains using Incrementor.sol contract to increment a variable in this contract on a receiving chain

[Here](https://testnet.bscscan.com/address/0x375675FD702DAeeD35AEBc4fe613D3b088571644#writeProxyContract) you can find an instance of the Incrementor smart contract deployed in BSC testnet.
In order to see how cross-chain messaging is working in practice, `send` method of the smart contract can be called directly from Bscscan interface:
![](https://i.imgur.com/OgEejAD.png)

The source code of send method:
![](https://i.imgur.com/IYT3xCJ.png)

[Here is](https://testnet.bscscan.com/tx/0x0a9adff4ab95fe749668df61f9e124339aa36bd52344e17331f5402dd02de243) example of the `send` transaction in Bscscan.
Same transaction can be found by txid in [deBridge explorer](
https://testnet.debridge.finance/transaction?tx=0x0a9adff4ab95fe749668df61f9e124339aa36bd52344e17331f5402dd02de243&chainId=97)
In case the execution fee was set, keepers will automatically claim your transaction in the destination chain:
![](https://i.imgur.com/G3c55qO.png)

The result of the state changed due to cross-chain interaction can be observed through [Tenderly](https://dashboard.tenderly.co/tx/kovan/0xe90638fe5d30693b6d3b0f2aa077424dc285619b852d6c844be0c08f18687458/state-diff). The one can see that claimedTimes variable was incremented as a result of the cross-chain call:
![](https://i.imgur.com/Djl5kbh.png)

The method of the smart contract that was executed as a result of cross-chain call:
![](https://i.imgur.com/61uRSXD.png)

Feel free to reach out to us in the #developer channel of [Discord](http://discord.gg/debridge) to ask any questions.
