const WhiteAggregator = artifacts.require("WhiteAggregator");
const MockLinkToken = artifacts.require("MockLinkToken");

module.exports = async function (deployer, network, accounts) {
  let link;
  switch (network) {
    case "development":
      await deployer.deploy(MockLinkToken, "Link Token", "dLINK", 18);
      const linkToken = await MockLinkToken.deployed();
      await linkToken.mint(accounts[0], web3.utils.toWei("100"));
      link = (await MockLinkToken.deployed()).address;
      break;
    case "bsctest":
      link = "0x84b9b910527ad5c03a9ca831909e21e236ea7b06";
      break;
    case "kovan":
      link = "0xa36085F69e2889c224210F603D836748e7dC0088";
      break;
    case "bsc":
      link = "0x89F3A11E8d3B7a9F29bDB3CdC1f04c7e6095B357";
      break;
    case "bsctest":
      link = "0x84b9b910527ad5c03a9ca831909e21e236ea7b06";
      break;
    default:
      link = "0x514910771af9ca656af840dff83e8264ecf986ca";
      break;
  }

  const initialOraclesCount = process.env.ORACLES_COUNT;
  const initialOracles = JSON.parse(process.env.INITIAL_ORACLES);
  await deployer.deploy(WhiteAggregator, initialOraclesCount, "10000000", link);

  const whiteAggregatorInstance = await WhiteAggregator.deployed();
  for (let oracle of initialOracles) {
    await whiteAggregatorInstance.addOracle(oracle);
  }
};
