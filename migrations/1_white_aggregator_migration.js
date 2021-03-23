const WhiteAggregator = artifacts.require("WhiteAggregator");
const MockLinkToken = artifacts.require("MockLinkToken");
const { getLinkAddress } = require("./utils");

module.exports = async function (deployer, network, accounts) {
  const link = getLinkAddress(deployer, network, accounts);

  const initialOraclesCount = process.env.ORACLES_COUNT;
  const initialOracles = JSON.parse(process.env.INITIAL_ORACLES);
  const oraclePayment = process.env.ORACLE_PAYMENT;
  await deployer.deploy(
    WhiteAggregator,
    initialOraclesCount,
    oraclePayment,
    link
  );

  const whiteAggregatorInstance = await WhiteAggregator.deployed();
  for (let oracle of initialOracles) {
    await whiteAggregatorInstance.addOracle(oracle.address, oracle.admin);
  }
};
