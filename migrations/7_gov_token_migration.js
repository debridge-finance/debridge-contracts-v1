const GovToken = artifacts.require("GovToken");
const { toWei } = web3.utils;

module.exports = async function(deployer, network, accounts) {
  if (network == "test") return;
  const supply = toWei("3200000");
  await deployer.deploy(GovToken, supply);
};
