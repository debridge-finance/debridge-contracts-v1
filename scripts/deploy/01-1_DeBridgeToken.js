const debridgeInitParams = require("../../assets/debridgeInitParams");

module.exports = async function ({ getNamedAccounts, deployments, network }) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const networkName = network.name;
  const deployInitParams = debridgeInitParams[networkName];
  if (!deployInitParams) return;

  await deploy("DeBridgeToken", {
    from: deployer,
    // deterministicDeployment: true,
    log: true,
    waitConfirmations: 1,
  });
};

module.exports.tags = ["01-1_DeBridgeToken"]
