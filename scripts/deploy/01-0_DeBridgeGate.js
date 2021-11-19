const debridgeInitParams = require("../../assets/debridgeInitParams");
const { deployProxy } = require("../deploy-utils");

module.exports = async function ({ getNamedAccounts, deployments, network }) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  const wethAddress = deployInitParams.external.WETH || (await deployments.get("MockWeth")).address;

  await deployProxy("DeBridgeGate", deployer,
    [
      deployInitParams.excessConfirmations,
      wethAddress,
    ],
    true);
};

module.exports.tags = ['01-0_DeBridgeGate'];
module.exports.dependencies = ['00_external'];
