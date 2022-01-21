// @ts-nocheck
const { ethers, upgrades } = require("hardhat");
const { deployProxy, upgradeProxy, waitTx } = require("../deploy-utils");

const debridgeInitParams = require("../../assets/debridgeInitParams").default;

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const multisig = "0xB485C8ba37A258B57d3ef24E51178A6b307C96EB";
  // deployInitParams.deBridgeTokenAdmin;

  console.log('*'.repeat(80));
  console.log(`\tStart transfering DEFAULT_ADMIN_ROLE role for contracts`);
  console.log(`\tfrom DEPLOYER ${deployer}`);
  console.log(`\tto MULTISIG ${multisig}`);
  console.log('*'.repeat(80));

  if (!multisig) {
    throw Error("multisigAddress is empty");
  }

  if (multisig === deployer) {
    throw Error("multisigAddress must be different from the deployer");
  }

  // --------------------------------
  //    Transfer ProxyAdmin Ownership
  // --------------------------------
  await hre.upgrades.admin.transferProxyAdminOwnership(multisig);
};

module.exports.tags = ["16_1_transferProxyAdminOwnership"];
