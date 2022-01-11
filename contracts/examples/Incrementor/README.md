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

   IMPLEMENTATION_ADDRESS is `Incrementor implementation` printed in console
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