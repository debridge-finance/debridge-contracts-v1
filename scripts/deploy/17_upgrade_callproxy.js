const { ethers, upgrades } = require("hardhat");
const { deployProxy, upgradeProxy, waitTx } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();


  console.log('*'.repeat(80));
  console.log('\t17_upgrade_callproxy');
  console.log('*'.repeat(80));


  const CALL_PROXY_ADDRESS = '0xEF3B092e84a2Dbdbaf507DeCF388f7f02eb43669';

  // 1. Upgrade CallProxy
  // Changes:
  // * added lock to callERC20
  // * updated externalCall
  console.log('1. Upgrade CallProxy')
  const { contract: callProxy } = await upgradeProxy(
    "CallProxy",
    CALL_PROXY_ADDRESS,
    deployer);
};

module.exports.tags = ["17_upgrade_callproxy"];
