# Affiliate fees

### Same-chain affiliate fees <a href="#single-chain-affiliate-fees" id="single-chain-affiliate-fees"></a>

#### EVM single-chain affiliate fee <a href="#evm-single-chain-affiliate-fee" id="evm-single-chain-affiliate-fee"></a>

To get affiliate fee when user performs single-chain swap on Solana chain `affiliteFeeBeneficiary` & `affiliateFeePercent` request params should be set.

* Affiliate fee percent - percent of the **output amount** to receive as fee
* Affiliate fee beneficiary - evm address that will receive fee

#### Solana single-chain affiliate fee <a href="#solana-single-chain-affiliate-fee" id="solana-single-chain-affiliate-fee"></a>

To get affiliate fee when user performs single-chain swap on Solana chain `affiliteFeeBeneficiary` & `affiliateFeePercent` request params should be set.

* Affiliate fee percent - percent of the **output amount** to receive as fee
* Affiliate fee beneficiary - Jupiter referral key, could be generated at [https://referral.jup.ag/dashboard](https://referral.jup.ag/dashboard) . Fees could be claimed at jupiter referral dashboard

### Cross-chain affiliate fees <a href="#cross-chain-affiliate-fees" id="cross-chain-affiliate-fees"></a>

Integrator could receive affiliate fee from order creation. `affiliteFeeBeneficiary` & `affiliateFeePercent` request params should be set.

* Affiliate fee percent - percent of input order amount that will be sent to affiliate fee beneficiary on order completion
* Affiliate fee beneficiary - receiver of the affiliate fee. Pubkey for Solana, address for EVM

Withdrawal details could be found [here](../interacting-with-smart-contracts/withdrawing-affiliate-fees.md)
