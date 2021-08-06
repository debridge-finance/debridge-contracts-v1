const DefiController = artifacts.require("DefiController");

module.exports = async function (deployer, network) {
  // if (network == "test") return;
  await deployProxy(
    DefiController,
    [],
    { deployer }
  );
  defiInstance = await DefiController.deployed();
  console.log("DefiController: " + defiInstance.address);
};
