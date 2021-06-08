const FeeProxy = artifacts.require("FeeProxy");
const DefiController = artifacts.require("DefiController");
const WrappedAsset = artifacts.require("WrappedAsset");
const LightAggregator = artifacts.require("LightAggregator");
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
  let Debridge;
  let Aggregator;
  if (debridgeInitParams.type == "full") {
    Debridge = artifacts.require("FullDebridge");
    Aggregator = artifacts.require("FullAggregator");
    console.log("FeeProxy: " + FeeProxy.address);
    console.log("LightAggregator: " + LightAggregator.address);
  } else {
    Debridge = artifacts.require("LightDebridge");
    Aggregator = artifacts.require("LightVerifier");
  }
  console.log("Aggregator: " + Aggregator.address);
  console.log("Debridge: " + Debridge.address);

  const debridgeInstance = await Debridge.deployed();
  for (const otherAssetInfo of otherAssetInfos) {
    const wrappedAsset = await WrappedAsset.new(
      otherAssetInfo.name,
      otherAssetInfo.symbol,
      [debridgeInstance.address]
    );
    await debridgeInstance.addExternalAsset(
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
