## Description
This example shows how to send a message between two chains using Incrementor.sol contract to increment a variable in this contract on a receiving chain 

## General steps
1. Copy L2Base using instruction in ../L2Base/README.md 
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

## Sending a message using example scripts
1. Add `networks` to your hardhat.config.ts, see hardhat.config.ts in this repo for reference
2. Deploy
```shell
yarn hardhat run --network bsctest contracts/examples/Incrementor/scripts/deploy.ts
yarn hardhat run --network kovan contracts/examples/Incrementor/scripts/deploy.ts
```
3. Update addresses (INCREMENTOR_ADDRESS_ON_*) in constants.ts to `Incrementor proxy` addresses (will be printed in console)
4. Verify (optional)
   - Add `import "@nomiclabs/hardhat-etherscan";` to your hardhat.config.ts, install it if it's not installed
   - IMPLEMENTATION_ADDRESS is `Incrementor implementation` printed in console
   ```shell
   ETHERSCAN_API_KEY=YOUR_KEY yarn hardhat verify --show-stack-traces --network bsctest IMPLEMENTATION_ADDRESS 
   ETHERSCAN_API_KEY=YOUR_KEY yarn hardhat verify --show-stack-traces --network kovan IMPLEMENTATION_ADDRESS
   ```
5. Let both contracts know about each other
   ```shell
   yarn hardhat run --network bsctest contracts/examples/Incrementor/scripts/setContractAddressOnChainId.ts
   yarn hardhat run --network kovan contracts/examples/Incrementor/scripts/addControllingAddress.ts
   ```
6. Send
   ```shell
   yarn hardhat run --network bsctest contracts/examples/Incrementor/scripts/send.ts
   ```
7. Use printed submission id to track execution
8. Verify that claimedTimes is incremented 
   ```shell
   yarn hardhat run --network kovan contracts/examples/Incrementor/scripts/getClaimedTimesOnReceivingChain.ts
   ```
   
# Sending a cross-chain Message using the example of an already deployed contract

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
