const { ethers, upgrades } = require("hardhat");
const { deployProxy, getLastDeployedProxy, upgradeProxy, waitTx } = require("../deploy-utils");

const debridgeInitParams = require("../../assets/debridgeInitParams");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  console.log('*'.repeat(80));
  console.log('\tm02_upgrade_mainnet_18.01');
  console.log('*'.repeat(80));

  const DEBRIDGE_GATE_ADDRESS = '0x43dE2d77BF8027e25dBD179B491e8d64f38398aA';

  const DebrideGateFactory = await hre.ethers.getContractFactory("DeBridgeGate", deployer);
  const deBridgeGateInstance = await DebrideGateFactory.attach(DEBRIDGE_GATE_ADDRESS);

  // 1. Upgrade DebrideGate
  // console.log('1. Upgrade DebrideGate');
  // await upgradeProxy(
  //   "DeBridgeGate",
  //   DEBRIDGE_GATE_ADDRESS,
  //   deployer);


  // 2. Upgrade callProxy
  console.log('2. Upgrade callProxy');
  await upgradeProxy(
    "CallProxy",
    await deBridgeGateInstance.callProxy(),
    deployer);
};

module.exports.tags = ["m02_upgrade_mainnet_18_01"];
