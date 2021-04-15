const WhiteFullAggregator = artifacts.require("WhiteFullAggregator");
const WhiteLightAggregator = artifacts.require("WhiteLightAggregator");
const { getLinkAddress } = require("./utils");

module.exports = async function (deployer, network, accounts) {
  if (network == "test") return;
  const link = getLinkAddress(deployer, network, accounts);
  const debridgeInitParams = require("../assets/debridgeInitParams")[network];
  let whiteAggregatorInstance;
  if (debridgeInitParams.type == "full") {
    await deployer.deploy(
      WhiteFullAggregator,
      debridgeInitParams.oracleCount,
      debridgeInitParams.oraclePayment,
      link
    );
    whiteAggregatorInstance = await WhiteFullAggregator.deployed();
    for (let oracle of debridgeInitParams.oracles) {
      await whiteAggregatorInstance.addOracle(oracle.address, oracle.admin);
    }
  } else {
    await deployer.deploy(
      WhiteLightAggregator,
      debridgeInitParams.oracleCount,
      debridgeInitParams.utilityBytes
    );
    whiteAggregatorInstance = await WhiteLightAggregator.deployed();
    for (let oracle of debridgeInitParams.oracles) {
      await whiteAggregatorInstance.addOracle(oracle.address);
    }
  }
};
