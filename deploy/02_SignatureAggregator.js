const debridgeInitParams = require("../assets/debridgeInitParams");
const { ethers, upgrades } = require("hardhat");

module.exports = async function({getNamedAccounts, deployments, network}) {
  // const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];

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
    let oracleAddresses = [];
    let oracleAdmins = [];
    let required = [];
    for (let oracle of deployInitParams.oracles) {
      oracleAddresses.push(oracle.address);
      oracleAdmins.push(oracle.admin);
      required.push(false);
    }

    // function addOracles(
    //   address[] memory _oracles,
    //   address[] memory _admins,
    //   bool[] memory _required
    // )
    console.log("add oracles:");
    console.log(oracleAddresses);
    console.log("add oracles admins:");
    console.log(oracleAdmins);
    console.log("add oracles required:");
    console.log(required);

    await signatureAggregatorInstance.addOracles(
      oracleAddresses,
      oracleAdmins,
      required);
  }
};

module.exports.tags = ["02_SignatureAggregator"]
