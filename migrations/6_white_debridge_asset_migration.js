const WhiteDebridge = artifacts.require("WhiteDebridge");
const WhiteAggregator = artifacts.require("WhiteAggregator");
const FeeProxy = artifacts.require("FeeProxy");
const DefiController = artifacts.require("DefiController");

module.exports = async function (_deployer, network) {
  if (network == "test") return;

  const whiteDebridgeInstance = await WhiteDebridge.deployed();
  const otherAssetInfos = require("../assets/supportedChains")[network];
  for (let otherAssetInfo of otherAssetInfos) {
    await whiteDebridgeInstance.addExternalAsset(
      otherAssetInfo.tokenAddress,
      otherAssetInfo.chainId,
      otherAssetInfo.minAmount,
      otherAssetInfo.transferFee,
      otherAssetInfo.minReserves,
      [otherAssetInfo.chainId],
      otherAssetInfo.name,
      otherAssetInfo.symbol
    );
  }
  console.log("Network:  " + network);
  console.log("WhiteAggregator: " + WhiteAggregator.address);
  console.log("WhiteDebridge: " + WhiteDebridge.address);
  console.log("FeeProxy: " + FeeProxy.address);
  console.log("DefiController: " + DefiController.address);
};
