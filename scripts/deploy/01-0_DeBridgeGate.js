const debridgeInitParams = require("../../assets/debridgeInitParams");
const { deployProxy } = require("../deploy-utils");

module.exports = async function ({ getNamedAccounts, deployments, network }) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  const wethAddress = deployInitParams.external.WETH;
  
  if (!deployInitParams.external.WETH) {
    console.log(`Need to set WETH address!`);
    return;
  }
  await deployProxy("DeBridgeGate", deployer,
    [
      deployInitParams.excessConfirmations,
      wethAddress,
    ],
    true,
    await hre.ethers.getContractFactory('DeBridgeGateProxy', deployer));
};

module.exports.tags = ['01-0_DeBridgeGate'];
module.exports.dependencies = [];
