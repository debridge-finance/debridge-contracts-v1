const debridgeInitParams = require("../assets/debridgeInitParams");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  const CallProxy = await ethers.getContractFactory("CallProxy", deployer);
  const callProxyInstance = await upgrades.deployProxy(CallProxy, []);
  await callProxyInstance.deployed();
  console.log("CallProxy: " + callProxyInstance.address);
};

module.exports.tags = ["05_CallProxy"]
