const { ethers, upgrades } = require("hardhat");
const { upgradeProxy } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();

  console.log('*'.repeat(100));
  console.log(`\tStart bulk contracts upgrading`);
  console.log(`\tfrom DEPLOYER ${deployer}`);
  console.log('*'.repeat(100));

  const contracts = {
    // "0x0000000000000000000000000000000000000000": "ContractName",
  }

  for (const [address, contract] of Object.entries(contracts)) {
    await upgradeProxy(contract, address, deployer);
  }
};

module.exports.tags = ["bulk_upgrade"];
// module.exports.dependencies = [];
