const debridgeInitParams = require("../../assets/debridgeInitParams");
const { ethers } = require("hardhat");
const { FLAGS, getLastDeployedProxy, waitTx } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  const multisig = process.env.MULTISIG_ACCOUNT;

  console.log('*'.repeat(80));
  console.log(`\tStart transfering DEFAULT_ADMIN_ROLE role for contracts`);
  console.log(`\tfrom DEPLOYER ${deployer}`);
  console.log(`\tto MULTISIG ${multisig}`);
  console.log('*'.repeat(80));

  if (!multisig) {
    throw Error("env.MULTISIG_ACCOUNT is empty");
  }

  if (multisig == deployer) {
    throw Error("env.MULTISIG_ACCOUNT must be different from the deployer");
  }

  const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero;

  async function transferAdminRole(contract, contract_name) {
    console.log(`Transfering admin role for ${contract_name} | ${contract.address}`);
    const multisigHasAdminRole = await contract.hasRole(DEFAULT_ADMIN_ROLE, multisig);
    if (!multisigHasAdminRole) {
      console.log(`\tcall grantRole for multisig`);
      const tx = await contract.grantRole(DEFAULT_ADMIN_ROLE, multisig);
      await waitTx(tx);
    } else {
      console.log(`\tmultisig already has an admin role, skip calling grantRole`);
    }
    const deployerHasAdminRole = await contract.hasRole(DEFAULT_ADMIN_ROLE, deployer);
    if (deployerHasAdminRole) {
      console.log(`\tcall revokeRole for deployer`);
      const tx = await contract.revokeRole(DEFAULT_ADMIN_ROLE, deployer);
      await waitTx(tx);
    } else {
      console.log(`\tdeployer already doesn't have an admin role, skip calling revokeRole`);
    }
  }


  // --------------------------------
  //    DeBridgeTokenDeployer
  // --------------------------------

  const deBridgeTokenDeployer = await getLastDeployedProxy("DeBridgeTokenDeployer", deployer);
  await transferAdminRole(deBridgeTokenDeployer, "DeBridgeTokenDeployer");


  // --------------------------------
  //    SignatureVerifier
  // --------------------------------


  const signatureVerifier = await getLastDeployedProxy("SignatureVerifier", deployer);
  await transferAdminRole(signatureVerifier, "SignatureVerifier");



  // --------------------------------
  //    ConfirmationAggregator
  // --------------------------------

  // if (deployInitParams.deploy.ConfirmationAggregator) {
  //   const confirmationAggregator = await getLastDeployedProxy("ConfirmationAggregator", deployer);
  //   await transferAdminRole(confirmationAggregator, "ConfirmationAggregator");
  // }


  // --------------------------------
  //    CallProxy
  // --------------------------------

  const callProxy = await getLastDeployedProxy("CallProxy", deployer, []);
  await transferAdminRole(callProxy, "CallProxy");


  // --------------------------------
  //    FeeProxy
  // --------------------------------

  const feeProxy = await getLastDeployedProxy("SimpleFeeProxy", deployer);
  await transferAdminRole(feeProxy, "SimpleFeeProxy");


  // --------------------------------
  //    DefiController
  // --------------------------------

  // if (deployInitParams.deploy.DefiController) {
  //   const defiController = await getLastDeployedProxy("DefiController", deployer);
  //   await transferAdminRole(defiController, "DefiController");
  // }


  // --------------------------------
  //    DeBridgeGate
  // --------------------------------

  const deBridgeGate = await getLastDeployedProxy("DeBridgeGate", deployer);
  await transferAdminRole(deBridgeGate, "DeBridgeGate");


  // --------------------------------
  //    Transfer ProxyAdmin Ownership
  // --------------------------------
  await hre.upgrades.admin.transferProxyAdminOwnership(multisig);
};

module.exports.tags = ["07_transfer_admin_role"];
module.exports.dependencies = ['06_DeBridgeGateSetup'];
