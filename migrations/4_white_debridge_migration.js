const WhiteDebridge = artifacts.require("WhiteDebridge");

module.exports = async function (deployer, network) {
  const whiteDebridgeInstance = await WhiteDebridge.deployed();
  const otherAssetInfos = require("../assets/debridge.json")[network];
  for (let otherAssetInfo of otherAssetInfos) {
    const debridgeId = await whiteDebridgeInstance.getDebridgeId(
      otherAssetInfo.chainId,
      otherAssetInfo.tokenAddress
    );
    await whiteDebridgeInstance.addExternalAsset(
      debridgeId,
      otherAssetInfo.chainId,
      otherAssetInfo.minAmount,
      otherAssetInfo.transferFee,
      [otherAssetInfo.chainId],
      otherAssetInfo.name,
      otherAssetInfo.symbol
    );
  }
};
