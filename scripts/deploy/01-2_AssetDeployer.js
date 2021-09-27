const debridgeInitParams = require("../../assets/debridgeInitParams");
const { ethers } = require("hardhat");
const { deployProxy } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  const wrappedAssetImplementation = (await deployments.get("WrappedAssetImplementation")).address
  await deployProxy("AssetDeployer", deployer,
    [
      wrappedAssetImplementation,
      deployInitParams.wrappedAssetAdmin,
      ethers.constants.AddressZero,
    ],
    true);
};

module.exports.tags = ["01-2_AssetDeployer"]
