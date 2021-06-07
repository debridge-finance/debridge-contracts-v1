const WhiteFullNFTDebridge = artifacts.require("WhiteFullNFTDebridge");
const WhiteLightNFTDebridge = artifacts.require("WhiteLightNFTDebridge");
const WhiteFullAggregator = artifacts.require("WhiteFullAggregator");
const WhiteLightVerifier = artifacts.require("WhiteLightVerifier");
const CallProxy = artifacts.require("CallProxy");
const FeeProxy = artifacts.require("FeeProxy");
const { getWeth } = require("./utils");
const { deployProxy } = require("@openzeppelin/truffle-upgrades");

module.exports = async function(deployer, network) {
    if (network == "test") return;
  
    const debridgeInitParams = require("../assets/debridgeInitParams")[network];
    if (debridgeInitParams.type == "full") {
      let weth = await getWeth(deployer, network);
      await deployProxy(
        WhiteFullNFTDebridge,
        [
          WhiteFullAggregator.address.toString(),
          CallProxy.address.toString(),
          weth,
          FeeProxy.address.toString(),
        ],
        { deployer }
      );
    } else {
      await deployProxy(
        WhiteLightNFTDebridge,
        [
          WhiteLightVerifier.address.toString(),
          CallProxy.address.toString(),
          weth,
          DefiController.address.toString(),
        ],
        { deployer }
      );
    }
  };