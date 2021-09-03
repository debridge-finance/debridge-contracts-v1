const debridgeInitParams = require("../../assets/debridgeInitParams");
const { ethers } = require("hardhat");
const { deployProxy } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();
  const networkName = network.name;
  const deployInitParams = debridgeInitParams[networkName];
  if (!deployInitParams) return;

  if (deployInitParams.deploy.SignatureVerifier) {
    //   function initialize(
    //     uint8 _minConfirmations,
    //     uint8 _confirmationThreshold,
    //     uint8 _excessConfirmations,
    //     address _wrappedAssetAdmin,
    //     address _debridgeAddress
    // )


    const { contract: signatureVerifierInstance, isDeployed } = await deployProxy("SignatureVerifier", deployer, [
      deployInitParams.minConfirmations,
      deployInitParams.confirmationThreshold,
      deployInitParams.excessConfirmations,
      deployInitParams.wrappedAssetAdmin,
      ethers.constants.AddressZero
    ], true);

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

      const tx = await signatureVerifierInstance.addOracles(
        oracleAddresses,
        oracleAdmins,
        required);
      await tx.wait();
    }
  }
};

module.exports.tags = ["03_SignatureVerifier"]
