# Off-chain external call preparation for Solana

Solana's `TransactionInstruction`s could be serialized into calldata format using `@debridge-finance/debridge-external-call` npm package.

Instructions should be serialized one by one, final calldata is a concatenation of a separately serialized instructions.

For the info about the rewards, substitutions and expenses check the previous section

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
