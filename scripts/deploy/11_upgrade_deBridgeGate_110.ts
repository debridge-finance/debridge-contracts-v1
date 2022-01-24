// @ts-nocheck
const { ethers, upgrades } = require("hardhat");
const { upgradeProxy } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  if (!network.live) return;
  const { deployer } = await getNamedAccounts();

  console.log('*'.repeat(80));
  console.log(`\tStart upgrade deBridgeGate to 1.1.0 version`);
  console.log(`\tfrom DEPLOYER ${deployer}`);
  console.log('*'.repeat(80));

  // upgradeProxy(contractName, contractAddress, deployer)
  const { contract, receipt} = await upgradeProxy(
      "DeBridgeGate",
      "0x68d936cb4723bdd38c488fd50514803f96789d2d",
      deployer);

  console.log(`end upgradeProxy`);
  // console.log(contract);
  // console.log(receipt);
  const newVersion = await contract.version();
  console.log(`newVersion: ${newVersion}`);
};

module.exports.tags = ["11_upgrade_deBridgeGate_110"];
module.exports.dependencies = [''];
