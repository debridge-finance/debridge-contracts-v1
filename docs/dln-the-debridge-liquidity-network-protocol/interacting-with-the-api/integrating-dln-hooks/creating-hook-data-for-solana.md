# Creating Calldata for Solana

### 1. Intro <a href="#id-1.-intro" id="id-1.-intro"></a>

Solana calldata is a serialized `TransactionInstruction` list with additional metadata (see next sections). It can be serialized using a wasm module built by deBridge.

### 2. Expenses <a href="#id-2.-expenses" id="id-2.-expenses"></a>

Determine how much lamports your instruction spends on the destination network (most often, for account creation). Record this value as expenses. Each instruction is technically worth 5000 lamports (since we can't determine how many resources it will spend in advance, the implication is that it can be executed in a separate transaction). Therefore, 5000 + expenses is the estimate of how much lamports will cost the execution.

### 2.1. Rewards <a href="#id-2.1.-rewards" id="id-2.1.-rewards"></a>

Reward is an amount that covers taker expenses (expenses field) and makes execution of calldata profitable for executor => makes calldata to be executed automatically. Reward for each instruction is deducted from the wallet placeholder amount. **Rewards can't be native sol**. Rewards are set by the DLN API.

### 3. Pubkey substituion <a href="#id-3.-pubkey-substituion" id="id-3.-pubkey-substituion"></a>

Determine which accounts in the instruction are input-dependent and cannot be passed directly from the user for security reasons.

For example, if there is a PDA in the destination network that depends on some unique transfer identifier, then we need to form \`PubkeySubstitutions\`

### 3.1 Expenses <a href="#id-3.1-expenses" id="id-3.1-expenses"></a>

As well as pubkey substitutions, placeholders could be used to substitute extcall accounts, but placeholders can't be used to calculate ATA during extcall execution. At the moment we have the following placeholders:

* **Wallet Placeholder:** `J4vKrc4pCdtiHpxFDfBy4iyZ22Uf7fBjJyJ817k4673y` - if you set this pubkey to some account, it will be replaced by actual Submission Wallet during execution. Submission wallet is a [token account](https://github.com/solana-labs/solana-program-library/blob/523156a0cdd9cada27036bd72d326bc40c00f85f/token/program/src/state.rs#L83-L106) that contains transferred tokens during execution.
* **Submission Placehoder:** `7cu34CRu47UZKLRHjt9kFPhuoYyHCzAafGiGWz83GNFs` will be replaced by [Submission account](https://github.com/debridge-finance/debridge-solana-sdk/blob/5c3f5149504daddab38d5383ae6c8c15efb4235c/src/debridge\_accounts.rs#L59-L79) during execution. [Submission account](https://github.com/debridge-finance/debridge-solana-sdk/blob/5c3f5149504daddab38d5383ae6c8c15efb4235c/src/debridge\_accounts.rs#L59-L79) contains transfer metadata such as native sender, send from chain, etc.
* **Authority Placeholder:** `2iBUASRfDHgEkuZ91Lvos5NxwnmiryHrNbWBfEVqHRQZ` will be replaced by Submission Authority account during execution. Submission authority is an owner/authority account for Submission Wallet. It is this account that manages [#2.-expenses](https://docs.dln.trade/dln-on-chain/creating-calldata-for-solana#2.-expenses).

If both placeholder and substitution are used for the same account, only substitution will be performed.

### 4. DataSubstitution <a href="#id-4.-datasubstitution" id="id-4.-datasubstitution"></a>

If you need a transfer amount as part of your transfer and it cannot be calculated in advance, then you must use `DataSubstitution`. One substitution is now available (`SubmissionAuthWalletAmount`) which works as follows. Takes the `account_index` account of the current instruction, interprets it as a token account, takes its balance, chooses its encoding (big endian, little endian), uses `substration` and inserts it into the current instruction by `offset` before calling it.

### 5. Calldata serialization <a href="#id-5.-calldata-serialization" id="id-5.-calldata-serialization"></a>

Instructions should be serialized one by one, final calldata is a concatenation of separately serialized instructions.

Solana's `TransactionInstruction`s could be serialized into calldata format using `@debridge-finance/debridge-external-call` npm package:

Copy

```typescript
import * as wasm from "@debridge-finance/debridge-external-call";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";

/**
 * Substitutes amount at offset with `walletBalance(accounts[account_index]) - subtraction`
 */
type AmountSubstitution = {
  /**
   * big or little endian
   */
  is_big_endian: boolean;
  /**
   * At what offset substitution should be done
   */
  offset: number;
  /**
   * index of account in TransactionInstruction.keys to get balance for
   */
  account_index: number;
  /**
   * Amount to deduct from wallet balance
   */
  subtraction: number;
};

/**
 * Since we don't know submissionAuth at the moment of calldata preparation we can prepare substitution to replace
 * account at `index` with actual ATA(submissionAuth, tokenMint) during execution
 */
type WalletSubstitution = {
  /**
   * Token mint to calculate ATA for
   */
  token_mint: string;
  /**
   * Account at this index will be replaced with ATA(submissionAuth, tokenMint) during execution
   */
  index: number;
};

/**
 * Structure required by wasm module
 */
interface IExtIx {
  keys: {
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }[];
  data: Buffer;
  programId: string;
}

function ixToIExtIx(ix: TransactionInstruction): IExtIx {
  return {
    keys: ix.keys.map((meta) => ({
      pubkey: meta.pubkey.toBase58(),
      isSigner: meta.isSigner,
      isWritable: meta.isWritable,
    })),
    programId: ix.programId.toBase58(),
    data: ix.data,
  };
}

function serialize(
  instruction: TransactionInstruction,
  substitutions?: {
    amountSubstitutions?: AmountSubstitution[];
    walletSubstitutions?: WalletSubstitution[];
  },
  expense?: bigint,
  reward?: bigint,
  isInMandatoryBlock: boolean = false,
) {
  const ixWrapper = new wasm.ExternalInstructionWrapper(
    reward,
    expense,
    isInMandatoryBlock,
    substitutions?.amountSubstitutions ?? [],
    substitutions?.walletSubstitutions ?? [],
    ixToIExtIx(instruction),
  );

  return ixWrapper.serialize();
}

const ix1: TransactionInstruction;
const ix2: TransactionInstruction;

const serializedIx1 = serialize(ix1, undefined, 1000n);
const serializedIx2 = serialize(ix2, undefined, 2000n);

const calldata = Buffer.concat([serializedIx1, serializedIx2 /** rest serialized instructions if any */]);
```
