const FeeProxy = artifacts.require("FeeProxy");
const WrappedNFT = artifacts.require("WrappedAsset");
const WhiteLightAggregator = artifacts.require("WhiteLightAggregator");
const CallProxy = artifacts.require("CallProxy");

module.exports = async function(_deployer, network) {
    if (network == "test") return;
  
    const otherAssetInfos = require("../assets/supportedChainsNFT")[network];
    const debridgeInitParams = require("../assets/debridgeInitParams")[network];
    let WhiteDebridge;
    let WhiteAggregator;
    if (debridgeInitParams.type == "full") {
      WhiteDebridge = artifacts.require("WhiteFullNFTDebridge");
      WhiteAggregator = artifacts.require("WhiteFullAggregator");
    } else {
      WhiteDebridge = artifacts.require("WhiteLightNFTDebridge");
      WhiteAggregator = artifacts.require("WhiteLightVerifier");
    }
  
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