const debridgeInitParams = require("../assets/debridgeInitParams");
const { ethers, upgrades } = require("hardhat");

module.exports = async function({getNamedAccounts, deployments, network}) {
  // const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  if (deployInitParams.deploy.SignatureAggregator)
  {
    //function initialize(uint8 _minConfirmations)

    const SignatureAggregator = await ethers.getContractFactory("SignatureAggregator", deployer);

    const signatureAggregatorInstance = await upgrades.deployProxy(SignatureAggregator, [
      deployInitParams.minConfirmations
    ]);

    await signatureAggregatorInstance.deployed();
    console.log("SignatureAggregator: " + signatureAggregatorInstance.address);

    // Transform oracles to array
    // Transform oracles to array
    let oracleAddresses = deployInitParams.oracles.map(o => o.address);
    let oracleAdmins = deployInitParams.oracles.map(o => o.admin);
    let required = deployInitParams.oracles.map(o => false);

    // function addOracles(
    //   address[] memory _oracles,
    //   address[] memory _admins,
    //   bool[] memory _required
    // )
    console.log("add non required oracles:");
    console.log(deployInitParams.oracles);

    await signatureAggregatorInstance.addOracles(
      oracleAddresses,
      oracleAdmins,
      required);
  }
};

module.exports.tags = ["02_SignatureAggregator"]
