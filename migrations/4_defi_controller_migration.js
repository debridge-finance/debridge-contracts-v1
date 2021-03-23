const DefiController = artifacts.require("DefiController");

module.exports = async function (deployer, network) {
  await deployer.deploy(DefiController);
};
