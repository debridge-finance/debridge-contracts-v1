const debridgeInitParams = require("../../assets/debridgeInitParams");
const { deployProxy } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  const weth = deployInitParams.external.WETH || (await deployments.get("WETH9")).address;
  const uniswapFactory = deployInitParams.external.UniswapFactory || (await deployments.get("UniswapV2Factory")).address;

  await deployProxy("FeeProxy", deployer, [uniswapFactory, weth], true);

  //TODO: FeeProxy setTreasury for each chains
  //TODO: FeeProxy setDeEthToken
  //TODO: FeeProxy setFeeProxyAddress for each chains
  //TODO: FeeProxy setFeeProxyAddress for each chains
  //TODO: FeeProxy add workers
};

module.exports.tags = ["06_FeeProxy"]
