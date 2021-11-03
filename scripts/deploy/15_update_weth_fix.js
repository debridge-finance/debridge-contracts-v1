const { ethers, upgrades } = require("hardhat");
const { getLastDeployedProxy, waitTx } = require("../deploy-utils");
const debridgeInitParams = require("../../assets/debridgeInitParams");

module.exports = async function ({ getNamedAccounts, deployments, network }) {
  const { deployer } = await getNamedAccounts();

  console.log('*'.repeat(80));
  console.log(`\tStart upgrade 15_update_weth_fix`);
  console.log(`\tfrom DEPLOYER ${deployer}`);
  console.log('*'.repeat(80));

  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;
  const wethAddress = deployInitParams.external.WETH;

  const deBridgeGateFactory = await ethers.getContractFactory("DeBridgeGate", deployer);
  const deBridgeGateInstance = await deBridgeGateFactory.attach("0x68d936cb4723bdd38c488fd50514803f96789d2d");

  const weth = await deBridgeGateInstance.weth();
  console.log(`weth: ${weth}`);
  const chainId = await deBridgeGateInstance.getChainId();
  const wethDebridgeId = await deBridgeGateInstance.getDebridgeId(chainId, weth);
  console.log(`wethDebridgeId: ${wethDebridgeId}`);

  console.log(`updateAssetFixedFees: ${wethDebridgeId}`,
    {
      wethDebridgeId: wethDebridgeId,
      supportedChains: deployInitParams.supportedChains,
      fixedNativeFee: deployInitParams.fixedNativeFee
    });
  const updateAssetFixedFeesTx = await deBridgeGateInstance.updateAssetFixedFees(
      wethDebridgeId,
      deployInitParams.supportedChains,
      deployInitParams.fixedNativeFee
  );
  await waitTx(updateAssetFixedFeesTx);
  console.log(`updateAssetFixedFeesTx: ${updateAssetFixedFeesTx.hash}`);
};

module.exports.tags = ["15_update_weth_fix"];
module.exports.dependencies = [''];
