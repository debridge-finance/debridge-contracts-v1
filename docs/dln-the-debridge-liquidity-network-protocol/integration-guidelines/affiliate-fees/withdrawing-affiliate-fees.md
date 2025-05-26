# Withdrawing Affiliate Fees

Affiliate fees can be specified by any integration using the [DLN API ](../interacting-with-the-api/)or the [deBridge Widget](../debridge-widget.md). The fees are free to be distributed to the designated beneficiary once [liquidity is unlocked by a solver from a fulfilled order](../under-the-hood/order-fulfillment/claiming-the-order.md)—typically within a few hours after the order execution.

**EVM chains**

On EVM chains, affiliate fees are automatically transferred to the specified beneficiary address as part of the transaction in which the solver unlocks liquidity. No additional action is required.

**Solana**

On Solana, affiliate fees must be claimed manually by the beneficiary. This is done by invoking the `withdrawAffiliateFee` method of the DLN program. A complete working example for claiming affiliate fees in bulk is available [here](https://github.com/debridge-finance/api-integrator-example/blob/master/src/scripts/affiliates/sol-batch-withdraw.ts).&#x20;

Simplified example snippet:

```typescript
import { Solana } from "@debridge-finance/dln-client"
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

function findAssociatedTokenAddress(wallet: PublicKey, tokenMint: PublicKey)
    : [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [wallet.toBytes(), 
        new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").toBytes(), 
        tokenMint.toBytes()], 
        new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
    );
}

const solanaClient = new Solana.DlnClient(
    // Replace with dedicated RPC for production
    new Connection(clusterApiUrl("mainnet-beta")), 
    new PublicKey("src5qyZHqTqecJV4aY6Cb6zDZLMDzrDKKezs22MPHr4"), 
    new PublicKey("dst5MGcFPoBeREFAA5E3tU5ij8m5uVYwkzkSAbsLbNo"), 
    new PublicKey("DEbrdGj3HsRsAzx6uH4MKyREKxVAfBydijLUF3ygsFfh"), 
    new PublicKey("DeSetTwWhjZq6Pz9Kfdo1KoS5NqtsM6G8ERbX4SSCSft"),
)

type Order = {
    orderId: string;
    beneficiary: PublicKey;
    giveToken: PublicKey;
}

// Load the order using known data or fetch via transaction hash
// const order = await solanaClient.getOrderFromTransaction(
//     { giveChain: ChainId.Solana, txHash: "CREATE_TX_HASH" }
// );
const order: Order = { /* order data */ };

// Build and send the withdraw transaction
const [associatedTokenAddress] = findAssociatedTokenAddress(
    order.beneficiary, 
    order.giveToken
);
const tx = await solanaClient.source.withdrawAffiliateFee(
    order.orderId, 
    order.beneficiary, 
    associatedTokenAddress
);
// Send the transaction...
```
