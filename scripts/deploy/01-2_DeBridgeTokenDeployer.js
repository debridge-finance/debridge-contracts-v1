const debridgeInitParams = require("../../assets/debridgeInitParams");
const { deployProxy, getLastDeployedProxy } = require("../deploy-utils");

module.exports = async function ({ getNamedAccounts, deployments, network }) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  const deToken = (await deployments.get("DeBridgeToken")).address;

  const wethAddress = deployInitParams.external.WETH || (await deployments.get("MockWeth")).address;
  const deBridgeGateInstance = await getLastDeployedProxy("DeBridgeGate", deployer, [
    deployInitParams.excessConfirmations,
    wethAddress,
  ]);

  await deployProxy("DeBridgeTokenDeployer", deployer,
    [
      deToken,
      deployInitParams.deBridgeTokenAdmin,
      deBridgeGateInstance.address,
    ],
    true);
};

module.exports.tags = ["01-2_DeBridgeTokenDeployer"]
module.exports.dependencies = ['01-1_DeBridgeToken'];
