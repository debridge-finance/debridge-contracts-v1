const FeeProxy = artifacts.require("FeeProxy");
const { getLinkAddress, getUniswapFactory } = require("./utils");

module.exports = async function (deployer, network, accounts) {
  if (network == "test") return;
  const debridgeInitParams = require("../assets/debridgeInitParams")[network];
  if (debridgeInitParams.type == "light") return;

  const link = await getLinkAddress(deployer, network, accounts);
  const uniswapFactory = await getUniswapFactory(deployer, network);

  await deployer.deploy(FeeProxy, link, uniswapFactory);
};
