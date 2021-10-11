const debridgeInitParams = require("../../assets/debridgeInitParams");
const { FLAGS, deployProxy } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  await deployProxy("CallProxy", deployer, [0], true);
  await deployProxy("CallProxy", deployer, [FLAGS.PROXY_WITH_SENDER], true);
};

module.exports.tags = ["05_CallProxy"]
