const WhiteAggregator = artifacts.require("WhiteAggregator");
const ILinkToken = artifacts.require("ILinkToken");
const MockLinkToken = artifacts.require("MockLinkToken");

module.exports = async function (deployer, network) {
  let amount = web3.utils.toWei("1");
  let link;
  switch (network) {
    case "development":
      link = MockLinkToken.address.toString();
      break;
    case "bsctest":
      link = "0x84b9b910527ad5c03a9ca831909e21e236ea7b06";
      break;
    case "kovan":
      link = "0xa36085F69e2889c224210F603D836748e7dC0088";
      break;
    case "bsctest":
      link = "0x84b9b910527ad5c03a9ca831909e21e236ea7b06";
      break;
    case "bsc":
      link = "0x89F3A11E8d3B7a9F29bDB3CdC1f04c7e6095B357";
      break;
    default:
      link = "0x514910771af9ca656af840dff83e8264ecf986ca";
      break;
  }
  const linkTokenInstance = await ILinkToken.at(link);
  await linkTokenInstance.transferAndCall(
    WhiteAggregator.address.toString(),
    amount,
    "0x"
  );
};
