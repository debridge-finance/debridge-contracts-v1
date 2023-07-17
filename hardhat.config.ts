import { config as dotenvConfig } from 'dotenv-flow';

import { task } from "hardhat/config"
import '@nomiclabs/hardhat-truffle5';
import 'hardhat-deploy';
import '@nomiclabs/hardhat-waffle';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import '@nomiclabs/hardhat-solhint';
import 'prettier-plugin-solidity';
import 'solidity-coverage';
import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import "@nomiclabs/hardhat-etherscan";

dotenvConfig();

export default {
  gasReporter: {
    currency: "USD",
    gasPrice: 100,
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./scripts/deploy"
  },
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */
  //61e2db80d80fef89b7a5fa748cf46471cb2fa91f0248ee36675d5e28a84d932b
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.6.11",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  external: {
    contracts: [
      {
        artifacts: "./precompiled",
      },
    ],
  },
  namedAccounts: {
    deployer: 0
  },
  networks: {
    hardhat: {
      accounts:{mnemonic:process.env.MNEMONIC},
      chainId: 1
    },
    test: {
      url: "http://127.0.0.1:8545",
      accounts: {mnemonic:process.env.MNEMONIC},
    },
    kovan: {
      url: "https://kovan.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      gasPrice: 3e9,
      gas: 6.9e6,
      chainId: 42
    },
    bsctest: {
      url: "https://data-seed-prebsc-1-s2.binance.org:8545/",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 97
    },
    hecotest: {
      url: "https://http-testnet.hecochain.com/",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      // gasPrice: 1e9,
      chainId: 256
    },
    arethtest: {
      url: "https://rinkeby.arbitrum.io/rpc",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      // gasPrice: 1e9,
      // gas: 1e6,
      chainId: 421611
    },
    mumbai: {
      // url: "https://rpc-mumbai.maticvigil.com",
      url:"https://apis.ankr.com/28e515e83aba427a8334cf38d63d0ae6/363542f636c41556afec7d1feb0f0a88/polygon/full/test",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      // gasPrice: 1e10, //10 Gwei
      chainId: 80001
    },
    RINKEBY: {
      url: "https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      gasPrice: 2e9,
      //gas: 6.9e6,
      chainId: 4
    },
    ETH: {
      // url: "http://127.0.0.1:8545",
      // accounts:{mnemonic:process.env.MNEMONIC},
      url: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      // gasPrice: 95e9,
      // gas: 6.9e6,
      chainId: 1
    },
    BSC: {
      url: "https://bsc-dataseed.binance.org/",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      gasPrice: 5e9,
      //gas: 6e6,
      chainId: 56
    },
    HECO: {
      url: "https://http-mainnet.hecochain.com",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      // gasPrice: 5e9,
      // gas: 6e6,
      chainId: 128
    },
    MATIC: {
      url: "https://polygon-rpc.com/",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      // gasPrice: 5e9,
      // gas: 6e6,
      chainId: 137
    },
    ARBITRUM: {
      url: "https://arb1.arbitrum.io/rpc",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      // gasPrice: 5e9,
      // gas: 6e6,
      chainId: 42161
    },
    FANTOM: {
      url: "https://rpc.ftm.tools/",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 250
    },
    fantomTest: {
      url: "https://rpc.testnet.fantom.network/",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 4002
    },
    AVALANCHE: {
      url: "https://api.avax.network/ext/bc/C/rpc",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 43114
    },
    avalancheTest: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 43113
    },
    Linea: {
      url: "https://linea-mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 59144
    },
  },
  mocha: {
    timeout: 100000
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
}

task("upgrade", "Upgrade smart contract")
  .addPositionalParam("contract", "Name of a smart contract")
  .addPositionalParam("address", "Contract's proxy address")
  .addOptionalParam("signer", "Named signer for upgrade transaction", "deployer")
  .setAction(async (args, hre) => {
    const { upgradeProxy } = require("./scripts/deploy-utils");

    const accounts = await hre.getNamedAccounts();
    const signer = accounts[args.signer];

    if (!signer) {
      throw new Error("Unknown signer!");
    }

    if (!hre.ethers.utils.isAddress(args.address)) {
      throw Error(`Invalid contract address ${args.address}`)
    }

    const { contract, receipt } = await upgradeProxy(args.contract, args.address, signer);
  })