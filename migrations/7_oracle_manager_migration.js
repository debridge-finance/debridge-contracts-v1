const OracleManager = artifacts.require("OracleManager");
const { getLinkAddress } = require("./utils");
const { deployProxy } = require("@openzeppelin/truffle-upgrades");

module.exports = async function(deployer, network) {
  if (network == "test") return;
  const link = await getLinkAddress(deployer, network);
  const OracleManagerInitParams = require("../assets/oracleManagerInitParams")[network];
  await deployProxy(
    OracleManager, 
    [
      OracleManagerInitParams.timelock, 
      link
    ], 
    { deployer }
  );
  console.log("OracleManager: " + (await OracleManager.deployed()).address);
};
