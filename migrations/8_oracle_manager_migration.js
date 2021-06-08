const OracleManager = artifacts.require("OracleManager");
const { getLinkAddress } = require("./utils");

module.exports = async function(deployer, network, _accounts) {
  if (network == "test") return;
  const timelock = 1209600;
  const link = await getLinkAddress(deployer, network);
  await deployer.deploy(OracleManager, link, timelock);
  console.log("OracleManager: " + (await OracleManager.deployed()).address);
};
