# 🟢 Deployed Contracts

The following smart contracts have been deployed across supported chains to power DLN:

### Solana <a href="#solana" id="solana"></a>

| Smart contract   | Address                                                                                                               | Description                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `DlnSource`      | [src5qyZHqTqecJV4aY6Cb6zDZLMDzrDKKezs22MPHr4](https://solscan.io/account/src5qyZHqTqecJV4aY6Cb6zDZLMDzrDKKezs22MPHr4) | Used to place orders on DLN           |
| `DlnDestination` | [dst5MGcFPoBeREFAA5E3tU5ij8m5uVYwkzkSAbsLbNo](https://solscan.io/account/dst5MGcFPoBeREFAA5E3tU5ij8m5uVYwkzkSAbsLbNo) | Used to fulfill and cancel DLN orders |

### EVM Chains <a href="#evm-chains" id="evm-chains"></a>

| Smart contract         | Address                                      | Description                                                                                                                                   |
| ---------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `DlnSource`            | `0xeF4fB24aD0916217251F553c0596F8Edc630EB66` | Used to place orders on DLN                                                                                                                   |
| `DlnDestination`       | `0xe7351fd770a37282b91d153ee690b63579d6dd7f` | Used to fulfill and cancel orders placed on DLN                                                                                               |
| `CrosschainForwarder`  | `0x663dc15d3c1ac63ff12e45ab68fea3f0a883c251` | Intermediary smart contract used exclusively by the DLN API to sell input assets for trusted liquid assets prior order created, if necessary. |
| `ExternalCallExecutor` | `0xFC2CA4022d26AD4dCb3866ae30669669F6A28f19` | Used to accepting tokens and data to execute dln external calls                                                                               |

### **Contract ABIs**

[DlnSource.abi.json](https://3251284410-files.gitbook.io/\~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F8SH9Mg0oTRdKFNHxWvTP%2Fuploads%2F2Cg4HetCApwZBZxkThpT%2FDlnSource.abi.json?alt=media\&token=0bf21e5f-7511-4cc0-86a2-841a1bd70f3a)

[DlnDestination.abi.json](https://3251284410-files.gitbook.io/\~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F8SH9Mg0oTRdKFNHxWvTP%2Fuploads%2FyhXoBlUK16nqXPM3vSgM%2FDlnDestination.abi.json?alt=media\&token=397802d5-e1bf-4743-95fc-8d248210ed38)
