const WhiteAggregator = artifacts.require("WhiteAggregator");
const MockToken = artifacts.require("MockToken");

module.exports = async function (deployer, network) {
  let link;
  switch (network) {
    case "development":
      await deployer.deploy(MockToken, "Link Token", "dLINK", 18);
      link = (await MockToken.deployed()).address;
      break;
    case "kovan":
      link = "0xa36085F69e2889c224210F603D836748e7dC0088";
      break;
    case "bsc":
      link = "0x404460c6a5ede2d891e8297795264fde62adbb75";
      break;
    case "testbsc":
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
  for (let oracle of initialOracles)
    await whiteAggregatorInstance.addOracle(oracle);
};
