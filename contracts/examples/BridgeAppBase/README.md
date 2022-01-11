# Cross-Chain Application Base Contract Called from Other Chains

BridgeAppBase.sol is an abstract contract that allows setting chain_ids and addresses in other chains that can call its' methods.

# How to use BridgeAppBase

1. `yarn add @openzeppelin/contracts-upgradeable`
2. Copy ICallProxy from contracts/interfaces and IDeBridgeGate from contracts/examples
3. Copy contracts/libraries/Flags.sol
4. Copy contracts/examples/BridgeAppBase/BridgeAppBase.sol
5. Inherit BridgeAppBase.sol and create `send` and `onBridgedMessage` or similar functions you would like to use. 

**See [Incrementor.sol](https://github.com/debridge-finance/debridge-contracts-v1/tree/feature/l2base-example-contract/contracts/examples/Incrementor) smart contract as an example**
   - `onBridgedMessage` must have `onlyControllingAddress` modifier because otherwise it may be called by anyone through callProxy

In case you want to call another contract once cross-chain message is received, the following method can be used:
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
