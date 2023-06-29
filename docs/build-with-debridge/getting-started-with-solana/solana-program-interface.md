---
description: How to interact with deBridge on Solana
---

# Solana program interface

To streamline communication with deBridge programs on the Solana blockchain, the [debridge-solana-sdk](https://github.com/debridge-finance/debridge-solana-sdk) has been developed. This [Rust](https://github.com/rust-lang/rust) SDK allows for easy and efficient connection to the deBridge infrastructure, which enables decentralized transfers of messages and value between different blockchains.

To start using our sdk, add it to dependencies by [cargo](https://github.com/rust-lang/cargo):

```bash
cargo add debridge-solana-sdk
```

If you use the [Anchor](https://github.com/coral-xyz/anchor) framework, then your program calling for a deBridge send might look like this:

```rust
use anchor_lang::prelude::*;

declare_id!("3botMWU4s1Lcs4Q2wQBkZqsCW1vc3N9H9tY9SZYVs5vZ");

#[program]
pub mod send_via_debridge {
    use debridge_solana_sdk::prelude::*;

    use super::*;

    pub fn send_via_debridge(ctx: Context<SendViaDebridge>) -> Result<()> {
        invoke_debridge_send(
            // Debridge Instruction Data
            SendIx {
                // Chain id to which the tokens are sent
                target_chain_id: chain_ids::POLYGON_CHAIN_ID,
                /// Address in `target_chain_id` that will receive the transferred tokens
                receiver: hex::decode("bd1e72155Ce24E57D0A026e0F7420D6559A7e651").unwrap(),
                // Use of fee in transfer token (not currently enabled)
                is_use_asset_fee: false,
                // Amount of sending tokens. From this amount fee will be taken
                amount: 1000,
                // Additional data for tokens sending with auto external execution
                submission_params: None,
                // Referral code to track your transfers
                referral_code: None,
            },
            // List of accounts used by debridge-program, generated on the client
            ctx.remaining_accounts,
        )
        .map_err(|err| err.into())
    }
}

#[derive(Accounts)]
pub struct SendViaDebridge {}
```

You can use any account in your logic. However, the remaining accounts you pass on will have to be created by the client. Our SDK provides an [example](https://github.com/debridge-finance/debridge-solana-sdk/tree/master/example-program/ts-examples) of how to use the TypeScript library. For this example it is:

```typescript
import { DeBridgeSolanaClient } from "@debridge-finance/solana-contracts-client";
import { AnchorProvider, Program, Wallet as AnchorWallet } from "@coral-xyz/anchor";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import { crypto, helpers, WRAPPED_SOL_MINT } from "@debridge-finance/solana-utils";

const connection = new Connection(clusterApiUrl("mainnet-beta"));
const example = new Program(
    ExampleIDL,
    "3botMWU4s1Lcs4Q2wQBkZqsCW1vc3N9H9tY9SZYVs5vZ",
    new AnchorProvider(connection, {} as unknown as AnchorWallet, {}),
  );
const deBridge = new DeBridgeSolanaClient(connection, undefined, {
    programId: "DEbrdGj3HsRsAzx6uH4MKyREKxVAfBydijLUF3ygsFfh",
    settingsProgramId: "DeSetTwWhjZq6Pz9Kfdo1KoS5NqtsM6G8ERbX4SSCSft",
  });

const chainTo = 137;
const receiver = "0xbd1e72155Ce24E57D0A026e0F7420D6559A7e651";
const amount = 1000;
const tokenMint = WRAPPED_SOL_MINT;

const builder = example.methods.sendViaDebridge(
    amount,
    Array.from(crypto.normalizeChainId(chainTo)),
    helpers.hexToBuffer(receiver),
    false,
  );

const context = await deBridge.buildSendContext(
    sender,
    null,
    tokenMint,
    receiver,
    chainTo,
    false,
    receiver,
  );
builder.remainingAccounts([...context.asAccountMeta, { isWritable: false, isSigner: false, pubkey: deBridge.program.programId }]);
const tx = await builder.transaction();

```

The dependency packages that are used:

* [@debridge-finance/solana-contracts-client](https://www.npmjs.com/package/@debridge-finance/solana-contracts-client)&#x20;
* [@debridge-finance/solana-utils](https://www.npmjs.com/package/@debridge-finance/solana-utils)
* [@coral-xyz/anchor](https://www.npmjs.com/package/@coral-xyz/anchor)
* [@solana/web3.js](https://www.npmjs.com/package/@solana/web3.js)

For detailed examples, within the SDK there is an [example-program](https://github.com/debridge-finance/debridge-solana-sdk/tree/master/example-program) project that allows you to see examples of various integrations and the corresponding client code for them. For example:

* [send\_via\_debridge](https://github.com/debridge-finance/debridge-solana-sdk/blob/7bb2ed38a135d3550dadfd00bdc78f50c19a701d/example-program/programs/debridge-solana-sdk-example/src/lib.rs#L38)
* [send\_via\_debridge\_with\_native\_fixed\_fee](https://github.com/debridge-finance/debridge-solana-sdk/blob/7bb2ed38a135d3550dadfd00bdc78f50c19a701d/example-program/programs/debridge-solana-sdk-example/src/lib.rs#L69)
* [send\_via\_debridge\_with\_exact\_amount](https://github.com/debridge-finance/debridge-solana-sdk/blob/7bb2ed38a135d3550dadfd00bdc78f50c19a701d/example-program/programs/debridge-solana-sdk-example/src/lib.rs#L140)
* [send\_via\_debridge\_with\_asset\_fixed\_fee](https://github.com/debridge-finance/debridge-solana-sdk/blob/7bb2ed38a135d3550dadfd00bdc78f50c19a701d/example-program/programs/debridge-solana-sdk-example/src/lib.rs#L69)
* [send\_via\_debridge\_with\_execution\_fee](https://github.com/debridge-finance/debridge-solana-sdk/blob/7bb2ed38a135d3550dadfd00bdc78f50c19a701d/example-program/programs/debridge-solana-sdk-example/src/lib.rs#L177)
* [send\_via\_debridge\_with\_external\_call](https://github.com/debridge-finance/debridge-solana-sdk/blob/7bb2ed38a135d3550dadfd00bdc78f50c19a701d/example-program/programs/debridge-solana-sdk-example/src/lib.rs#L211)
* [send\_message\_via\_debridge](https://github.com/debridge-finance/debridge-solana-sdk/blob/7bb2ed38a135d3550dadfd00bdc78f50c19a701d/example-program/programs/debridge-solana-sdk-example/src/lib.rs#L259)
* [check\_claiming](https://github.com/debridge-finance/debridge-solana-sdk/blob/7bb2ed38a135d3550dadfd00bdc78f50c19a701d/example-program/programs/debridge-solana-sdk-example/src/lib.rs#L371)

```rust
```
