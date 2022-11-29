
import { ethers, upgrades } from 'hardhat';
import { getImplementationAddress } from '@openzeppelin/upgrades-core';
import { ContractFactory } from '@ethersproject/contracts';
import { expect } from 'chai';

const newDeBridgeGateImplementationAddress = "0x797161BCC625155D2302251404ccB93c2632658e";

const Web3RpcUrl = {
  1: 'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', //ETH Mainnet
  56: 'https://bsc-dataseed.binance.org/', //BSC
  128: 'https://http-mainnet.hecochain.com', //Heco
  137: 'https://polygon-mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', //polygon
  250: 'https://rpc.ftm.tools/', //FTM
  42161: 'https://arb1.arbitrum.io/rpc', //arbitrum
  43114: 'https://api.avax.network/ext/bc/C/rpc' //AVALANCHE
};

before(async () => {
});

beforeEach(async () => {
});

context("Contract's bytecode are equal to the source code", () => {
  it('DeBridgeGate implementation 0x797161BCC625155D2302251404ccB93c2632658e', async () => {
    await checkByteCodeForAllChains("DeBridgeGate", newDeBridgeGateImplementationAddress);
  });
});


async function checkByteCodeForAllChains(contractName: string, contractAddress: string) {
  const rpcs = Object.entries(Web3RpcUrl);
  for (let i = 0; i < rpcs.length; i++) {
    const rpc = rpcs[i];
    await checkByteCode(contractName, contractAddress, rpc[0], rpc[1]);
  }
}

async function checkByteCode(contractName: string, contractAddress: string,  chainId: string, rpcURL: string) {
  const rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
  const factory = await ethers.getContractFactory(contractName);
  let rpcContractCode = await rpcProvider.getCode(contractAddress);
  const contractInstance =  await factory.deploy();
  const justDeployedCode = await ethers.provider.getCode(contractInstance.address);

  const contractAttached = new ethers.Contract(contractAddress, factory.interface, rpcProvider);
  if (factory.interface.functions['version()']) {
    const version = await contractAttached.version();
    console.log(`\tChain: ${chainId}. RPC implementation version: ${version}`);
  }
  expect(justDeployedCode).to.equal(rpcContractCode);
}