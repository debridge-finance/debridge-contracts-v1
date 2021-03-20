const WhiteDebridge = artifacts.require("WhiteDebridge");
const WhiteAggregator = artifacts.require("WhiteAggregator");

module.exports = async function (deployer, network) {
  const whiteDebridgeInstance = await WhiteDebridge.deployed();
  const otherAssetInfos = require("../assets/debridge.json")[network];
  for (let otherAssetInfo of otherAssetInfos) {
    await whiteDebridgeInstance.addExternalAsset(
      otherAssetInfo.tokenAddress,
      otherAssetInfo.chainId,
      otherAssetInfo.minAmount,
      otherAssetInfo.transferFee,
      [otherAssetInfo.chainId],
      otherAssetInfo.name,
      otherAssetInfo.symbol
    );
  }
  console.log("Network: " + network);
  console.log("WhiteAggregator:" + WhiteAggregator.address);
  console.log("WhiteDebridge:" + WhiteDebridge.address);
};
