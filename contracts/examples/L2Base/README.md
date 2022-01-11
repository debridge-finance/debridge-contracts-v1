1. `npm i @openzeppelin/contracts-upgradeable`
2. Copy ICallProxy from contracts/interfaces and IDeBridgeGate from contracts/examples
3. Copy contracts/libraries/Flags.sol
4. Copy contracts/examples/L2Base/L2Base.sol
5. Extend L2Base.sol and create `send` and `onBridgedMessage` or similar functions you would like to use. See Incrementor.sol for an example
   - `onBridgedMessage` must have `onlyControllingAddress` modifier because otherwise it may be called by anyone through callProxy

Another example of onBridgeMessage
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