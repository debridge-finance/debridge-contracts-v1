const debridgeInitParams = require("../assets/debridgeInitParams");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  // deploy CallProxy
  const callProxyInstance = await deploy('CallProxy', {
    from: deployer,
    args: [],
    // deterministicDeployment: true,
    log: true,
  });
  console.log("CallProxy: " + callProxyInstance.address);
};

module.exports.tags = ["05_CallProxy"]
