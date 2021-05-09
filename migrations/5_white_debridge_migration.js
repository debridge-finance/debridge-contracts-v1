const WhiteDebridge = artifacts.require("WhiteFullDebridge");
const WhiteLightDebridge = artifacts.require("WhiteLightDebridge");
const WhiteFullAggregator = artifacts.require("WhiteFullAggregator");
const WhiteLightVerifier = artifacts.require("WhiteLightVerifier");
const CallProxy = artifacts.require("CallProxy");
const FeeProxy = artifacts.require("FeeProxy");
const DefiController = artifacts.require("DefiController");
const { getWeth } = require("./utils");
const { deployProxy } = require("@openzeppelin/truffle-upgrades");

module.exports = async function(deployer, network) {
  if (network == "test") return;

  const debridgeInitParams = require("../assets/debridgeInitParams")[network];
  if (debridgeInitParams.type == "full") {
    let weth = await getWeth(deployer, network);
    await deployProxy(
      WhiteDebridge,
      [
        debridgeInitParams.minTransferAmount,
        debridgeInitParams.maxTransferAmount,
        debridgeInitParams.minReserves,
        WhiteFullAggregator.address.toString(),
        CallProxy.address.toString(),
        debridgeInitParams.supportedChains,
        debridgeInitParams.chainSupportInfo,
        weth,
        FeeProxy.address.toString(),
        DefiController.address.toString(),
      ],
      { deployer }
    );
  } else {
    await deployProxy(
      WhiteLightDebridge,
      [
        debridgeInitParams.minTransferAmount,
        debridgeInitParams.maxTransferAmount,
        debridgeInitParams.minReserves,
        WhiteLightVerifier.address.toString(),
        CallProxy.address.toString(),
        debridgeInitParams.supportedChains,
        debridgeInitParams.chainSupportInfo,
        DefiController.address.toString(),
      ],
      { deployer }
    );
  }
};
