const debridgeInitParams = require("../../assets/debridgeInitParams");
const { ethers } = require("hardhat");
const { deployProxy } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  const deToken = (await deployments.get("DeToken")).address
  await deployProxy("DeTokenDeployer", deployer,
    [
      deToken,
      deployInitParams.deTokenAdmin,
      ethers.constants.AddressZero,
    ],
    true);
};

module.exports.tags = ["01-2_DeTokenDeployer"]
