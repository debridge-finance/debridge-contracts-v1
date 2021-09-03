const debridgeInitParams = require("../../assets/debridgeInitParams");
const { deployProxy } = require("../deploy-utils");

module.exports = async function({ getNamedAccounts, deployments, network}) {
  // const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  if (deployInitParams.deploy.DefiController) {
    await deployProxy("DefiController", deployer, [], true);
  }
};

module.exports.tags = ["07_DefiController"]
