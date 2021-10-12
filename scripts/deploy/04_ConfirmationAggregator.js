const debridgeInitParams = require("../../assets/debridgeInitParams");
const { ethers } = require("hardhat");
const { deployProxy, sleepInterval } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();
  const networkName = network.name;
  const deployInitParams = debridgeInitParams[networkName];
  if (!deployInitParams) return;

  if (deployInitParams.deploy.ConfirmationAggregator) {
    // function initialize(
    //     uint8 _minConfirmations,
    //     uint8 _confirmationThreshold,
    //     uint8 _excessConfirmations
    // )

    const { contract: confirmationAggregatorInstance, isDeployed } = await deployProxy("ConfirmationAggregator", deployer, [
      deployInitParams.minConfirmations,
      deployInitParams.confirmationThreshold,
      deployInitParams.excessConfirmations,
    ], true);

    if (isDeployed) {
      let oracleAddresses = deployInitParams.oracles;
      let required = deployInitParams.oracles.map(o => false);

      console.log("add non required oracles:");
      console.log(deployInitParams.oracles);

      // function addOracles(
      //   address[] memory _oracles,
      //   bool[] memory _required
      // )
      const tx = await confirmationAggregatorInstance.addOracles(oracleAddresses, required);
      await tx.wait();
      await sleepInterval();
    }
  }
};

module.exports.tags = ["04_ConfirmationAggregator"]
