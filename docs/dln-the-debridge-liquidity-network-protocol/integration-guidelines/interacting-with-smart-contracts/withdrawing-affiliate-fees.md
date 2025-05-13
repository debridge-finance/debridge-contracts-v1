# Withdrawing Affiliate Fees

The affiliate fee can be specified by anyone who integrates with the DLN API or uses the [deBridge Widget](https://app.debridge.finance/widget). The fee is received by the beneficiary at the moment when the solvers unlocks liquidity from the fulfilled order (usually a few hours after the order is fulfilled).



**EVM chains**

For orders initiated on EVM chains, the affiliate fee is transferred to the beneficiary address automatically in the same transaction where the solver unlocks liquidity from the fulfilled order.

**Solana**

For orders initiated from Solana, the affiliate fee is claimed by the beneficiary who should call the `withdrawAffiliateFee`  method of the DLN program on Solana. Example snippet:

```typescript
import { Solana } from "@debridge-finance/dln-client"
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

function findAssociatedTokenAddress(wallet: PublicKey, tokenMint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([wallet.toBytes(), new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").toBytes(), tokenMint.toBytes()], new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"));
}

const solanaClient = new Solana.DlnClient(
    new Connection(clusterApiUrl("mainnet-beta")), // better use your own RPC
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
// load order in expected format
const order: Order; 
// order could also be loaded from chain by order creation tx hash
// const order = solanaClient.getOrderFromTransaction({ giveChain: ChainId.Solana, txHash: "create tx hash" }, {});

// build withdraw tx
const tx = await solanaClient.source.withdrawAffiliateFee(order.orderId, order.beneficiary, findAssociatedTokenAddress(order.beneficiary, order.giveToken)[0]);
// send withdraw tx
```
