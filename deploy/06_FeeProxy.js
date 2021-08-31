// const debridgeInitParams = require("../assets/debridgeInitParams");
const { ethers, upgrades } = require("hardhat");
const { getWeth, getUniswapFactory } = require("./utils");


module.exports = async function({getNamedAccounts, deployments, network}) {
  // const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  // const deployInitParams = debridgeInitParams[network.name];

  const weth = await getWeth(deployer, network.name);
  const uniswapFactory = await getUniswapFactory(deployer, network.name);
  console.log("weth: " + weth);
  console.log("uniswapFactory: " + uniswapFactory);

  const FeeProxy = await ethers.getContractFactory("FeeProxy", deployer);
  const feeProxyInstance = await upgrades.deployProxy(FeeProxy, [
    uniswapFactory,
    weth,
  ]);
  await feeProxyInstance.deployed();
  console.log("FeeProxy: " + feeProxyInstance.address);
};

module.exports.tags = ["06_FeeProxy"]
