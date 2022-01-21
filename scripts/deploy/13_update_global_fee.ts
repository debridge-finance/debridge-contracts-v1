// @ts-nocheck
const { ethers, upgrades } = require("hardhat");
const { getLastDeployedProxy, waitTx } = require("../deploy-utils");
const debridgeInitParams = require("../../assets/debridgeInitParams").default;

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();

  console.log('*'.repeat(80));
  console.log(`\tStart upgrade deBridgeGate weth to new address {}`);
  console.log(`\tfrom DEPLOYER ${deployer}`);
  console.log('*'.repeat(80));

  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  const deBridgeGateFactory = await ethers.getContractFactory("DeBridgeGate", deployer);
  const deBridgeGateInstance = network.live
      ? await deBridgeGateFactory.attach('0x68d936cb4723bdd38c488fd50514803f96789d2d')
      : await getLastDeployedProxy("DeBridgeGate", deployer)
  ;
  console.log(await deBridgeGateInstance.hasRole(await deBridgeGateInstance.DEFAULT_ADMIN_ROLE(), deployer));

  console.log("deployInitParams.globalFixedNativeFee: ", deployInitParams.globalFixedNativeFee);
  console.log("deployInitParams.globalTransferFeeBps: ", deployInitParams.globalTransferFeeBps);

  const updateGlobalFeeTx = await deBridgeGateInstance.updateGlobalFee(
    deployInitParams.globalFixedNativeFee,
    deployInitParams.globalTransferFeeBps);
  await waitTx(updateGlobalFeeTx);
  console.log(`updateGlobalFeeTx: ${updateGlobalFeeTx.hash}`);

  console.log("new globalFixedNativeFee: ",  await deBridgeGateInstance.globalFixedNativeFee());
};

module.exports.tags = ["13_update_global_fee"];
module.exports.dependencies = [''];
