const debridgeInitParams = require("../assets/debridgeInitParams");
const { ethers, upgrades } = require("hardhat");
const { ZERO_ADDRESS } = require("./utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  // const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const networkName = network.name;
  const deployInitParams = debridgeInitParams[networkName];

  if (deployInitParams.deploy.SignatureVerifier)
  {
    //   function initialize(
    //     uint8 _minConfirmations,
    //     uint8 _confirmationThreshold,
    //     uint8 _excessConfirmations,
    //     address _wrappedAssetAdmin,
    //     address _debridgeAddress
    // )

    const SignatureVerifier = await ethers.getContractFactory("SignatureVerifier", deployer);

    const signatureVerifierInstance = await upgrades.deployProxy(SignatureVerifier, [
      deployInitParams.minConfirmations,
      deployInitParams.confirmationThreshold,
      deployInitParams.excessConfirmations,
      deployInitParams.wrappedAssetAdmin,
      ZERO_ADDRESS
    ]);

    await signatureVerifierInstance.deployed();
    console.log("SignatureVerifier: " + signatureVerifierInstance.address);

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

    await signatureVerifierInstance.addOracles(
      oracleAddresses,
      oracleAdmins,
      required);
  }
};

module.exports.tags = ["03_SignatureVerifier"]
