const FeeProxy = artifacts.require("FeeProxy");
const DefiController = artifacts.require("DefiController");

module.exports = async function (_deployer, network) {
  if (network == "test") return;
  console.log("Network:  " + network);
  console.log("DefiController: " + DefiController.address);

  const otherAssetInfos = require("../assets/supportedChains")[network];
  let WhiteDebridge;
  let WhiteAggregator;
  if (otherAssetInfos.type == "full") {
    WhiteDebridge = artifacts.require("WhiteFullDebridge");
    WhiteAggregator = artifacts.require("WhiteFullAggregator");
    console.log("FeeProxy: " + FeeProxy.address);
  } else {
    WhiteDebridge = artifacts.require("WhiteLightDebridge");
    WhiteAggregator = artifacts.require("WhiteLightAggregator");
  }
  console.log("WhiteAggregator: " + WhiteAggregator.address);
  console.log("WhiteDebridge: " + WhiteDebridge.address);

  const whiteDebridgeInstance = await WhiteDebridge.deployed();
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
};
