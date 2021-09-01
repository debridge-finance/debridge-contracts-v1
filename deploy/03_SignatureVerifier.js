const debridgeInitParams = require("../assets/debridgeInitParams");
const { ethers, upgrades } = require("hardhat");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();
  const networkName = network.name;
  const deployInitParams = debridgeInitParams[networkName];
  if (!deployInitParams) return;

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
      ethers.constants.AddressZero
    ]);

    await signatureVerifierInstance.deployed();

    // const deployResult = await deploy('SignatureVerifier', {
    //   from: deployer,
    //   proxy: {
    //     proxyContract:'OpenZeppelinTransparentProxy',
    //     viaAdminContract: 'ProxyAdmin',
    //     execute: {
    //       methodName: 'initialize',
    //       args: [
    //         deployInitParams.minConfirmations,
    //         deployInitParams.confirmationThreshold,
    //         deployInitParams.excessConfirmations,
    //         deployInitParams.wrappedAssetAdmin,
    //         ethers.constants.AddressZero,
    //       ],
    //     },
    //   },
    //   log: true,
    // });
    // console.log(deployResult);
    // console.log(deployResult.contract);

    console.log("SignatureVerifier: " + signatureVerifierInstance.address);

    // if (deployResult.newlyDeployed) {

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

    await signatureVerifierInstance.addOracles(
      oracleAddresses,
      oracleAdmins,
      required);

    // await execute('SignatureVerifier', {from: deployer, log: true},
    //   'addOracles', oracleAddresses, oracleAdmins, required
    // );
    // }
  }
};

module.exports.tags = ["03_SignatureVerifier"]
