const debridgeInitParams = require("../../assets/debridgeInitParams");
const { deployProxy, sleepInterval } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  if (deployInitParams.deploy.SignatureAggregator) {
    //function initialize(uint8 _minConfirmations)


    const { contract: signatureAggregatorInstance, isDeployed } = await deployProxy(
      "SignatureAggregator",
      deployer,
      [deployInitParams.minConfirmations, deployInitParams.excessConfirmations],
      true);

    if (isDeployed) {
      let oracleAddresses = deployInitParams.oracles;
      let required = deployInitParams.oracles.map(o => false);

      console.log("add non required oracles:");
      console.log(deployInitParams.oracles);

      // function addOracles(
      //   address[] memory _oracles,
      //   bool[] memory _required
      // )
      const tx = await signatureAggregatorInstance.addOracles(oracleAddresses, required);
      await tx.wait();
      await sleepInterval();
    }
  }
};

module.exports.tags = ["02_SignatureAggregator"]
