const WhiteAggregator = artifacts.require("WhiteAggregator");
const ILinkToken = artifacts.require("ILinkToken");
const MockLinkToken = artifacts.require("MockLinkToken");

module.exports = async function (deployer, network) {
  let amount = web3.utils.toWei("1");
  let link;
  switch (network) {
    case "development":
    case "bsctest":
      link = MockLinkToken.address.toString();
      break;
    case "kovan":
      link = "0xa36085F69e2889c224210F603D836748e7dC0088";
      break;
    case "bsctest":
      link = "0x84b9b910527ad5c03a9ca831909e21e236ea7b06";
      break;
    case "bsc":
      link = "0x404460c6a5ede2d891e8297795264fde62adbb75";
      break;
    default:
      link = "0x514910771af9ca656af840dff83e8264ecf986ca";
      break;
  }
  const linkTokenInstance = await ILinkToken.at(link);
  await linkTokenInstance.transferAndCall(
    WhiteAggregator.address.toString(),
    amount,
    0
  );
};
