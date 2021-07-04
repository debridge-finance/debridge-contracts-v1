const FullDebridge = artifacts.require("FullAnyDebridge");
const LightDebridge = artifacts.require("LightAnyDebridge");
const FullAggregator = artifacts.require("FullAggregator");
const LightVerifier = artifacts.require("LightVerifier");
const CallProxy = artifacts.require("CallProxy");
const WrappedAssetFactory = artifacts.require("WrappedAssetFactory");
const DefiController = artifacts.require("DefiController");
const { deployProxy } = require("@openzeppelin/truffle-upgrades");

module.exports = async function(deployer, network, accounts) {
  if (network == "test") return;

  const debridgeInitParams = require("../assets/anyDebridgeInitParams")[
    network
  ];
  let verifierAddress;
  let Debridge;
  if (debridgeInitParams.type == "full") {
    Debridge = FullDebridge;
    verifierAddress = FullAggregator.address.toString();
  } else {
    Debridge = LightDebridge;
    verifierAddress = LightVerifier.address.toString();
  }
  await deployProxy(
    Debridge,
    [
      debridgeInitParams.maxTransferAmount,
      debridgeInitParams.minReserves,
      accounts[0],
      verifierAddress,
      CallProxy.address.toString(),
      debridgeInitParams.supportedChains,
      debridgeInitParams.chainSupportInfo,
      DefiController.address.toString(),
      WrappedAssetFactory.address.toString(),
    ],
    { deployer }
  );
};
