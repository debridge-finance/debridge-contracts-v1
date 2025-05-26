# Submitting an Order Creation Transaction

The transaction call retrieved from the DLN API must be signed by a user how is willing to sell the asset, and then broadcasted to the source chain.

### EVM-based blockchains

The `tx` object has the following structure and is ready to be signed and broadcasted:

```
{
    "estimation": { ... }
    
    "tx": {
        "data": "0xfbe16ca70000000000000000000000000000000[...truncated...]",
        "to": "0xeF4fB24aD0916217251F553c0596F8Edc630EB66",
        "value": "5000000000000000",
    },
}
```

Field names from the `tx` object speak for themselves:

* the `to` is the field the transaction should be sent to, and typically you should expect the address of one of the smart contracts responsible for forwarding;
* the `data` is the contents of the transaction, containing instructions related to swaps planned on the source or (and) on the destination chains, bridging settings, etc;
* the `value` is the amount of native blockchain currency that must be sent along with the transaction.

However, there are a few things you must consider:

First, the `value` is always positive, even if the input token is an ERC-20 token. This is because the underlying DLN protocol takes a fixed amount in the native currency, so the API always includes it as the transaction value. In the above example, the `value` equals the current fixed fee, which is 0.005 BNB on the BNB Chain.

Second, in case the input token is an ERC-20 token, a user needs to give approval to the smart contract address specified in the `tx.to` field prior to submitting this transaction so it can transfer them on the behalf of the sender. This can be typically done by calling either `approve()` or `increaseAllowance()` method of the smart contract which implements the token you are willing to swap. Approve at least the amount that has been specified as the `estimation.srcChainTokenIn.amount` response property.

Other than that, the transaction is ready to be signed by a user and broadcasted to the blockchain. It is also worth mentioning that the given transaction data can be used as a part of another transaction: a dApp can bypass the given `to`, `data` and `value` to your smart contract, and make a low-level call. There is even possible to create multiple transactions for different orders, and perform several low-level calls.

{% hint style="info" %}
The affiliate fee is paid only after the order gets fulfilled, and the taker requests order unlock during the unlock procedure.
{% endhint %}

### Solana

For DLN trades coming from Solana the `tx` object returned by DLN API has only one field `data` which is hex-encoded [VersionedTransaction](https://docs.solana.com/developing/versioned-transactions)

To convert the hex-encoded string into `VersionedTransaction` decode hex to buffer using any library and call `VersionedTransaction.deserialize(decoded)`.

{% hint style="info" %}
Make sure you properly set transaction priority fees based on the current load of the Solana network. Refer to one of these guides to learn more about how to estimate tx fee parameters: \
\- [Triton](https://docs.triton.one/chains/solana/improved-priority-fees-api) guide\
\- [Helius](https://docs.helius.dev/solana-apis/priority-fee-api) guide

More info about sending versioned transactions [here](https://docs.phantom.app/solana/sending-a-transaction-1#signing-and-sending-a-versioned-transaction).
{% endhint %}

Example:

```typescript
import { VersionedTransaction, Connection, clusterApiUrl, Keypair } from "@solana/web3.js";

function encodeNumberToArrayLE(num: number, arraySize: number): Uint8Array {
  const result = new Uint8Array(arraySize);
  for (let i = 0; i < arraySize; i++) {
    result[i] = Number(num & 0xff);
    num >>= 8;
  }

  return result;
}

function updatePriorityFee(tx: VersionedTransaction, computeUnitPrice: number, computeUnitLimit?: number) {
  const computeBudgetOfset = 1;
  const computeUnitPriceData = tx.message.compiledInstructions[1].data;
  const encodedPrice = encodeNumberToArrayLE(computeUnitPrice, 8);
  for (let i = 0; i < encodedPrice.length; i++) {
    computeUnitPriceData[i + computeBudgetOfset] = encodedPrice[i];
  }

  if (computeUnitLimit) {
    const computeUnitLimitData = tx.message.compiledInstructions[0].data;
    const encodedLimit = encodeNumberToArrayLE(computeUnitLimit, 4);
    for (let i = 0; i < encodedLimit.length; i++) {
      computeUnitLimitData[i + computeBudgetOfset] = encodedLimit[i];
    }
  }
}

const wallet = new Keypair(); // your actual wallet here
const connection = new Connection(clusterApiUrl("mainnet-beta")); // your actual connection here
const tx = VersionedTransaction.deserialize(Buffer.from(tx.data.slice(2), "hex"));

// make sure to set correct CU price & limit for the best UX 
updatePriorityFee(tx, NEW_CU_PRICE, NEW_CU_LIMIT);
const { blockhash } = await connection.getLatestBlockhash();
tx.message.recentBlockhash = blockhash; // Update blockhash!
tx.sign([wallet]); // Sign the tx with wallet
connection.sendTransaction(tx);
```
