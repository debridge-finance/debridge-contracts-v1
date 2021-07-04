const WrappedAssetFactory = artifacts.require("WrappedAssetFactory");
const { getLinkAddress } = require("./utils");

module.exports = async function(deployer, network, accounts) {
  if (network == "test") return;
  await deployer.deploy(WrappedAssetFactory, accounts[0], []);
  console.log(
    "WrappedAssetFactory: " + (await WrappedAssetFactory.deployed()).address
  );
};
