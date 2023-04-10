# Getting started

## dePort

![](<../.gitbook/assets/27 (1).png>)

[**dePort**](https://app.debridge.finance/deport) is a native bridge for assets that allows protocols to bridge tokens and create utility for their synthetic representation (deTokens) in other chains.&#x20;

dePort utilizes a locking and minting approach where the native token is locked/unlocked in a deBridgeGate smart contract in the native chain and its synthetic representation (deAsset) is minted/burnt in secondary chains.

For each asset, under the **native chain**, we assume the unique blockchain where the token was originally created.

**Secondary chains** are blockchains supported by deBridge to which tokens can be transferred/bridged and where deAssets are minted.

### Collateralization

Each of the tokens locked in the native chain have the associated wrapped asset on the target chains. By design, the protocol ensures that the total supply of each deAsset that can be minted in secondary chains is always 1:1 backed by the asset collateral locked in the deBridgeGate smart contract in the native chain. That provides a flawless user experience and guarantees that the user will never face a liquidity imbalance problem which is often encountered in other bridging solutions, where users face significant delays after they already locked liquidity in the bridge.

### Listing at deBridge

The deBridge protocol is universal and there are no listing requirements. Any arbitrary token can be bridged. If the token is bridged for the first time, together with the validation transaction validators sign a unique `deployId` that is passed to the destination chain and contains the following parameters:

* Native token smart contract address
* Native chain Id
* Token name
* Token symbol
* Decimals

The wrapped (deAsset) is deployed on the target chain automatically together with the first claim of the wrapped asset. Thus, no additional actions are required from the user, listing is performed automatically by deBridge validators who sign a unique deployment ID. At deBridge, we care about user experience and strive to minimize unnecessary actions to be performed by protocol users.
