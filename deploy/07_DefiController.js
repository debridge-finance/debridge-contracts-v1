const debridgeInitParams = require("../assets/debridgeInitParams");

module.exports = async function({ getNamedAccounts, deployments, network}) {
  // const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];

  if (deployInitParams.deploy.DefiController) {
    const DefiController = await ethers.getContractFactory("DefiController", deployer);
    const defiControllerInstance = await upgrades.deployProxy(DefiController, []);
    await defiControllerInstance.deployed();
    console.log("DefiController: " + defiControllerInstance.address);
  }
};

module.exports.tags = ["07_DefiController"]
