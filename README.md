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

## [How Transfers Works](https://docs.debridge.finance/the-core-protocol/transfers)

## Test
Create a .env file with the content below (all are default values from ganache)
```dotenv
TEST_BSC_PROVIDER=https://bsc-dataseed.binance.org/
TEST_ORACLE_KEYS=["0x512aba028561d58c914fdcb31cc7f4dd9a433cb3672eb9eaf44302eb097ec3bc","0x79b2a2a43a1e9f325920f99a720605c9c563c61fb5ae3ebe483f83f1230512d3","0xefb1529474de412cfeb875bc13c47fe3032202bdf777f350415c877eddad62ba","0xed4a4d31740e08e1f30854271fdc31758349b89c9ae9da86711ed3001f1dc409","0x49378a90c0b6c07c5cadcfcb13222bd12eebb4e96455ff48b57e54baa12c91c1","0x1029e16ddabd4f7f38a175464eba097aea1173840f4286551ec435903823e94a","0xf4d8a0f92a47559cd2fb91ae67fe1c36de46b577695f4a44ce026b59b01289c6","0x6f3255cdf01eee387574036f0183c6b024dadc6aa4e5bb272d0564403e2e579f","0x40775e39b578b0ab1603f87636c9fac9697487d918d4647df7f8549c6eff3d09","0x3ecd7955f78fbd0c9025a742f778d8b292fb3c8544a17c1adb77fbe20f21bb63"]
MNEMONIC="cactus require cushion flavor mobile behave pole time wasp silk moon correct"
DEPLOYER_PRIVATE_KEY="0x512aba028561d58c914fdcb31cc7f4dd9a433cb3672eb9eaf44302eb097ec3bc"
DEPLOYER_ACCOUNT="0x6AFb86b6eE3A6a3F42Ae2526157f753DDdbd2f1E"
MULTISIG_ACCOUNT="0xe13E4F9441a381F54eD969c768713157D125e216"
INFURA_ID=xxx # Change to your infura id
```
then run `yarn test`

## Docs generation
`yarn docs`

## Troubleshooting
###  Cannot find module '../typechain-types' or its corresponding type declarations.
`hardhat clean`
>> https://github.com/dethcrypto/TypeChain/tree/master/packages/hardhat#installation
> 
>Warning: before running it for the first time you need to do hardhat clean, otherwise TypeChain will think that there is no need to generate any typings. This is because this plugin will attempt to do incremental generation and generate typings only for changed contracts. You should also do hardhat clean if you change any TypeChain related config option.