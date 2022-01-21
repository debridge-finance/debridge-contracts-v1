// @ts-nocheck
const { ethers, upgrades } = require("hardhat");
const { deployProxy, upgradeProxy, waitTx } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const CLAIMER_ADDRESS = network.config.chainId == 80001
    ? "0x4674225DE00C82005eAF77a29f3B5584b4CB8D5A"
    : "0xb1EB9869c8f3b50A98d960A5512D2BF0fAA56C32";

  // 3. Upgrade Claimer
  // Changes:
  // * added withdraw fee
  // * added batchAssetsDeploy
  console.log('3. Upgrade CallProxy')
  const { contract: callProxy } = await upgradeProxy(
    "Claimer",
    CLAIMER_ADDRESS,
    deployer);
};

module.exports.tags = ["17_upgrade_batchclaimer"];
