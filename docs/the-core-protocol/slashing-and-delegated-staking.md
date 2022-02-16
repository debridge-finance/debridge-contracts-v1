# Slashing and Delegated Staking

![](<../.gitbook/assets/A (1).png>)

Delegated staking and slashing mechanics act as a backbone of the protocol security and prevent economic incentives for validators to get into collusion to withdraw collateral locked in the `deBridgeGate` contract or mint an arbitrary amount of `deAssets`.

`DelegatedStaking` smart contract is part of the deBridge protocol and implements slashing and delegated staking logic. All validators place collateral that acts as a guarantee of validators' fairness. There are two ways to attract liquidity into collateral:

### Responsibility of Validators

All validators place collateral that acts as a guarantee of validators' fairness and may be used for slashing and compensation in case the incorrect operation of the validator's node led to a financial loss of any user within the deBridge ecosystem. Thus, in addition to reputational risks, validators are financially responsible for the proper operation of the protocol and its fault tolerance.\
There are two ways of how validators can attract liquidity into collateral:

1. Validators stake their own liquidity into collateral
2. Validators attract liquidity from delegators and share rewards paid by the protocol

### Delegated Staking

Any user/wallet can increase the collateral of any validator if he believes that this validator is reliable, knows how to manage infrastructure and there won't be any breakdowns and delays in the transaction's validation process performed by this validator.

The whitelist of assets that can be staked is managed by governance. Initially, only`ETH, USDT, USDC` assets will be available for staking. Stablecoins allow hedging collateral during periods of market volatility to avoid shrinking of total collateral USD value during the bear market stages.

If the user decides to unstake any amount of staked assets, a cooldown period of 14 days should pass from the time of unstaking request to the moment when the user is able to claim their assets. Later on, the cooldown period for unstaking will be reduced to 7 days. The cooldown period is needed for several reasons:

1. To avoid frontrunning, so that users do not stake only for a short period of time when they see that transaction volume passing through the protocol is high and it's a good time to stake for the validator to receive a part of its rewards
2. To give governance a time to slash validator collateral before delegators unstake their liquidity. Governance can pause/renew new stakes/unstakes and ongoing cooldowns for specific validators or delegators. Also in case of validators failure delegators who initiated unstaking (had active cooldown) before the timestamp of the incident will not be slashed.

Delegators can also transfer the stake between validators with a cooldown period of 2 days. This cooldown period is shorter since in case the user initiated transfer after the failure of the original validator, governance will still be able to slash his stake even if it will be already transferred to another validator. Governance has the power to slash the stake of the specific validator (including a stake of all delegators who staked for him) or slash a specific delegator in case the delegator manages to transfer the stake to another validator before slashing occurred.

Once unstaking or transfer of stake was initiated, the delegator stops receiving protocol rewards on the stake under cooldown period.

### Fees Distribution

As was described in Protocol Overview, the protocol takes a small fee from each transfer. Half of those fees are transferred to the deBridge treasury controlled by governance. Another half is converted in **ETH** and used as a payout to validators and their delegators. Each payout is evenly distributed among all active validators. Each validator assigns a portion of protocol payouts `profitSharingBPS` to be shared with delegators. These basis points allow the validator to control the ratio between personal/attracted amounts of liquidity. Governance can set a minimum value of this parameter to avoid a situation when validators with a low personal stake assign `profitSharingBPS` close to zero to receive all the protocol payouts and limit the collateral of the protocol.

Delegators receive payout proportional to USD equivalent of their stake in the validator's collateral pool. In order to perform proper distribution of protocol rewards and correctly calculate a USD value of the volatile assets, the smart contract utilizes Uniswap price oracle

### Additional APY for Delegators

In addition to deBridge protocol payouts, users can receive additional yield by supplying their liquidity locked in the delegated staking contract into strategies white-listed by the governance. Whitelisted strategies normally belong to well-known and reliable DeFi protocols such as AAVE, Compound, or Yearn.Finance. In this case, APYs of the deBridge protocol and of the strategy are summed up but in addition to the risk of validators' failure delegator will also bear a risk of the strategy where he desired to supply a locked stake.

All protocol payouts and strategy rewards top up the collateral of validators and should also pass cooldown period in order to become realized gain
