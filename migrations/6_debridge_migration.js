const Debridge = artifacts.require("FullDebridge");
const LightDebridge = artifacts.require("FullDebridge");
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
    //function initialize(
    //    uint256 _excessConfirmations,
    //    address _ligthAggregator,
    //    address _fullAggregator,
    //    address _callProxy,
    //    uint256[] memory _supportedChainIds,
    //    ChainSupportInfo[] memory _chainSupportInfo,
    //    IWETH _weth,
    //    IFeeProxy _feeProxy,
    //    IDefiController _defiController
    //)
    await deployProxy(
      Debridge,
      [
        debridgeInitParams.excessConfirmations,
        LightVerifier.address.toString(),
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
        FullAggregator.address.toString(),
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
  await aggregatorInstance.setDebridgeAddress(
    debridgeInstance.address.toString()
  );
};
