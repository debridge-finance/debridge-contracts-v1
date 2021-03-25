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

- [x] admin
- [x] one without admin permissions

**Scenario 2**: Withdraw unalocated Links:

- [x] admin
- [x] one without admin permissions

### Test Item: oracle-only functions

**Scope**: Test the withdrawing rewards of the contract.

**Action**: Invoke the `withdrawPayment`.

**Verification Steps**: Verify the operation only from authorized actors are permitted and the changes take effect.

**Scenario 1**: Withdraw by:

- [x] admin
- [x] one without admin permissions

**Scenario 2**: Withdraw amount:

- [x] less then total reward
- [x] higher then total reward

**Scope**: Test the oracles-related functions of the contract.

**Action**: Invoke the `submitMint`, `submitBurn` methods.

**Verification Steps**: Verify the operation only from authorized actors are permitted and the changes take effect.

**Scenario 1**: Test call by:

- [x] oracle
- [x] one without oracle permissions

**Scenario 2**: Test confirmation:

- [x] once
- [x] twice

**Scenario 3**: Test number of confirmation by different oracles:

- [x] 1 confirmations out of 3 (2 is required)
- [x] 2 confirmations out of 3 (2 is required)
- [x] 2 confirmations out of 3 (2 is required)

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

- [x] admin
- [x] not admin

**Scope**: Test adding/removing assets.

**Action**: Invoke the `setChainIdSupport`, `addNativeAsset`, `addExternalAsset` methods.

**Verification Steps**: Verify the operation works fine.

**Scenario 1**: Add asset by:

- [x] admin
- [x] not admin

**Scenario 2**: Add asset:

- [x] new
- [x] added before

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

**Action**: Invoke the `send` methods.

**Verification Steps**: Verify the operation works fine.

**Scenario 1**: Call send with different chains when:

- [x] the current chain's asset
- [x] the outside asset

**Scenario 2**: Call send with different target chains when:

- [x] the target chain is supported
- [x] the target chain isn't supported

**Scenario 3**: Call send with different amounts:

- [x] the amount is enough
- [x] to few tokens

**Scenario 4**: Call send with different assets:

- [x] the ERC20
- [x] native token

**Scope**: Test mint.

**Action**: Invoke the `mint` methods.

**Verification Steps**: Verify the operation works fine.

**Scenario 1**: Call mint with different approvals when:

- [x] the mint is approved
- [x] the mint isn't approved

**Scenario 2**: Call mint few times:

- [x] first time
- [x] second time

**Scenario 3**: Call mint with different chains:

- [x] supported chain
- [x] prohibited chain

**Scope**: Test burn.

**Action**: Invoke the `burn` methods.

**Verification Steps**: Verify the operation works fine.

**Scenario 1**: Call burn with different chains when:

- [x] with the current chain
- [x] with the different chain

**Scenario 2**: Call burn with diffrent amounts when:

- [x] enough tokens are transfered
- [x] too few tokens are sent

**Scope**: Test claim.

**Action**: Invoke the `claim` methods.

**Verification Steps**: Verify the operation works fine.

**Scenario 1**: Call claim with different chains when:

- [x] the current chain's asset
- [x] the outside asset

**Scenario 2**: Call claim with different confirmations when:

- [x] the burnt is confiremd
- [x] the burnt isn't confirmed

**Scenario 3**: Call claim few times:

- [x] in the first time
- [x] in the second time

**Scenario 4**: Call claim with different assets:

- [x] the ERC20
- [x] native token

### Test Item: fee management

**Scope**: Test fee withdrawal.

**Action**: Invoke the `withdrawFee` methods.

**Verification Steps**: Verify the operation works fine.

**Scenario 1**: Call `withdrawFee` by :

- [x] admin
- [x] non-admin

**Scenario 2**: Call `withdrawFees` with different chains when:

- [x] the current chain's asset
- [x] the outside asset

**Scenario 3**: Call `withdrawFee` with different assets:

- [x] the ERC20
- [x] native token

**Scope**: Test fund aggregator.

**Action**: Invoke the `fundAggregator` methods.

**Verification Steps**: Verify the operation works fine.

**Scenario 1**: Call `fundAggregator` by :

- [ ] admin
- [ ] non-admin

**Scenario 2**: Call `fundAggregator` with different chains when:

- [ ] the current chain's asset
- [ ] the outside asset

**Scenario 3**: Call `fundAggregator` with different assets:

- [ ] the ERC20
- [ ] native token

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

  - [x] function send
  - [x] function mint
  - [x] function burn
  - [x] function claim
  - [x] function addNativeAsset
  - [x] function addExternalAsset
  - [x] function setChainIdSupport
  - [x] function setAggregator
  - [x] function setFeeProxy
  - [x] function setDefiController
  - [x] function setWeth
  - [ ] function withdrawFee
  - [ ] function requestReserves
  - [ ] function returnReserves
  - [ ] function fundAggregator
