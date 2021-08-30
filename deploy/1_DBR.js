const debridgeInitParams = require("../assets/debridgeInitParams");

module.exports = async function({ getNamedAccounts,
  deployments,
  getChainId,
  network,
  }) {
  const {deploy} = deployments;
  const { deployer } = await getNamedAccounts();
  const networkName = network.name;
  const deployInitParams = debridgeInitParams[networkName];

  // constructor(
  //   string memory _name,
  //   string memory _symbol,
  //   uint8 _tokenDecimals,
  //   address _admin,
  //   address[] memory _minters
  // )
  if (deployInitParams.deploy.DBR)
  {
    await deploy("WrappedAsset", {
      from: deployer,
      log: true,
      args:["Debridge token", "DBR", 18, deployer, [deployer]]
    });
  }
};

module.exports.tags = ["1_DBR"]
