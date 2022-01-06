1. `npm i @openzeppelin/contracts-upgradeable`
2. Copy ICallProxy and IDeBridgeGate from https://github.com/debridge-finance/debridge-contracts-v1/tree/develop/contracts/interfaces
3. Copy L2Base.sol
4. Extend L2Base.sol and implement `send` and `claim`
   - `claim` must have `onlyControllingAddress` modifier because otherwise it may be called by anyone through callProxy
