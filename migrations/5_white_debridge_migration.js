const WhiteDebridge = artifacts.require("WhiteFullDebridge");
const WhiteAggregator = artifacts.require("WhiteAggregator");
const FeeProxy = artifacts.require("FeeProxy");
const DefiController = artifacts.require("DefiController");
const { getWeth } = require("./utils");

module.exports = async function (deployer, network) {
  if (network == "test") return;

  const debridgeInitParams = require("../assets/debridgeInitParams")[network];
  let weth = await getWeth(deployer, network);

  await deployer.deploy(
    WhiteDebridge,
    debridgeInitParams.minTransferAmount,
    debridgeInitParams.transferFee,
    debridgeInitParams.minReserves,
    WhiteAggregator.address.toString(),
    debridgeInitParams.supportedChains,
    weth,
    FeeProxy.address.toString(),
    DefiController.address.toString()
  );
};
