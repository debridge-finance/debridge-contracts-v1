const FullAggregator = artifacts.require("FullAggregator");
const LightAggregator = artifacts.require("LightAggregator");
const LightVerifier = artifacts.require("LightVerifier");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

module.exports = async function(deployer, network, accounts) {
  // if (network == "test") return;
  const debridgeInitParams = require("../assets/debridgeInitParams")[network];
  if (debridgeInitParams.type == "full") {

    //   constructor(
    //     uint256 _minConfirmations,
    //     uint256 _confirmationThreshold,
    //     uint256 _excessConfirmations,
    //     address _wrappedAssetAdmin,
    //     address _debridgeAddress
    // )
    await deployer.deploy(
      FullAggregator,
      debridgeInitParams.minConfirmations,
      debridgeInitParams.confirmationThreshold,
      debridgeInitParams.excessConfirmations,
      accounts[0],
      ZERO_ADDRESS
    );

    //TODO: deploy Light Aggregator in arbitrum
    // constructor(uint256 _minConfirmations) 
    await deployer.deploy(
      LightAggregator,
      debridgeInitParams.minConfirmations
    );
    let aggregatorInstance = await FullAggregator.deployed();
    let lightAggregatorInstance = await LightAggregator.deployed();
    console.log("FullAggregator: " + aggregatorInstance.address);
    console.log("LightAggregator: " + LightAggregator.address);
    for (let oracle of debridgeInitParams.oracles) {
      await aggregatorInstance.addOracle(oracle.address, oracle.admin);
      await lightAggregatorInstance.addOracle(oracle.address, oracle.admin);
      console.log("addOracle: " + oracle.address);
    }
  } else {

  //   constructor(
  //     uint256 _minConfirmations,
  //     uint256 _confirmationThreshold,
  //     uint256 _excessConfirmations,
  //     address _wrappedAssetAdmin,
  //     address _debridgeAddress
  // )
    await deployer.deploy(
      LightVerifier,
      debridgeInitParams.minConfirmations,
      debridgeInitParams.confirmationThreshold,
      debridgeInitParams.excessConfirmations,
      accounts[0],
      ZERO_ADDRESS
    );
    let aggregatorInstance = await LightVerifier.deployed();
    console.log("LightVerifier: " + aggregatorInstance.address);
    for (let oracle of debridgeInitParams.oracles) {
      await aggregatorInstance.addOracle(oracle.address);
      console.log("addOracle: " + oracle.address);
    }
  }
};
