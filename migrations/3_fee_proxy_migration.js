const FeeProxy = artifacts.require("FeeProxy");
const { getLinkAddress, getUniswapFactory } = require("./utils");

module.exports = async function (deployer, network, accounts) {
  const link = await getLinkAddress(deployer, network, accounts);
  const uniswapFactory = await getUniswapFactory(deployer, network);

  await deployer.deploy(FeeProxy, link, uniswapFactory);
};
