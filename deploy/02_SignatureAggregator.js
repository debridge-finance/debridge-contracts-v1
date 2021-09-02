const debridgeInitParams = require("../assets/debridgeInitParams");
const { deployProxy } = require("./utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  if (deployInitParams.deploy.SignatureAggregator) {
    //function initialize(uint8 _minConfirmations)


    const { contract: signatureAggregatorInstance, isDeployed } = await deployProxy(
      "SignatureAggregator",
      deployer,
      [deployInitParams.minConfirmations],
      true);

    if (isDeployed) {
      // Transform oracles to array
      let oracleAddresses = deployInitParams.oracles.map(o => o.address);
      let oracleAdmins = deployInitParams.oracles.map(o => o.admin);
      let required = deployInitParams.oracles.map(o => false);

      console.log("add non required oracles:");
      console.log(deployInitParams.oracles);

      // function addOracles(
      //   address[] memory _oracles,
      //   address[] memory _admins,
      //   bool[] memory _required
      // )
      const tx = await signatureAggregatorInstance.addOracles(
        oracleAddresses,
        oracleAdmins,
        required);
      await tx.wait();
    }
  }
};

module.exports.tags = ["02_SignatureAggregator"]
