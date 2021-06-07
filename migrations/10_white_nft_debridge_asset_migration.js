const FeeProxy = artifacts.require("FeeProxy");
const WrappedNFT = artifacts.require("WrappedAsset");
const WhiteLightAggregator = artifacts.require("WhiteLightAggregator");
const CallProxy = artifacts.require("CallProxy");

module.exports = async function(_deployer, network) {
    if (network == "test") return;
    console.log("Network:  " + network);
    console.log("DefiController: " + DefiController.address);
    console.log("CallProxy: " + CallProxy.address);
  
    const otherAssetInfos = require("../assets/supportedChains")[network];
    const debridgeInitParams = require("../assets/debridgeInitParams")[network];
    let WhiteDebridge;
    let WhiteAggregator;
    if (debridgeInitParams.type == "full") {
      WhiteDebridge = artifacts.require("WhiteFullNFTDebridge");
      WhiteAggregator = artifacts.require("WhiteFullAggregator");
      console.log("FeeProxy: " + FeeProxy.address);
      console.log("WhiteLightAggregator: " + WhiteLightAggregator.address);
    } else {
      WhiteDebridge = artifacts.require("WhiteLightNFTDebridge");
      WhiteAggregator = artifacts.require("WhiteLightVerifier");
    }
    console.log("WhiteAggregator: " + WhiteAggregator.address);
    console.log("WhiteDebridge: " + WhiteDebridge.address);
  
    const whiteDebridgeInstance = await WhiteDebridge.deployed();
    for (const otherAssetInfo of otherAssetInfos) {
      const wrappedNft = await WrappedNFT.new(
        otherAssetInfo.name,
        otherAssetInfo.symbol,
        [whiteDebridgeInstance.address]
      );
      await whiteDebridgeInstance.addExternalAsset(
        otherAssetInfo.tokenAddress,
        wrappedNft.address,
        otherAssetInfo.chainId,
        otherAssetInfo.minAmount,
        otherAssetInfo.maxAmount,
        otherAssetInfo.minReserves,
        otherAssetInfo.supportedChains,
        otherAssetInfo.chainSupportInfo
      );
    }
  };