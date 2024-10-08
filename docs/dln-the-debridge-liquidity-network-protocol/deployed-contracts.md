# 🟢 Deployed Contracts

The following smart contracts have been deployed across supported chains to power DLN:

### Solana <a href="#solana" id="solana"></a>

| Smart contract   | Address                                                                                                               | Description                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `DlnSource`      | [src5qyZHqTqecJV4aY6Cb6zDZLMDzrDKKezs22MPHr4](https://solscan.io/account/src5qyZHqTqecJV4aY6Cb6zDZLMDzrDKKezs22MPHr4) | Used to place orders on DLN           |
| `DlnDestination` | [dst5MGcFPoBeREFAA5E3tU5ij8m5uVYwkzkSAbsLbNo](https://solscan.io/account/dst5MGcFPoBeREFAA5E3tU5ij8m5uVYwkzkSAbsLbNo) | Used to fulfill and cancel DLN orders |

#### IDLs <a href="#evm-chains" id="evm-chains"></a>

{% file src="../.gitbook/assets/dst.ts" %}
DLN Destination
{% endfile %}

{% file src="../.gitbook/assets/src.ts" %}
DLN Source
{% endfile %}

### EVM-based chains <a href="#evm-chains" id="evm-chains"></a>

| Smart contract           | Address                                      | Description                                                                                                                                                                                          |
| ------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DlnSource`              | `0xeF4fB24aD0916217251F553c0596F8Edc630EB66` | Used to place orders on DLN                                                                                                                                                                          |
| `DlnDestination`         | `0xe7351fd770a37282b91d153ee690b63579d6dd7f` | Used to fulfill and cancel orders placed on DLN                                                                                                                                                      |
| `DlnExternalCallAdapter` | `0x61eF2e01E603aEB5Cd96F9eC9AE76cc6A68f6cF9` | Intermediary store and the engine for [DLN Hooks](dln-hooks.md) that implement `IExternalCallExecutor` (see below)                                                                                   |
| `ExternalCallExecutor`   | `0xFC2CA4022d26AD4dCb3866ae30669669F6A28f19` | [Universal DLN Hook](protocol-specs/hook-data/anatomy-of-a-hook-for-the-evm-based-chains.md) (implementing `IExternalCallExecutor`) that executes arbitrary transaction calls bypassed via a payload |
| `CrosschainForwarder`    | `0x663dc15d3c1ac63ff12e45ab68fea3f0a883c251` | Intermediary smart contract used exclusively by the DLN API to sell input assets for trusted liquid assets prior order created, if necessary.                                                        |

#### **ABIs and interfaces**

{% file src="../.gitbook/assets/DlnSource.abi.json" %}

{% file src="../.gitbook/assets/DlnDestination.abi.json" %}

{% file src="../.gitbook/assets/ExternalCallExecutor.abi.json" %}

{% file src="../.gitbook/assets/DlnExternalCallAdapter.abi.json" %}

{% file src="../.gitbook/assets/IExternalCallExecutor.sol" %}

{% file src="../.gitbook/assets/DlnExternalCallLib.sol" %}
