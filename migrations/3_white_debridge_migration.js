const WhiteDebridge = artifacts.require("WhiteDebridge");
const WhiteAggregator = artifacts.require("WhiteAggregator");

module.exports = async function (deployer, network) {
  let minAmount = "10000";
  let transferFee = web3.utils.toWei("0.00001");
  let supportedChainIds = [];
  switch (network) {
    case "development":
      supportedChainIds = [42];
      break;
    case "kovan":
      supportedChainIds = [56];
      break;
    case "bsc":
      supportedChainIds = [42];
      break;
    case "bsctest":
      supportedChainIds = [42];
      break;
    default:
      break;
  }
  const whiteAggregatorInstance = await WhiteAggregator.deployed();
  await deployer.deploy(
    WhiteDebridge,
    minAmount,
    transferFee,
    whiteAggregatorInstance.address.toString(),
    supportedChainIds
  );
};
