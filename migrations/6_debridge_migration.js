const Debridge = artifacts.require("FullDebridge");
const LightDebridge = artifacts.require("LightDebridge");
const FullAggregator = artifacts.require("FullAggregator");
const LightVerifier = artifacts.require("LightVerifier");
const CallProxy = artifacts.require("CallProxy");
const FeeProxy = artifacts.require("FeeProxy");
const DefiController = artifacts.require("DefiController");
const { getWeth } = require("./utils");
const { deployProxy } = require("@openzeppelin/truffle-upgrades");

module.exports = async function(deployer, network) {
  if (network == "test") return;

  const debridgeInitParams = require("../assets/debridgeInitParams")[network];
  let debridgeInstance;
  if (debridgeInitParams.type == "full") {
    let weth = await getWeth(deployer, network);
    await deployProxy(
      Debridge,
      [
        debridgeInitParams.excessConfirmations,
        FullAggregator.address.toString(),
        CallProxy.address.toString(),
        debridgeInitParams.supportedChains,
        debridgeInitParams.chainSupportInfo,
        weth,
        FeeProxy.address.toString(),
        DefiController.address.toString(),
      ],
      { deployer }
    );
    aggregatorInstance = await FullAggregator.deployed();
    debridgeInstance = await Debridge.deployed();
  } else {
    await deployProxy(
      LightDebridge,
      [
        debridgeInitParams.excessConfirmations,
        LightVerifier.address.toString(),
        CallProxy.address.toString(),
        debridgeInitParams.supportedChains,
        debridgeInitParams.chainSupportInfo,
        DefiController.address.toString(),
      ],
      { deployer }
    );
    aggregatorInstance = await LightVerifier.deployed();
    debridgeInstance = await LightDebridge.deployed();
  }
  await aggregatorInstance.setDebridgeAddress(debridgeInstance.address);
};
