# Deterministic order ID

An order placed onto DLN is identified by a deterministic `keccak256` hash derived from an array of bytes that contains all the properties of the order. The array is designed to be cross-chain compatible, so the smart contracts residing on both EVM and Solana can easily reproduce it. The smart contracts implementing the DLN protocol usually accept all these properties as a single data struct and derive an `orderId`  programmatically to guarantee the order with the proper `orderId` is being managed.

To get the deterministic `orderId` of the order, the array of bytes should contain its following properties:

{% code fullWidth="true" %}
```sh
| Bytes | Bits | Field                                                |
| ----- | ---- | ---------------------------------------------------- |
| 8     | 64   | Salt                                                 |
| 1     | 8    | Maker Src Address Size (!=0)                         |
| N     | 8*N  | Maker Src Address                                    |
| 32    | 256  | Give Chain Id                                        |
| 1     | 8    | Give Token Address Size (!=0)                        |
| N     | 8*N  | Give Token Address                                   |
| 32    | 256  | Give Amount                                          |
| 32    | 256  | Take Chain Id                                        |
| 1     | 8    | Take Token Address Size (!=0)                        |
| N     | 8*N  | Take Token Address                                   |
| 32    | 256  | Take Amount                                          |                         |
| 1     | 8    | Receiver Dst Address Size (!=0)                      |
| N     | 8*N  | Receiver Dst Address                                 |
| 1     | 8    | Give Patch Authority Address Size (!=0)              |
| N     | 8*N  | Give Patch Authority Address                         |
| 1     | 8    | Order Authority Address Dst Size (!=0)               |
| N     | 8*N  | Order Authority Address Dst                          |
| 1     | 8    | Allowed Taker Dst Address Size                       |
| N     | 8*N  | * Allowed Taker Address Dst                          |
| 1     | 8    | Allowed Cancel Beneficiary Src Address Size          |
| N     | 8*N  | * Allowed Cancel Beneficiary Address Src             |
| 1     | 8    | Is Hook Presented 0x0 - Not, != 0x0 - Yes            |
| 32    | 256  | * Hook Envelope Hash                                 |
```
{% endcode %}
