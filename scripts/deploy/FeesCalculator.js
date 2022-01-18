const { deployProxy, getLastDeployedProxy } = require("../deploy-utils");

module.exports = async function ({ getNamedAccounts, deployments, network }) {
  const { deployer } = await getNamedAccounts();

  // const deBridgeGate = await getLastDeployedProxy("DeBridgeGate", deployer);
  await deployProxy(
    "FeesCalculator",
    deployer,
    ["0x43dE2d77BF8027e25dBD179B491e8d64f38398aA"],
    true,
  );
};

module.exports.tags = ["FeesCalculator"]
module.exports.dependencies = [];
