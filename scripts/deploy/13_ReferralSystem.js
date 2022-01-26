const debridgeInitParams = require("../../assets/debridgeInitParams");
const { deployProxy } = require("../deploy-utils");

module.exports = async function ({ getNamedAccounts, deployments, network }) {
  const { deployer } = await getNamedAccounts();
  const networkName = network.name;
  const deployInitParams = debridgeInitParams[networkName];
  if (!deployInitParams) return;
  
  const wethAddress = deployInitParams.external.WETH || (await deployments.get("MockWeth")).address;
  const deBridgeGateInstance = await getLastDeployedProxy("DeBridgeGate", deployer, [
    deployInitParams.excessConfirmations,
    wethAddress,
  ]);
  await deployProxy("ReferralSystem", deployer, [deBridgeGateInstance.address], true);
};

module.exports.tags = ["13-ReferralSystem"]
