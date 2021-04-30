const OracleManager = artifacts.require("OracleManager");
const GovToken = artifacts.require("GovToken");

module.exports = async function(deployer, network, _accounts) {
  if (network == "test") return;
  const timelock = 1209600;
  await deployer.deploy(OracleManager, GovToken.address, timelock);
};
