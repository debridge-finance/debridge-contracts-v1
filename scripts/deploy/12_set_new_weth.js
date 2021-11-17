const { ethers, upgrades } = require("hardhat");
const { waitTx } = require("../deploy-utils");
const debridgeInitParams = require("../../assets/debridgeInitParams");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();

  console.log('*'.repeat(80));
  console.log(`\tStart upgrade deBridgeGate weth to new address {}`);
  console.log(`\tfrom DEPLOYER ${deployer}`);
  console.log('*'.repeat(80));

  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;
  const wethAddress = deployInitParams.external.WETH;

  const deBridgeGateFactory = await ethers.getContractFactory("DeBridgeGate", deployer);
  const deBridgeGateInstance = await deBridgeGateFactory.attach("0x68d936cb4723bdd38c488fd50514803f96789d2d");

  // if (wethAddress) {
  //   const tx = await deBridgeGateInstance.setWeth(wethAddress);
  //   await waitTx(tx);

  //   const newWeth = await deBridgeGateInstance.weth();
  //   console.log(`newWeth: ${newWeth}`);

  //   const chainId = await deBridgeGateInstance.getChainId();
  //   console.log(`chainId: ${chainId}`);
  //   const wethDebridgeId = await deBridgeGateInstance.getDebridgeId(chainId, wethAddress);
  //   console.log(`wethDebridgeId: ${wethDebridgeId}`);

  //   const updateAssetFixedFeesTx = await deBridgeGateInstance.updateAssetFixedFees(
  //     wethDebridgeId,
  //     deployInitParams.supportedChains,
  //     deployInitParams.fixedNativeFee
  //   );
  //   await waitTx(updateAssetFixedFeesTx);
  //   console.log(`updateAssetFixedFeesTx: ${updateAssetFixedFeesTx.hash}`);
  // }

  // console.log("updateChainSupport");
  // console.log(deployInitParams.supportedChains);
  // console.log(deployInitParams.chainSupportInfo);
  // tx = await deBridgeGateInstance.updateChainSupport(
  //   deployInitParams.supportedChains,
  //   deployInitParams.chainSupportInfo
  // );
  // await waitTx(tx);

  console.log("deployInitParams.supportedChains: ", deployInitParams.supportedChains);
  console.log("deployInitParams.fixedNativeFee: ", deployInitParams.fixedNativeFee);

  const updateGlobalFeeTx = await deBridgeGateInstance.updateGlobalFee(
    deployInitParams.globalFixedNativeFee,
    deployInitParams.globalTransferFeeBps);
  await waitTx(updateGlobalFeeTx);
  console.log(`updateGlobalFeeTx: ${updateGlobalFeeTx.hash}`);
};

module.exports.tags = ["12_set_new_weth"];
module.exports.dependencies = [''];
