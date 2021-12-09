const { deployProxy, getLastDeployedProxy } = require("../deploy-utils");

module.exports = async function ({ getNamedAccounts, deployments, network }) {
  const { deployer } = await getNamedAccounts();

  const deBridgeGate = await getLastDeployedProxy("DeBridgeGate", deployer);
  await deployProxy(
    "FeesCalculator",
    deployer,
    [deBridgeGate.address],
    true,
  );
};

module.exports.tags = ["FeesCalculator"]
module.exports.dependencies = ['01-0_DeBridgeGate'];
