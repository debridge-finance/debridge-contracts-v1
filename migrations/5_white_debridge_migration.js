const WhiteDebridge = artifacts.require("WhiteFullDebridge");
const WhiteLightDebridge = artifacts.require("WhiteLightDebridge");
const WhiteFullAggregator = artifacts.require("WhiteFullAggregator");
const WhiteLightAggregator = artifacts.require("WhiteLightAggregator");
const FeeProxy = artifacts.require("FeeProxy");
const DefiController = artifacts.require("DefiController");
const { getWeth } = require("./utils");

module.exports = async function (deployer, network) {
  if (network == "test") return;

  const debridgeInitParams = require("../assets/debridgeInitParams")[network];
  if (debridgeInitParams.type == "full") {
    let weth = await getWeth(deployer, network);
    await deployer.deploy(
      WhiteDebridge,
      debridgeInitParams.minTransferAmount,
      debridgeInitParams.transferFee,
      debridgeInitParams.minReserves,
      WhiteFullAggregator.address.toString(),
      debridgeInitParams.supportedChains,
      weth,
      FeeProxy.address.toString(),
      DefiController.address.toString()
    );
  } else {
    await deployer.deploy(
      WhiteLightDebridge,
      debridgeInitParams.minTransferAmount,
      debridgeInitParams.transferFee,
      debridgeInitParams.minReserves,
      WhiteLightAggregator.address.toString(),
      debridgeInitParams.supportedChains,
      DefiController.address.toString()
    );
  }
};
