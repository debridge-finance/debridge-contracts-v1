const DefiController = artifacts.require("DefiController");

module.exports = async function (deployer, network) {
  // if (network == "test") return;

  await deployer.deploy(DefiController);
  console.log("DefiController: " + DefiController.address);
};
