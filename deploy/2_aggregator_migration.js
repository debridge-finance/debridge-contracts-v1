module.exports = async function({ getNamedAccounts, deployments }, network, accounts) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const SignatureAggregator = artifacts.require("SignatureAggregator");
  const SignatureVerifier = artifacts.require("SignatureVerifier");

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const debridgeInitParams = require("../assets/debridgeInitParams")[network];
  if (debridgeInitParams.type == "full") {

    await deploy("ConfirmationAggregator", {

      from: deployer,
      log: true,
      args: [
        debridgeInitParams.minConfirmations,
        debridgeInitParams.confirmationThreshold,
        debridgeInitParams.excessConfirmations,
        accounts[0],
        ZERO_ADDRESS
      ],
    });

    await deploy("SignatureAggregator", {
      from: deployer,
      log: true,
      args: [
        debridgeInitParams.minConfirmations
      ],
    });

    let aggregatorInstance = await ConfirmationAggregator.deployed();
    let signatureAggregatorInstance = await SignatureAggregator.deployed();
    console.log("ConfirmationAggregator: " + aggregatorInstance.address);
    console.log("SignatureAggregator: " + SignatureAggregator.address);
    for (let oracle of debridgeInitParams.oracles) {
      await aggregatorInstance.addOracle(oracle.address, oracle.admin, false);
      await signatureAggregatorInstance.addOracle(oracle.address, oracle.admin, false);
      console.log("addOracle: " + oracle.address);
    }
  } else {

    await deploy("SignatureVerifier", {
      from: deployer,
      log: true,
      args: [
        debridgeInitParams.minConfirmations,
        debridgeInitParams.confirmationThreshold,
        debridgeInitParams.excessConfirmations,
        accounts[0],
        ZERO_ADDRESS
      ],
    });

    let aggregatorInstance = await SignatureVerifier.deployed();
    console.log("SignatureVerifier: " + aggregatorInstance.address);
    for (let oracle of debridgeInitParams.oracles) {
      await aggregatorInstance.addOracle(oracle.address, oracle.address, false);
      console.log("addOracle: " + oracle.address);
    }
  }
};

module.exports.tags = ["2_aggregator_migration"]
