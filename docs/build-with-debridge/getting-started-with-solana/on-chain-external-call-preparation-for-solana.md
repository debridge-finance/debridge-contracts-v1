# On-Chain external call preparation for Solana

Preparing an extcall to call programmes in Solana is simple:

## 1. Instruction

Identify the `Instruction`-s you need to call in Solana. For example, the following `Instruction`

```rust
Instruction {
    // Constant
    // 0x8c97258f4e2489f1bb3d1029148e0d830b5a1399daff1084048e7bd8dbe9f859
    program_id: Pubkey::from_str("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL").unwrap(),
    accounts: vec![
        // Pubkey Auth Placeholder, constant
        AccountMeta {
            // 0x1968562fef0aab1b1d8f99d44306595cd4ba41d7cc899c007a774d23ad702ff6
            pubkey: Pubkey::from_str("2iBUASRfDHgEkuZ91Lvos5NxwnmiryHrNbWBfEVqHRQZ")
                .unwrap(),
            is_signer: true,
            is_writable: true,
        },
        // Can be any - not important, will be replaced by substituion  later
        AccountMeta {
            // 0x9f3d96f657370bf1dbb3313efba51ea7a08296ac33d77b949e1b62d538db37f2
            pubkey: Pubkey::from_str("BicJ4dmuWD3bfBrJyKKeqzczWDSGUepUpaKWmC6XRoJZ")
                .unwrap(),
            is_signer: false,
            is_writable: true,
        },
    ],
    // Constant
    data: vec![1],
}
```

can be represented in Solidity as follows:

```solidity
DeBridgeSolana.AccountMeta[] memory accountMetas = new DeBridgeSolana.AccountMeta[](2);
accountMetas[0] = DeBridgeSolana.AccountMeta({
  // 2iBUASRfDHgEkuZ91Lvos5NxwnmiryHrNbWBfEVqHRQZ
  pubkey: 0x1968562fef0aab1b1d8f99d44306595cd4ba41d7cc899c007a774d23ad702ff6,
  is_signer: true,
  is_writable: true
});
accountMetas[1] = DeBridgeSolana.AccountMeta({
  // BicJ4dmuWD3bfBrJyKKeqzczWDSGUepUpaKWmC6XRoJZ
  pubkey: 0x9f3d96f657370bf1dbb3313efba51ea7a08296ac33d77b949e1b62d538db37f2,
  is_signer: false,
  is_writable: true
});
    
DeBridgeSolana.ExternalInstruction memory externalInstruction = DeBridgeSolana.ExternalInstruction({
  // [...]

  instruction: DeBridgeSolana.Instruction({
    // ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL
    program_id: 0x8c97258f4e2489f1bb3d1029148e0d830b5a1399daff1084048e7bd8dbe9f859,
    accounts: accountMetas,
    data: hex"1"
  })
});
```

## 2. Expenses

Determine how much lamports your instruction spends on the destination network (most often account creation). Record this value as expenses. Each instruction is technically worth 5000 lamports (since we can't determine how many resources it will spend in advance, the implication is that it can be executed in a separate transaction). Therefore, 5000 + expenses is the estimate of how much lamports will cost the execution.

```solidity

DeBridgeSolana.ExternalInstruction memory externalInstruction = DeBridgeSolana.ExternalInstruction({
  // [...]
  
  expense: 5000,
});
```

## 3. Pubkey substituion

Determine which accounts in the instruction are input dependent and cannot be passed directly from the user for security reasons.

For example, if there is a PDA in the destination network that depends on some unique transfer identifier, then we need to form `PubkeySubstituio.`

This gives the following Solidity code:

```solidity
bytes[] memory seeds = new bytes[](3);
seeds[0] = DeBridgeSolanaPubkeySubstitutions.getSubmissionAuthSeed();
seeds[1] = DeBridgeSolanaPubkeySubstitutions.getArbitrarySeed(
  abi.encodePacked(bytes32(tokenId)) // input parameter
);
seeds[2] = DeBridgeSolanaPubkeySubstitutions.getArbitrarySeed(
  abi.encodePacked(bytes32(splNativeMint)) // input parameter
);
    
DeBridgeSolana.PubkeySubstitutionTuple[] memory pubkeySubstitutions = new DeBridgeSolana.PubkeySubstitutionTuple[](1);
pubkeySubstitutions[0] = DeBridgeSolana.PubkeySubstitutionTuple({
  u64: 1,
  data: DeBridgeSolanaPubkeySubstitutions.serialize(
    DeBridgeSolanaPubkeySubstitutions.BySeeds({
      program_id: ASSOCIATED_TOKEN_PROGRAM, // input parameter
      seeds: seeds,
      bump: 0 // None
    })
  )
});

DeBridgeSolana.ExternalInstruction memory externalInstruction = DeBridgeSolana.ExternalInstruction({
  // [...]
  
  pubkey_substitutions: pubkeySubstitutions
});
```



If the user can't break protocol rules by passing a any Pubkey, then you can take that key directly from the user's input and you don't need substituion.

## 4. DataSubstitution

If you need a transfer amount as part of your transfer and it cannot be calculated in advance, then you must use `DataSubstitution`. One substitution is now available (`SubmissionAuthWalletAmount`) which works as follows. Takes the `account_index` account of the current instruction, interprets it as a token account, takes its balance, chooses its encoding (big endian, little endian), use `substration` and inserts it into the current instruction by `offset` before calling it.

```solidity
// use DeBridgeSolanaDataSubstitutions to generate data substutions
DeBridgeSolana.DataSubstitution[] memory dataSubstitutions = 
  new DeBridgeSolana.DataSubstitution[](0);

DeBridgeSolana.ExternalInstruction memory externalInstruction = DeBridgeSolana.ExternalInstruction({
  // [...]
  
  data_substitutions: dataSubstitutions
});
```

This way you can transfer the whole wallet balance except for some part of it (e.g. for the next transfers).

## 5. Reward

The last one is to set the reward. Since for almost any transfer it will depend on the difference between the price of the fee and SOL asset, it will almost always be reported externally. Reward should cover 5000 lamports and all expenses. In the execution phase, the executor evaluates the 5000 + expenses in the translation token and if the reward covers the execution, then executes the translation.

```solidity

DeBridgeSolana.ExternalInstruction memory externalInstruction = DeBridgeSolana.ExternalInstruction({
  // [...]
  
  reward: 5000
}); 
```

## 6. Final

This algorithm should be done for each instruction in your extcall. The total instruction set must be less than 10 kilobytes.

When you have prepared all the necessary instructions, you need to generate a binary buffer and send it through debridge as external call:

```
DeBridgeSolana.ExternalInstruction memory externalInstruction = DeBridgeSolana.ExternalInstruction({
  // [...]
}); 

// or import the lib: using DeBridgeSolanaSerializer for DeBridgeSolana.ExternalInstruction;
DeBridgeSolanaSerializer.serialize(externalInstruction);
```

