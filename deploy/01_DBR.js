const debridgeInitParams = require("../assets/debridgeInitParams");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  // constructor(
  //   string memory _name,
  //   string memory _symbol,
  //   uint8 _tokenDecimals,
  //   address _admin,
  //   address[] memory _minters
  // )

  if (deployInitParams.deploy.DBR) {
    await deploy("WrappedAsset", {
      from: deployer,
      args: [
        "Debridge token",
        "DBR",
        18,
        deployer,
        [deployer],
      ],
      // deterministicDeployment: true,
      log: true,
    });
  }
};

module.exports.tags = ["01_DBR"]
