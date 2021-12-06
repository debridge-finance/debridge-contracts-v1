# Debridge Smart Contracts

# [Complete Documentation https://docs.debridge.finance/](https://docs.debridge.finance/)

UI deployed on [testnet.debridge.finance](https://testnet.debridge.finance/)

The contracts' directory contains the following subfolders:

```
contracts/
	interfaces/ - contains interfaces of the project contracts
	libraries/ - libraries created for the project
	mock/ - contracts for tests
	oracles/ - related to oracle's stake management
	periphery/ - periphery contracts
	transfers/ - related to core cross-chain functionality
```
The detailed methods' description can be found in the contracts themselves or in the [documentation](https://docs.debridge.finance/). 

## Periphery
### CallProxy
Proxy to execute the other contract calls. This contract is used when a user requests transfer with specific call of other contract.
### DeBridgeToken
ERC20 token that is used as wrapped asset to represent the native token value on the other chains.
### DeBridgeTokenProxy
This contract implements a proxy that gets the implementation address for each call from DeBridgeTokenDeployer.
It's deployed by DeBridgeTokenDeployer.
Implementation is DeBridgeToken.
### SimpleFeeProxy
Helper to withdraw fees from DeBridgeGate and transfer them to a treasury.
## Transfers
### AggregatorBase
The base contract for Chainlink oracles management. 
Allows adding/removing oracles, managing the minimal required amount of confirmations and assigning oracle admins.
### DeBridgeGate
Contract for assets transfers. The user can transfer the asset to any of the approved chains. 
The admin manages the assets, fees and other important protocol parameters.

### DeBridgeTokenDeployer
Deploys a deToken(DeBridgeTokenProxy) for an asset.
### SignatureVerifier
It's deployed to a chain with high fees and is used to verify the transfer by oracles signatures. 
### WethGate
Upgradable contracts cannot receive ether via `transfer` because of increased SLOAD gas cost.
We use this non-upgradeable contract as the recipient and then immediately transfer to an upgradable contract.
More details about this issue can be found [here](https://forum.openzeppelin.com/t/openzeppelin-upgradeable-contracts-affected-by-istanbul-hardfork/1616). 


## [How Transfers Works](https://docs.debridge.finance/the-core-protocol/transfers)

## Information for developers
### Test
Create a .env file with the content below (all are default values from ganache)
```dotenv
TEST_BSC_PROVIDER=https://bsc-dataseed.binance.org/
TEST_ORACLE_KEYS=["0x512aba028561d58c914fdcb31cc7f4dd9a433cb3672eb9eaf44302eb097ec3bc","0x79b2a2a43a1e9f325920f99a720605c9c563c61fb5ae3ebe483f83f1230512d3","0xefb1529474de412cfeb875bc13c47fe3032202bdf777f350415c877eddad62ba","0xed4a4d31740e08e1f30854271fdc31758349b89c9ae9da86711ed3001f1dc409","0x49378a90c0b6c07c5cadcfcb13222bd12eebb4e96455ff48b57e54baa12c91c1","0x1029e16ddabd4f7f38a175464eba097aea1173840f4286551ec435903823e94a","0xf4d8a0f92a47559cd2fb91ae67fe1c36de46b577695f4a44ce026b59b01289c6","0x6f3255cdf01eee387574036f0183c6b024dadc6aa4e5bb272d0564403e2e579f","0x40775e39b578b0ab1603f87636c9fac9697487d918d4647df7f8549c6eff3d09","0x3ecd7955f78fbd0c9025a742f778d8b292fb3c8544a17c1adb77fbe20f21bb63"]
MNEMONIC="cactus require cushion flavor mobile behave pole time wasp silk moon correct"
DEPLOYER_PRIVATE_KEY="0x512aba028561d58c914fdcb31cc7f4dd9a433cb3672eb9eaf44302eb097ec3bc"
DEPLOYER_ACCOUNT="0x6AFb86b6eE3A6a3F42Ae2526157f753DDdbd2f1E"
MULTISIG_ACCOUNT="0xe13E4F9441a381F54eD969c768713157D125e216"
```
then run `yarn test`