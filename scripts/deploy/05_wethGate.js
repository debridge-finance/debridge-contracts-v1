const debridgeInitParams = require("../../assets/debridgeInitParams");

module.exports = async function ({ getNamedAccounts, deployments, network }) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  if (deployInitParams.deploy.wethGate) {
    const WETH = deployInitParams.external.WETH;
    if (!WETH) {
      throw Error("WETH address needed for deploying wethGate");
    }
    await deploy("WethGate", {
      from: deployer,
      args: [WETH],
      // deterministicDeployment: true,
      log: true,
    });
  }
};

module.exports.tags = ["05_wethGate"]
