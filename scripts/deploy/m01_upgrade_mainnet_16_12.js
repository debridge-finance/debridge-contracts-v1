const { ethers, upgrades } = require("hardhat");
const { deployProxy, getLastDeployedProxy, upgradeProxy, waitTx } = require("../deploy-utils");

const debridgeInitParams = require("../../assets/debridgeInitParams");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  console.log('*'.repeat(80));
  console.log('\tm01_upgrade_mainnet_16.12');
  console.log('*'.repeat(80));

  const DEBRIDGE_GATE_ADDRESS = '0x43dE2d77BF8027e25dBD179B491e8d64f38398aA';

  const DebrideGateFactory = await hre.ethers.getContractFactory("DeBridgeGate", deployer);
  const deBridgeGateInstance = await DebrideGateFactory.attach(DEBRIDGE_GATE_ADDRESS);

  // 1-. Grand GOVMONITORING_ROLE for multisig
  // const multisigAddress = deployInitParams.deBridgeTokenAdmin;
  // console.log(`1-. Grand GOVMONITORING_ROLE for multisig ${multisigAddress}`);
  //  const GOVMONITORING_ROLE = await deBridgeGateInstance.GOVMONITORING_ROLE();
  // let txGrantRole = await deBridgeGateInstance.grantRole(GOVMONITORING_ROLE, multisigAddress);
  // await waitTx(txGrantRole);

  // // console.log(`1-. Grand GOVMONITORING_ROLE for deployer ${deployer}`);
  // // txGrantRole = await deBridgeGateInstance.grantRole(GOVMONITORING_ROLE, deployer);
  // // await waitTx(txGrantRole);

  // // txGrantRole = await deBridgeGateInstance.pause();
  // // await waitTx(txGrantRole);

  // // 1. Upgrade DebrideGate
  // // WARNING: lockedClaim type should be updated to t_uint256 by hands in .openzeppelin/mainnet.json
  // console.log('1. Upgrade DebrideGate');
  // await upgradeProxy(
  //   "DeBridgeGate",
  //   DEBRIDGE_GATE_ADDRESS,
  //   deployer);

  // const lockedClaim = (await deBridgeGateInstance.lockedClaim()).toNumber();
  // console.log(`DeBridgeGate.lockedClaim = ${lockedClaim}`);
  // assert.notEqual(lockedClaim, 2);

  // // 2. Deploy DeBridgeToken
  // console.log('2. Deploy DeBridgeToken')
  // const deBridgeToken = await deploy("DeBridgeToken", {
  //   from: deployer,
  //   log: true,
  //   waitConfirmations: 1,
  // });

  // // 2.1 Set new implementation in DeBridgeTokenDeployer
  // console.log(`2.1 Set new implementation in DeBridgeTokenDeployer - Calling DeBridgeTokenDeployer.setTokenImplementation(${deBridgeToken.address})`)
  // const DeBridgeTokenDeployerFactory = await hre.ethers.getContractFactory("DeBridgeTokenDeployer", deployer);
  // const deBridgeTokenDeployer = await DeBridgeTokenDeployerFactory.attach(await deBridgeGateInstance.deBridgeTokenDeployer());
  // let tx = await deBridgeTokenDeployer.setTokenImplementation(deBridgeToken.address);
  // await waitTx(tx);


  // // 3. Upgrade SignatureVerifier
  console.log('3. Upgrade SignatureVerifier');
  await upgradeProxy(
    "SignatureVerifier",
    await deBridgeGateInstance.signatureVerifier(),
    deployer);
};

module.exports.tags = ["m01_upgrade_mainnet_16_12"];
