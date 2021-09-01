const debridgeInitParams = require("../assets/debridgeInitParams");
const { ethers, upgrades } = require("hardhat");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const networkName = network.name;
  const deployInitParams = debridgeInitParams[networkName];
  if (!deployInitParams) return;

  if (deployInitParams.deploy.ConfirmationAggregator)
  {
    // function initialize(
    //     uint8 _minConfirmations,
    //     uint8 _confirmationThreshold,
    //     uint8 _excessConfirmations,
    //     address _wrappedAssetAdmin,
    //     address _debridgeAddress
    // )

    const ConfirmationAggregator = await ethers.getContractFactory("ConfirmationAggregator", deployer);

    const confirmationAggregatorInstance = await upgrades.deployProxy(ConfirmationAggregator, [
      deployInitParams.minConfirmations,
      deployInitParams.confirmationThreshold,
      deployInitParams.excessConfirmations,
      deployInitParams.wrappedAssetAdmin,
      ethers.constants.AddressZero,
    ]);

    await confirmationAggregatorInstance.deployed();
    console.log("ConfirmationAggregator: " + confirmationAggregatorInstance.address);

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
    await confirmationAggregatorInstance.addOracles(
      oracleAddresses,
      oracleAdmins,
      required);
  }
};

module.exports.tags = ["04_ConfirmationAggregator"]
