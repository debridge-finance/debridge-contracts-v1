const FeeProxy = artifacts.require("FeeProxy");
const DefiController = artifacts.require("DefiController");
const WrappedAsset = artifacts.require("WrappedAsset");
const WhiteLightAggregator = artifacts.require("WhiteLightAggregator");
const CallProxy = artifacts.require("CallProxy");
const ApproveProxy = artifacts.require("ApproveProxy");

module.exports = async function(_deployer, network) {
  if (network == "test") return;
  console.log("Network:  " + network);
  console.log("DefiController: " + DefiController.address);
  console.log("CallProxy: " + CallProxy.address);
  console.log("ApproveProxy: " + ApproveProxy.address);

  const otherAssetInfos = require("../assets/supportedChains")[network];
  const debridgeInitParams = require("../assets/debridgeInitParams")[network];
  let WhiteDebridge;
  let WhiteAggregator;
  if (debridgeInitParams.type == "full") {
    WhiteDebridge = artifacts.require("WhiteFullDebridge");
    WhiteAggregator = artifacts.require("WhiteFullAggregator");
    console.log("FeeProxy: " + FeeProxy.address);
    console.log("WhiteLightAggregator: " + WhiteLightAggregator.address);
  } else {
    WhiteDebridge = artifacts.require("WhiteLightDebridge");
    WhiteAggregator = artifacts.require("WhiteLightVerifier");
  }
  console.log("WhiteAggregator: " + WhiteAggregator.address);
  console.log("WhiteDebridge: " + WhiteDebridge.address);

  const whiteDebridgeInstance = await WhiteDebridge.deployed();
  for (const otherAssetInfo of otherAssetInfos) {
    const wrappedAsset = await WrappedAsset.new(
      otherAssetInfo.name,
      otherAssetInfo.symbol,
      [whiteDebridgeInstance.address]
    );
    await whiteDebridgeInstance.addExternalAsset(
      otherAssetInfo.tokenAddress,
      wrappedAsset.address,
      otherAssetInfo.chainId,
      otherAssetInfo.minAmount,
      otherAssetInfo.maxAmount,
      otherAssetInfo.minReserves,
      otherAssetInfo.supportedChains,
      otherAssetInfo.chainSupportInfo
    );
  }
};
