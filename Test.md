## Test cases

## Test Item: WhiteAggregator

### General requirements

1. Oracles allowed to submit the data are set by the admin.
2. The number of the required confirmatios is set by the admin.
3. The contract holds the Links.
4. The oracles receives the reward to their virtual balance after submission.
5. The reward can be withdrawn any time.
6. The admin can withdraw unalocated Links any time.
7. The oracle's payment can be configured by the admin.
8. The mint and burnt requests are confirmed only after requered amount of confirmations are received.

### Test Item: admin-only functions

**Scope**: Test the configurations of the contract.

**Action**: Invoke the `setMinConfirmations`, `setPayment`, `addOracle`, `removeOracle` methods.

**Verification Steps**: Verify the operation only from authorized actors are permitted and the changes take effect.

**Scenario 1**: Update configs by:

- [ ] admin
- [ ] one without admin permissions

**Scenario 2**: Withdraw unalocated Links:

- [ ] admin
- [ ] one without admin permissions

**Scenario 3**: Withdraw unalocated Links:

- [ ] admin
- [ ] one without admin permissions

### Test Item: oracle-only functions

**Scope**: Test the withdrawing rewards of the contract.

**Action**: Invoke the `withdrawPayment`.

**Verification Steps**: Verify the operation only from authorized actors are permitted and the changes take effect.

**Scenario 1**: Withdraw by:

- [ ] admin
- [ ] one without admin permissions

**Scenario 2**: Withdraw amount:

- [ ] less then total reward
- [ ] higher then total reward

**Scope**: Test the oracles-related functions of the contract.

**Action**: Invoke the `submitMint`, `submitBurn` methods.

**Verification Steps**: Verify the operation only from authorized actors are permitted and the changes take effect.

**Scenario 1**: Test call by:

- [ ] oracle
- [ ] one without oracle permissions

**Scenario 2**: Test confirmation:

- [ ] once
- [ ] twice

**Scenario 3**: Test number of confirmation by different oracles:

- [ ] 1 confirmations out of 3 (2 is required)
- [ ] 2 confirmations out of 3 (2 is required)
- [ ] 2 confirmations out of 3 (2 is required)

## Test Item: WrappedAsset

### General requirements

1. Implements ERC20 and ERC2612.
2. Only admin can set minters.
3. Only minters can create new tokens.
4. Only minters can burn tokens.

### Test Item: admint-only functions

**Scope**: Test the minter functions of the contract.

**Action**: Invoke the `grantRole` methods.

**Verification Steps**: Verify the operation only from authorized actors are permitted and the changes take effect.

**Scenario 1**: Call `grantRole` by:

- [ ] admin
- [ ] one without admin permissions

### Test Item: minter-only functions

**Scope**: Test the minter functions of the contract.

**Action**: Invoke the `mint`, `burn` methods.

**Verification Steps**: Verify the operation only from authorized actors are permitted and the changes take effect.

**Scenario 1**: Call `mint` by:

- [ ] minter
- [ ] one without minter permissions

**Scenario 2**: Call `burn` by:

- [ ] minter
- [ ] one without minter permissions

### Test Item: off-chain permit

**Scope**: Test the off-chain permit of the contract.

**Action**: Invoke the `permit` methods.

**Verification Steps**: Verify the operation only with the correct signature are permitted and the changes take effect.

**Scenario 1**: Call `permit`:

- [ ] with correct signature
- [ ] without correct signature

## Test Item: WhiteDebridge

### General requirements

1. Admin can add the support for the assets.
2. Both native chain's token and ERC20 tokens can be added.
3. If the asset isn't from the current chain the new wrapped asset (ERC20) is created.
4. To succeed the token transfer should be supported on both chains.
5. The transfer fee is charged when the transfer from original chain is started and/or returned back to the original chain.
6. The collected fees can be swapped to Link token and used to fund the CL aggregator.
7. Part of the fee can be withdrawn.
8. The aggregator can be replaced.
9. The part of locked tokens can be used in DEFI protocol.
10. The transfers must be confirmed by the oracles to be compleated.

### Test Item: admin-only actions

**Scope**: Test configurations.

**Action**: Invoke the `setAggregator`, `setFeeProxy`, `setDefiController`, `setWeth` methods.

**Verification Steps**: Verify the operation works fine.

**Scenario 1**: Call each of the methods by:

- [ ] admin
- [ ] not admin

**Scope**: Test adding/removing assets.

**Action**: Invoke the `setChainIdSupport`, `addNativelAsset`, `addExternalAsset` methods.

**Verification Steps**: Verify the operation works fine.

**Scenario 1**: Add asset by:

- [ ] admin
- [ ] not admin

**Scenario 2**: Add asset:

- [ ] new
- [ ] added before

**Scope**: Test fee managemnet.

**Action**: Invoke the `fundAggregator`, `withdrawFee` methods.

**Verification Steps**: Verify the operation works fine.

**Scenario 1**: Calle methods by:

- [ ] admin
- [ ] not admin

**Scenario 2**: Try to withdraw fee:

- [ ] more than collected fee
- [ ] less than collected fee

**Scenario 3**: Try to fund the aggregator:

- [ ] more than collected fee
- [ ] less than collected fee

**Scenario 4**: Try to use fees:

- [ ] collected from the asset on the current chain
- [ ] collected from the asset on the other chain

### Test Item: users actions

**Scope**: Test send.

**Action**: Invoke the `setAggregator`, `setFeeProxy`, `setDefiController`, `setWeth` methods.

**Verification Steps**: Verify the operation works fine.

**Scenario 1**: Call each of the methods by:

- [ ] admin
- [ ] not admin

## Test Item: FeeProxy

### General requirements

1. Should swap any tokens on the balance to Link.

### Test Item: off-chain permit

**Scope**: Test swap.

**Action**: Invoke the `swapToLink` methods.

**Verification Steps**: Verify the operation works fine.

**Scenario 1**: Call `permit`:

- [ ] swap native asset
- [ ] swap token
