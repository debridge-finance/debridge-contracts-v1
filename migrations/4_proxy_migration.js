const FeeProxy = artifacts.require("FeeProxy");
const CallProxy = artifacts.require("CallProxy");
const { getLinkAddress, getUniswapFactory } = require("./utils");

module.exports = async function (deployer, network, accounts) {
  // if (network == "test") return;
  const debridgeInitParams = require("../assets/debridgeInitParams")[network];
  await deployer.deploy(CallProxy);
  console.log("CallProxy: " + CallProxy.address);

  // if (debridgeInitParams.type == "light") return;

  const link = await getLinkAddress(deployer, network, accounts);
  const uniswapFactory = await getUniswapFactory(deployer, network);

  await deployer.deploy(FeeProxy, link, uniswapFactory);
  console.log("FeeProxy: " + FeeProxy.address);
};
