# Detecting the Order

The first step in the solver workflow is highlighted with a green background in the diagram below.

<figure><img src="../../../../../.gitbook/assets/Solvers-steps-1.drawio (1).png" alt=""><figcaption><p>Solver's steps - Detecting the Order</p></figcaption></figure>

Solvers monitor the `DlnSource` contract for the `CreatedOrder` event:

```solidity
event CreatedOrder(
    Order order,
    bytes32 orderId,
    bytes affiliateFee,
    uint256 nativeFixFee,
    uint256 percentFee,
    uint32 referralCode
);
```

This event emits an `Order` struct, which provides the information necessary to either fulfill or cancel the order. Further details about the `Order` structure can be found [here](../../../interacting-with-smart-contracts/placing-orders.md).

Solvers evaluate whether an order is worth fulfilling based on its profitability. To ensure orders are attractive to solvers, integrators must configure them so that the spread between input and wanted assets covers all associated costs, including [operating expenses and all of the fees](../fees-and-operating-expenses.md). Additional considerations around profitability are discussed in the following section.
