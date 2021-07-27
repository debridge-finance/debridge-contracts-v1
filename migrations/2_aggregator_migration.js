const ConfirmationAggregator = artifacts.require("ConfirmationAggregator");
const SignatureAggregator = artifacts.require("SignatureAggregator");
const SignatureVerifier = artifacts.require("SignatureVerifier");
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
      ConfirmationAggregator,
      debridgeInitParams.minConfirmations,
      debridgeInitParams.confirmationThreshold,
      debridgeInitParams.excessConfirmations,
      accounts[0],
      ZERO_ADDRESS
    );

    //TODO: deploy Light Aggregator in arbitrum
    // constructor(uint256 _minConfirmations) 
    await deployer.deploy(
      SignatureAggregator,
      debridgeInitParams.minConfirmations
    );
    let aggregatorInstance = await ConfirmationAggregator.deployed();
    let signatureAggregatorInstance = await SignatureAggregator.deployed();
    console.log("ConfirmationAggregator: " + aggregatorInstance.address);
    console.log("SignatureAggregator: " + SignatureAggregator.address);
    for (let oracle of debridgeInitParams.oracles) {
      await aggregatorInstance.addOracle(oracle.address, oracle.admin);
      await signatureAggregatorInstance.addOracle(oracle.address, oracle.admin);
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
      SignatureVerifier,
      debridgeInitParams.minConfirmations,
      debridgeInitParams.confirmationThreshold,
      debridgeInitParams.excessConfirmations,
      accounts[0],
      ZERO_ADDRESS
    );
    let aggregatorInstance = await SignatureVerifier.deployed();
    console.log("SignatureVerifier: " + aggregatorInstance.address);
    for (let oracle of debridgeInitParams.oracles) {
      await aggregatorInstance.addOracle(oracle.address);
      console.log("addOracle: " + oracle.address);
    }
  }
};
