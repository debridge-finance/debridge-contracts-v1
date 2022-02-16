const { ethers, upgrades } = require("hardhat");
const { waitTx } = require("../deploy-utils");
const debridgeInitParams = require("../../assets/debridgeInitParams");

module.exports = async function ({ getNamedAccounts, deployments, network }) {
  const { deployer } = await getNamedAccounts();

  console.log('*'.repeat(80));
  console.log(`\tStart update_exceed_confirmations`);
  console.log(`\tfrom DEPLOYER ${deployer}`);
  console.log('*'.repeat(80));

  const excessConfirmations = 1;
  console.log(`new updateExcessConfirmations  ${excessConfirmations}`);
  const deBridgeGateFactory = await ethers.getContractFactory("DeBridgeGate", deployer);
  const deBridgeGateFactoryInstance = await deBridgeGateFactory.attach("0x43dE2d77BF8027e25dBD179B491e8d64f38398aA", deployer);

  const updateExcessConfirmationsTx = await deBridgeGateFactoryInstance.updateExcessConfirmations(excessConfirmations);
  await waitTx(updateExcessConfirmationsTx);

};

module.exports.tags = ["15_update_exceed_confirmations"];
module.exports.dependencies = [''];