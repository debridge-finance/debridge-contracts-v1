# Lifecycle of a cross-chain call

Blockchains are things in themselves by their nature: they cannot communicate with each other. That is why any bridge is a complex set of components, making any cross-chain transaction a multistage process, so just initiating a cross-chain transaction typically is not enough. It is important to understand how the deBridge infrastructure works so you can manage your submissions (either manually or even automatically) consciously and confidently.

The following schema visualizes a normal cycle of a typical cross-chain call, as it may look for the [conceptual cross-chain dApp](https://github.com/debridge-finance/debridge-cross-chain-dapp-example) where Incrementor is used as an example of the smart contract that sends a cross-chain message:

![A high level schema of the deBridge infrastructure](../.gitbook/assets/02.png)

When a call to the `deBridgeGate.send()` method is made on the origin chain, the gate contract validates the input (its args and the `autoParams` struct), and if everything seems correct (the data is unambiguous, the input asset covers the fees, etc), a special `Sent` event is emitted. This event exposes the following details of the submission:

* `submissionId`, the identifier of the cross-chain transaction you've initiated;
* `debridgeId`, the cross-chain identifier of the input asset, needed to correctly handle tokens across supported chains;
* args and the `autoParams` structure that contains information about the passed message.

You are advised to monitor this event to ensure your submission has been accepted and the cross-chain transaction has been initiated.

Twelve off-chain validators listen for these events emitted by the `deBridgeGate` smart contract deployed on all supported chains, and for each event tracked validator performs the following set of actions:

* waits a specific amount of block confirmations (12 block confirmations for supported EVM chains, and 256 block confirmations for Polygon network) to ensure the finality of the transaction where the event has been emitted,
* validates the args and the structure,
* if the data is correct, sign the message with its own private key, and publish the signature to Arweave.

{% hint style="info" %}
Note: Validators' financial responsibility to be enabled through[slashing-and-delegated-staking.md](../the-core-protocol/slashing-and-delegated-staking.md "mention").
{% endhint %}

After the minimum required number of validators have signed the message (eight at the time of writing, ⅔ of all possible signatures), the submission is confirmed and may be claimed on the destination chain.

{% hint style="info" %}
You can access the actual minimum required number of signatures by querying the `minConfirmations` property of the `signatureVerifier` contract:

`ISignatureVerifier(IDebridgeGate(deBridgeGate).signatureVerifier).minConfirmations`
{% endhint %}

To claim the submission, a claiming transaction should be crafted, signed, and sent to the blockchain. Such transaction must contain a call to the `claim()` method of the `deBridgeGate` contract with the submission's data (taken from the `Sent` event) and minimal required number of validators' signatures provided as its args.

Worth mentioning that such transactions may be signed and sent by anyone who is willing to pay the gas for its' execution on the destination chain. There is no security implication because during the claiming phase the `deBridgeGate` contract first checks the integrity of the message (the args and the `autoParams` struct that was initially passed to the `send()` method on the origin chain) by verifying each validator's signature against their public key, and then executing the instructions this message contains.

There are three ways to trigger a claiming txn:

* manually, by visiting [deExplorer](https://explorer.debridge.finance/), where you can find your cross-chain transaction by its `submissionId` or even by the hash of the origin transaction, then sign the prepared claiming transaction using the browser wallet (MetaMask, etc);

![](<../.gitbook/assets/Screenshot 2022-07-20 at 20.01.38.png>)

* automatically, by specifying sufficient `executionFee` property within your submission: in this case, a Claimer service (run by deBridge) will sign and send a claiming transaction getting paid by the supplied included gas; note that Claimer may skip the submission if the value of the included gas is less than the potential costs of submitting such transaction; the latter may happen during accidental gas price hikes; in this case, you should trigger a claiming txn by your own, either manually or programmatically, and you'll receive the reserved included gas as a claimer (instead of the Claimer service);
* programmatically, by constructing a claiming txn with a little help of [deSDK](https://github.com/debridge-finance/desdk) and deBridge API (this is what Claimer service actually does automatically).

After the claiming txn is sent and included in the blockchain, and the `deBridgeGate.claim()` call succeeds, a special `Claimed` event is emitted by the `deBridgeGate` contract signaling the successful completion of the cross-chain transaction. Voila!
