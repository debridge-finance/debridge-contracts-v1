const debridgeInitParams = require("../assets/debridgeInitParams");
const { ethers, upgrades } = require("hardhat");


module.exports = async function({getNamedAccounts, deployments, network}) {
  // const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  const weth = deployInitParams.external.WETH || (await deployments.get("WETH9")).address;
  const uniswapFactory = deployInitParams.UniswapFactory || (await deployments.get("UniswapV2Factory")).address;

  const FeeProxy = await ethers.getContractFactory("FeeProxy", deployer);
  const feeProxyInstance = await upgrades.deployProxy(FeeProxy, [
    uniswapFactory,
    weth,
  ]);
  await feeProxyInstance.deployed();
  console.log("FeeProxy: " + feeProxyInstance.address);
};

module.exports.tags = ["06_FeeProxy"]
