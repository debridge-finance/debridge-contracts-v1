const debridgeInitParams = require("../../assets/debridgeInitParams");
const { deployProxy, getLastDeployedProxy } = require("../deploy-utils");

module.exports = async function ({ getNamedAccounts, deployments, network }) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  const deBridgeGateInstance = await getLastDeployedProxy("DeBridgeGate", deployer);
  await deployProxy("SimpleFeeProxy", deployer, [deBridgeGateInstance.address, deployInitParams.treasuryAddress], true);
};

module.exports.tags = ["04_FeeProxy"]
