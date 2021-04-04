const WhiteAggregator = artifacts.require("WhiteAggregator");
const { getLinkAddress } = require("./utils");

module.exports = async function (deployer, network, accounts) {
  if (network == "test") return;
  const link = getLinkAddress(deployer, network, accounts);
  const debridgeInitParams = require("../assets/debridgeInitParams")[network];
  await deployer.deploy(
    WhiteAggregator,
    debridgeInitParams.oracleCount,
    debridgeInitParams.oraclePayment,
    link
  );

  const whiteAggregatorInstance = await WhiteAggregator.deployed();
  for (let oracle of debridgeInitParams.oracles) {
    await whiteAggregatorInstance.addOracle(oracle.address, oracle.admin);
  }
};
