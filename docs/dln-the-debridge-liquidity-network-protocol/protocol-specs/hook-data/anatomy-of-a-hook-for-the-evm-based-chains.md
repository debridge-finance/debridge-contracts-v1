# Anatomy of a Hook for the EVM-based chains

During order fulfillment the `DlnDestination` smart contract performs standard routine procedures, including checking that the order is still open (neither Fulfilled nor Cancelled) and that the requested amount of tokens were successfully pulled from the solver. Finally, it transfers the requested amount of tokens to the order's recipient address, OR — if the hook raw data is provided — to the `DlnExternalCallAdapter` hook engine smart contract address (accessible via `DlnDestination.externalCallAdapter`), immediately invoking it for hook handling.

`DlnExternalCallAdapter` is responsible for proper hook raw data decoding, hook execution, and guaranties that hook behavior conforms given properties.

### Hook data V1 layout

`DlnExternalCallAdapter` expects the hook raw data (called `externalCallEnvelope`) to be an concatenation of two `encodePacked`'d data types, specifically:

1. first byte: `uint8 envelopeVersion`&#x20;
2. subsequent bytes: `bytes envelopeData`&#x20;

The `envelopeVersion` determines which data structure was used to encode the `envelopeData`,

#### Envelope v1

The `envelopeVersion=1` is currently the only available version, and its corresponding structure for the `envelopeData` is `HookDataV1` as follows:

```solidity
struct HookDataV1 {
    // Address that will receive order outcome if the hook gets reverted. 
    // Mandatory for optional-success hooks
    address fallbackAddress;
    
    // The address of a smart contract that acts as a hook target. 
    // Must implement the IExternalCallExecutor interface
    address target;
    
    // Optional reward to pay to a solver who executes the hook
    // Reward is being cut off the order outcome.
    // Reasonable (but not mandatory) for non-atomic hooks
    uint160 reward;
    
    // False: atomic hook
    // True: non-atomic hook
    bool isNonAtomic;
    
    // False: optional-success hook
    // True: success-required hooks
    bool isSuccessRequired;
    
    // Arbitrary data to be passed to the target during the call
    bytes targetPayload;
}
```

`HookDataV1.target` defines a target smart contract address that would get called by the `DlnExternalCallAdapter` hook engine smart. The target smart contract MUST implement the `IExternalCallExecutor` interface with only two functions: `onEtherReceived()` and `onERC20Received()` — that get called (along with order details and the payload) right after the native or ERC-20 token got transferred to it:

<details>

<summary>The <code>IExternalCallExecutor</code> interface</summary>

```solidity
interface IExternalCallExecutor {
    /**
     * @notice Handles the receipt of Ether to the contract, then validates and executes a function call.
     * @dev Only callable by the adapter. This function decodes the payload to extract execution data.
     *      If the function specified in the callData is prohibited, or the recipient contract is zero,
     *      all Ether is transferred to the fallback address.
     *      Otherwise, it attempts to execute the function call. Any remaining Ether is then transferred to the fallback address.
     * @param _orderId The ID of the order that triggered this function.
     * @param _fallbackAddress The address to receive any unspent Ether.
     * @param _payload The encoded data containing the execution data.
     * @return callSucceeded A boolean indicating whether the call was successful.
     * @return callResult The data returned from the call.
     */
    function onEtherReceived(
        bytes32 _orderId,
        address _fallbackAddress,
        bytes memory _payload
    ) external payable returns (bool callSucceeded, bytes memory callResult);

    /**
     * @notice Handles the receipt of ERC20 tokens, validates and executes a function call.
     * @dev Only callable by the adapter. This function decodes the payload to extract execution data.
     *      If the function specified in the callData is prohibited, or the recipient contract is zero,
     *      all received tokens are transferred to the fallback address.
     *      Otherwise, it attempts to execute the function call. Any remaining tokens are then transferred to the fallback address.
     * @param _orderId The ID of the order that triggered this function.
     * @param _token The address of the ERC20 token that was transferred.
     * @param _transferredAmount The amount of tokens transferred.
     * @param _fallbackAddress The address to receive any unspent tokens.
     * @param _payload The encoded data containing the execution data.
     * @return callSucceeded A boolean indicating whether the call was successful.
     * @return callResult The data returned from the call.
     */
    function onERC20Received(
        bytes32 _orderId,
        address _token,
        uint256 _transferredAmount,
        address _fallbackAddress,
        bytes memory _payload
    ) external returns (bool callSucceeded, bytes memory callResult);
}

```

</details>

For orders buying ERC-20 token, the `DlnExternalCallAdapter` first transfers the token's amount to the hook's `target`, then invokes its `onERC20Received()` method:

```solidity
IERC20(order.takeToken).safeTransfer(hook.target, order.takeAmount);
IExternalCallExecutor(hook).onERC20Received(..., hook.targetPayload);
```

For orders buying native blockchain currency (ether, etc), the `DlnExternalCallAdapter` invokes  the hook's `target.onEtherReceived()`  method along with the amount of native currency as a `msg.value`:

```solidity
IExternalCallExecutor(hook).onEtherReceived{ value: order.takeAmount }(..., hook.targetPayload);
```

### Universal Hook

One the common ways to build cross-chain interactions is to make calls to arbitrary existing contracts, without the need to introduce custom intermediaries (smart contracts that act as hooks). To facilitate this need, we've build a default Universal Hook — a pre-deployed implementation of the `IExternalCallExecutor` and a part of the DLN deployment — that can act as a hook's `target` and is designed to transparently execute arbitrary transaction calls bypassed through its `targetPayload`.&#x20;

To reuse this hook, `HookDataV1`'s `target` must be set to `address(0)` (this would tell the `DlnExternalCallAdapter` hook engine to switch to the universal hook as a default hook implementation), and `HookDataV1`'s `targetPayload` must represent the following encoded data struct:

```solidity
struct UniversalHookPayload {
    address to;
    uint32 txGas;
    bytes callData;
}
```

When called, the universal hook would makes a `CALL` to the given `to` address using the given `callData`.

The transfer of native blockchain currency is performed during the call itself:

```
payload.to.call{ gas: payload.txGas, value: order.takeAmount }(payload.callData);
```

Mind that ERC-20 token transfer during transaction call made by the Universal hook behaves differently: the universal hook does not transfer the token to the `to`  address (like the `DlnExternalCallAdapter` does when calling a hook's `target`), but sets a temporary allowance instead before making a call, and reverts it back after the call:

```solidity
IERC20(order.takeToken).approve(payload.to, order.takeAmount);
// payload.to must pull the tokens from the caller, using the size of the 
// allowance as a reference amount
payload.to.call{ gas: payload.txGas }(payload.callData);
IERC20(order.takeToken).approve(payload.to, 0);

// the remainder not consumed by the payload.to is transferred to the fallback address
```

If the `payload.to` had pulled less amount than the order's outcome, the remainder is transferred to the given fallback address automatically.

If the call to the `payload.to` target gets reverted, the execution bubbles up to the `DlnExternalCallAdapter` hook engine who handles this failure according to the hook's properties (revert entire call if the hook is a success-required hook; gracefully ignore the failure if the hook is a success-optional hook).
