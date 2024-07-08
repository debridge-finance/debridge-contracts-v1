# Placing orders

#### Estimating the order <a href="#estimating-the-order" id="estimating-the-order"></a>

First, decide which tokens you are willing to sell on the source chain and which tokens you are willing to buy on the destination chain. Say, you're selling 1 wBTC on Ethereum and buying a reasonable amount of DOGE on BNB.

{% hint style="info" %}
The deBridge Liquidity Network Protocol is completely asset-agnostic, meaning that you can place an order giving wBTC or WETH, or any other asset. However, _solvers_ mainly hold USDC and ETH on their wallets' balance and execute only the orders where the input token is either a USDC token or a native ETH. Thus, for a quick fulfillment of the order placed in the deBridge Liquidity Network Protocol, it's recommended to pre-swap your input token to any of these reserve-ready tokens before placing an order.

On the other hand, DLN is an open market, so anyone can become a _solver_ and execute orders with custom input tokens or profitability.
{% endhint %}

Let's assume you've swapped your 1 wBTC to 25,000 USDC which will be then used upon order creation.

Second, calculate the reasonable amount of tokens you are willing to receive on the destination chain upon order fulfillment according to the current market condition and the protocol fees. Simply speaking, give at least 4 bps (DLN protocol fee) + 4 bps (Taker's incentive) = 8 bps + $6 (expected gas expenses taken by the taker to fulfill the order). This amount is laid in as a spread of the limit order, or margin between input and output tokens. Getting back to the example, the math below gives us a reasonable amount of DOGE we are willing to take:

Copy

```
25,000 * (10,000 - 8) / 10,000 - 6 = 24,974 DOGE

(10,000 is a basis point denominator, see https://en.wikipedia.org/wiki/Basis_point)
```

Third, make sure you have enough Ether to cover the protocol fee, which is being taken by `DlnSource` smart contract for order creation. You are advised to query `DlnSource.globalFixedNativeFee()` function to retrieve this value. For example, the `globalFixedNativeFee` value for the Ethereum blockchain would be `1000000000000000`, which resolves to 0.001 ETH.

#### Placing order on-chain <a href="#placing-order-on-chain" id="placing-order-on-chain"></a>

To place an order,

1. set USDC token approval to allow the `DlnSource` contract spend tokens on your behalf,
2. call the `DlnSource.createOrder()` method:

Copy

```
function createOrder(
    OrderCreation calldata _orderCreation,
    bytes calldata _affiliateFee,
    uint32 _referralCode,
    bytes calldata _permitEnvelope
) external payable returns (bytes32 orderId);
```

**Preparing an `OrderCreation` struct**

`OrderCreation` has the following structure:

```
struct OrderCreation {
    // the address of the ERC-20 token you are giving; 
    // use the zero address to indicate you are giving a native blockchain token (ether, matic, etc).
    address giveTokenAddress;
    
    // the amount of tokens you are giving
    uint256 giveAmount;
    
    // the address of the ERC-20 token you are willing to take on the destination chain
    bytes takeTokenAddress;
    
    // the amount of tokens you are willing to take on the destination chain
    uint256 takeAmount;
    
    // the ID of the chain where an order should be fulfilled. 
    // Use the list of supported chains mentioned above
    uint256 takeChainId;
    
    // the address on the destination chain where the funds 
    // should be sent to upon order fulfillment
    bytes receiverDst;
    
    // the address on the source (current) chain who is allowed to patch the order 
    // giving more input tokens and thus making the order more attractive to takers, just in case
    address givePatchAuthoritySrc;
    
    // the address on the destination chain who is allowed to patch the order 
    // decreasing the take amount and thus making the order more attractive to takers, just in case
    bytes orderAuthorityAddressDst;
    
    // an optional address restricting anyone in the open market from fulfilling 
    // this order but the given address. This can be useful if you are creating a order
    //  for a specific taker. By default, set to empty bytes array (0x)
    bytes allowedTakerDst;              // *optional
    
    // set to an empty bytes array (0x)
    bytes externalCall;                 // N/A, *optional
    
    // an optional address on the source (current) chain where the given input tokens 
    // would be transferred to in case order cancellation is initiated by the orderAuthorityAddressDst 
    // on the destination chain. This property can be safely set to an empty bytes array (0x): 
    // in this case, tokens would be transferred to the arbitrary address specified 
    // by the orderAuthorityAddressDst upon order cancellation
    bytes allowedCancelBeneficiarySrc;  // *optional
}
```

**Preparing other arguments**

Subsequent arguments of the `createOrder()` function can be safely omitted by specifying default values:

* `_affiliateFee` can be set to empty bytes array (`0x`); this argument allows you to ask the protocol to keep the given amount as an affiliate fee in favor of affiliate beneficiary and release it whenever an order is completely fulfilled. This is useful if you built a protocol and place orders on behalf of your users. To do so, concat the address and the amount into a single bytes array, whose length is expected to be exactly 52 bytes.
* `_referralCode` can be set to zero (`0`); it is an invitation code to identify your transaction. If you don't have it, you can get one by pressing the INVITE FRIENDS button at [app.debridge.finance](https://app.debridge.finance/). Governance may thank you later for being an early builder.
* `_permitEnvelope` can be set to empty bytes array (`0x`); it allows you to use an EIP-2612-compliant signed approval so you don't have to give a prior spending approval to allow the `DlnSource` contract to spend tokens on your behalf. This argument accepts `amount` + `deadline` + `signature` as a single bytes array

**Making a call**

Once all arguments are prepared, you are ready to make the call. Make sure you supply the exact amount of native blockchain currency to the `value` to cover the DLN protocol fee (`globalFixedNativeFee`).

```
// preparing an order
OrderCreation memory orderCreation;
orderCreation.giveTokenAddress = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;    // USDC
orderCreation.giveAmount = 25000000000;                                         // 25,000 USDC
orderCreation.takeTokenAddress = abi.encodePacked(0xba2ae424d960c26247dd6c32edc70b295c744c43);
orderCreation.takeAmount = 2497400000000;                                       // 249,740 DOGE
orderCreation.takeChainId = 56;                                                 // BNB Chain
orderCreation.receiverDst = abi.encodePacked(0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045);
orderCreation.givePatchAuthoritySrc = 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045;
orderCreation.orderAuthorityAddressDst = abi.encodePacked(0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045);
orderCreation.allowedTakerDst = "";
orderCreation.externalCall = "";
orderCreation.allowedCancelBeneficiarySrc = "";

// getting the protocol fee
uint protocolFee = DlnSource(dlnSourceAddress).globalFixedNativeFee();

// giving approval
IERC20(orderCreation.giveTokenAddress).approve(dlnSourceAddress, orderCreation.giveAmount);

// placing an order
bytes32 orderId = DlnSource(dlnSourceAddress).createOrder{value: protocolFee}(
    orderCreation,
    "",
    0,
    ""
);
```

Whenever the call to `DlnSource.createOrder()` succeeded, it would return the `orderId` which can be used to track, cancel and fulfill the order.

Additionally, the `CreatedOrder` event is emitted:

```
event CreatedOrder(
    Order order,
    bytes32 orderId,
    bytes affiliateFee,
    uint256 nativeFixFee,
    uint256 percentFee,
    uint32 referralCode
);
```

which contains an `Order` structure that is important to know to be able to fulfill or cancel this order.

#### Tracking order status <a href="#tracking-order-status" id="tracking-order-status"></a>

{% hint style="warning" %}
There is no way to know the order status on the chain where the order was placed. You need to switch to the chain it is intended to be fulfilled on (the `takeChainId` property of the order).
{% endhint %}

You have two options to programmatically find whenever an order has been fulfilled or cancelled on the destination chain (not the chain where you placed it): either by querying the `DlnDestination.takeOrders()` getter method, or by capturing the `FulfilledOrder()` and `SentOrderCancel()` events emitted by the `DlnDestination` contract.

The `DlnDestination.takeOrders()` getter method is defined as follows:

```
function takeOrders(bytes32 orderId)
    external
    view
    returns (
        uint8 status,
        address takerAddress,
        uint256 giveChainId
    );
```

returns the `status` property which indicates:

* `status=0`: the given order is neither fulfilled nor cancelled,
* `status=1`: the given order is successfully fulfilled (funds sent to the given receiver)
* `status=2`: **unlock** procedure has been initiated upon fulfillment to unlock the given funds on the source chain, as per taker request
* `status=3`: **cancel** procedure has been initiated to unlock the given funds on the source chain, as per order's `orderAuthorityAddressDst` request

Alternatively, you can capture events emitted by the `DlnDestination` contact:

```
event FulfilledOrder(Order order, bytes32 orderId, address sender, address unlockAuthority);
event SentOrderCancel(Order order, bytes32 orderId, bytes cancelBeneficiary, bytes32 submissionId);
```

The `FulfilledOrder` event is emitted whenever the order has been successfully fulfilled.

The `SentOrderCancel` event is emitted whenever the **cancel** procedure has been initiated, as per order's `orderAuthorityAddressDst` request.

#### Canceling order <a href="#canceling-order" id="canceling-order"></a>

The only way to cancel the order is to initiate the cancellation procedure on the chain it was intended to be fulfilled on (the `takeChainId` property of the order). During the cancellation process, the order is marked as cancelled (to prevent further fulfillment) and a cross-chain message is sent through the [deBridge cross-chain messaging infrastructure](../../the-debridge-messaging-protocol/protocol-overview.md) to the `DlnSource` contract on the source chain to unlock the given funds. The funds locked on the source chain are returned in full including affiliate and protocol fees.

To initiate the cancellation procedure, call the `DlnDestination.sendEvmOrderCancel()` method on the destination chain as follows:

```
function sendEvmOrderCancel(
    Order memory _order,
    address _cancelBeneficiary,
    uint256 _executionFee
) external payable;
```

* mind that only an `orderAuthorityAddressDst` address specified during the order creation is allowed to perform this call for the given order;
* you need to cover the deBridge cross-chain messaging protocol fee (measured in the blockchain native currency where the message is being sent from) to make a cancellation message accepted. Consider looking at the details on [retrieving the deBridge protocol fee](../../the-debridge-messaging-protocol/fees-and-supported-chains.md);
* for the `_order` argument, use the `Order` structure obtained from the `CreatedOrder()` upon order creation;
* for the `_cancelBeneficiary` argument, use the address you'd like the given funds to be unlocked to on the source chain. Whenever the `allowedCancelBeneficiarySrc` has been explicitly provided upon order creation, you are only allowed to use that value;
* for the `_executionFee` argument, specify the amount of native blockchain currency (in addition to the deBridge protocol fee) to provide an incentive to keepers for the successful claim of the cross-chain message on the destination chain. In other words, this is a prepayment for potential gas expenses on the destination chain, that will be transferred by the protocol. Otherwise, you'd need to find the cross-chain transaction in the [deExplorer](https://explorer.debridge.finance/) and claim it manually. Consider understanding [how the cross-chain call is handled](../../the-debridge-messaging-protocol/development-guides/lifecycle-of-a-cross-chain-call.md).

Finally, you are ready to initiate a cancellation procedure:

```
uint protocolFee = IDebridgeGate(DlnDestination(dlnDestinationAddress).deBridgeGate())
    .globalFixedNativeFee();
uint executionFee = 30000000000000000; // e.g. 0.03 BNB ≈ $10
DlnDestination(dlnDestinationAddress).sendEvmOrderCancel{value: protocolFee + executionFee}(
    order,
    0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045,
    executionFee
);
```
