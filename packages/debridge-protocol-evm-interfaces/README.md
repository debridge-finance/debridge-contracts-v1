# `debridge-protocol-evm-interfaces`

A lightweight package with the interfaces for the EVM smart contracts that implement the [deBridge protocol](https://debridge.finance). Add this package as a dependency to your project to avoid copy-n-pasting the files or depending on a heavyweight [`debridge-contracts-v1.git`](https://github.com/debridge-finance/debridge-contracts-v1) repo.

## Installation

Install the package:

```
npm i --save @debridge-finance/debridge-protocol-evm-interfaces
```

Then import necessary interfaces into your Solidity files:

```sol
import "@debridge-finance/debridge-protocol-evm-interfaces/contracts/interfaces/ICallProxy.sol";
import "@debridge-finance/debridge-protocol-evm-interfaces/contracts/interfaces/IDeBridgeGate.sol";
import "@debridge-finance/debridge-protocol-evm-interfaces/contracts/interfaces/IDeBridgeGateExtended.sol";
import "@debridge-finance/debridge-protocol-evm-interfaces/contracts/libraries/Flags.sol";
```
