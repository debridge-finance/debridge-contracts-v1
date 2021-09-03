const debridgeInitParams = require("../../assets/debridgeInitParams");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  // deploy external dependencies only if they aren't specified in debridgeInitParams.json

  if (!deployInitParams.external.WETH) {
    await deploy("WETH9", {
      from: deployer,
      args: [],
      // deterministicDeployment: true,
      log: true,
    });
  }

  if (!deployInitParams.external.UniswapFactory) {
    await deploy("UniswapV2Factory", {
      from: deployer,
      args: [ethers.constants.AddressZero],
      // deterministicDeployment: true,
      log: true,
    });
  }
};

module.exports.tags = ["00_external"]
