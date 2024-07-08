---
description: >-
  Delegated staking module will be deployed after the deBridge governance token
  is live
---

# Slashing and Delegated Staking

<figure><img src="../.gitbook/assets/Header (1).png" alt=""><figcaption></figcaption></figure>

Delegated staking and slashing mechanics act as a backbone of protocol security and prevent economic incentives for validators to get into collusion and forge messages.

A `DelegatedStaking` smart contract is part of the deBridge protocol and implements slashing and delegated staking logic. Anyone (including validators themselves) can delegate liquidity for validators which act as a financial guarantee of validators' fairness. There are two ways to attract liquidity into collateral:

### Responsibility of Validators

The liquidity delegated to validators may be used for slashing in case validators validated forged or censored message. In this case, anyone who had a financial loss due to validator misbehavior will be compensated by deBridge governance from the amount slashed from the validator's collateral.&#x20;

Thus, in addition to reputational risks, validators are financially responsible for the proper operation of the protocol and its fault tolerance. There are two ways how validators can attract liquidity into collateral:

1. Validators stake their own liquidity into collateral
2. Validators attract liquidity from delegators and share rewards paid by the protocol

### Delegated Staking

Any user/wallet can increase the collateral of any validator if they believe that this validator is reliable, knows how to manage infrastructure, and won't incur any breakdowns and delays in the processing and validation of transactions.

The whitelist of assets that can be staked is managed by governance. Initially, only`ETH, USDT, USDC` assets will be available for staking. Stablecoins allow hedging collateral during periods of market volatility to avoid shrinking of total collateral USD value during the bear market stages.

If the user decides to unstake any amount of staked assets, a cooldown period of 14 days should pass from the time of the unstaking request to the moment the user is able to claim their assets. Later on, the cooldown period for unstaking will be reduced to 7 days. The cooldown period is needed for several reasons:

1. To avoid front-running, so that users do not stake opportunistically for a short period of time to capitalize on rewards during periods of high volumes
2. To give governance a time to slash validator collateral before delegators unstake their liquidity. Governance can pause/renew new stakes/unstakes and ongoing cooldowns for specific validators or delegators. Also in case of failure, delegators who initiated unstaking (had active cooldown) before the timestamp of the incident will not be slashed

Delegators can also transfer the stake between validators with a cooldown period of 2 days. This cooldown period is shorter since in case the user initiated a transfer after the failure of the original validator, governance will still be able to slash their stake even if it has already been transferred to another validator. Governance has the power to slash the stake of the specific validator (including a stake of all delegators who staked for them) or slash a specific delegator in case the delegator manages to transfer the stake to another validator before slashing occurs.

Once unstaking or transfer of stake has been initiated, the delegator stops receiving protocol rewards on the stake under the cooldown period.

### Fees Distribution

As described in the protocol overview, deBridge infrastructure applies a small fee for each message and value transfer. Half of these fees are transferred to the deBridge treasury controlled by governance. Another half is converted into **ETH** and used as a payout to validators and their delegators. Each payout is evenly distributed among all active validators.&#x20;

Each validator assigns a portion of protocol payouts `profitSharingBPS` to be shared with delegators. These basis points allow the validator to control the ratio between personal/attracted amounts of liquidity. Governance can set a minimum value of this parameter to avoid a situation when validators with a low personal stake assign `profitSharingBPS` close to zero to receive all the protocol payouts and limit the collateral of the protocol.

Delegators receive a payout proportional to the USD equivalent of their stake in the validator's collateral pool. In order to perform the proper distribution of protocol rewards and correctly calculate a USD value of the volatile assets, the smart contract utilizes the oracle price feed of the staked assets.
