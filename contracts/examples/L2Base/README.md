1. `npm i @openzeppelin/contracts-upgradeable`
2. Copy ICallProxy from contracts/interfaces and IDeBridgeGate from contracts/examples
3. Copy contracts/libraries/Flags.sol
4. Copy contracts/examples/L2Base/L2Base.sol
5. Extend L2Base.sol and implement `send` and `claim`
   - `claim` must have `onlyControllingAddress` modifier because otherwise it may be called by anyone through callProxy
