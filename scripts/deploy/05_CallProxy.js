const debridgeInitParams = require("../../assets/debridgeInitParams");
const { deployProxy } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  await deployProxy("CallProxy", deployer, [0], true);

  // TODO: don't hardcode flag value
  const PROXY_WITH_SENDER_FLAG = 2;
  await deployProxy("CallProxy", deployer, [PROXY_WITH_SENDER_FLAG], true);
};

module.exports.tags = ["05_CallProxy"]
