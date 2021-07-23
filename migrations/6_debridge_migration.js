const DeBridgeGate = artifacts.require("DeBridgeGate");
const FullAggregator = artifacts.require("FullAggregator");
const LightVerifier = artifacts.require("LightVerifier");
const CallProxy = artifacts.require("CallProxy");
const FeeProxy = artifacts.require("FeeProxy");
const DefiController = artifacts.require("DefiController");
const { getWeth } = require("./utils");
const { deployProxy } = require("@openzeppelin/truffle-upgrades");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

module.exports = async function(deployer, network) {
  // if (network == "test") return;

  const debridgeInitParams = require("../assets/debridgeInitParams")[network];
  let debridgeInstance;
  let weth = await getWeth(deployer, network);
  console.log("weth: " + weth);
  if (debridgeInitParams.type == "full") {
    //   function initialize(
    //     uint256 _excessConfirmations,
    //     address _lightAggregator,
    //     address _fullAggregator,
    //     address _callProxy,
    //     uint256[] memory _supportedChainIds,
    //     ChainSupportInfo[] memory _chainSupportInfo,
    //     IWETH _weth,
    //     IFeeProxy _feeProxy,
    //     IDefiController _defiController,
    //     address _treasury
    // )
    await deployProxy(
      DeBridgeGate,
      [
        debridgeInitParams.excessConfirmations,    
        ZERO_ADDRESS, //LightVerifier.address.toString(),
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
    debridgeInstance = await DeBridgeGate.deployed();

    console.log("FullAggregator: " + aggregatorInstance.address);
    console.log("DeBridgeGate: " + debridgeInstance.address);
  } else {
    await deployProxy(
      DeBridgeGate,
      [
        debridgeInitParams.excessConfirmations,
        LightVerifier.address.toString(),        
        ZERO_ADDRESS, //FullAggregator.address.toString(),
        CallProxy.address.toString(),
        debridgeInitParams.supportedChains,
        debridgeInitParams.chainSupportInfo,
        DefiController.address.toString(),
        weth,
        FeeProxy.address.toString(),
        DefiController.address.toString(),
      ],
      { deployer }
    );
    aggregatorInstance = await LightVerifier.deployed();
    debridgeInstance = await DeBridgeGate.deployed();

    console.log("FullAggregator: " + aggregatorInstance.address);
    console.log("DeBridgeGate: " + debridgeInstance.address);
  }
  await aggregatorInstance.setDebridgeAddress(
    debridgeInstance.address.toString()
  );

  console.log("aggregator setDebridgeAddress: " + debridgeInstance.address.toString());
};
