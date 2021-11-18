const debridgeInitParams = require("../../assets/debridgeInitParams");
const { getLastDeployedProxy, waitTx } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  console.log("Start 09_DeBridgeGateSetup");

  const wethAddress = deployInitParams.external.WETH || (await deployments.get("MockWeth")).address;

  const deBridgeGateInstance = await getLastDeployedProxy("DeBridgeGate", [
    deployInitParams.excessConfirmations,
    wethAddress,
  ]);

  let tx;


  // --------------------------------
  //    setup SignatureVerifier
  // --------------------------------

  if (deployInitParams.deploy.SignatureVerifier) {
    let signatureVerifier = await getLastDeployedProxy("SignatureVerifier", deployer);

    console.log(`deBridge setSignatureVerifier ${signatureVerifier.address}`);
    tx = await deBridgeGateInstance.setSignatureVerifier(signatureVerifier.address);
    await waitTx(tx);

    console.log(`signatureVerifier setDebridgeAddress ${deBridgeGateInstance.address}`);
    tx = await signatureVerifier.setDebridgeAddress(deBridgeGateInstance.address);
    await waitTx(tx);
  }


  // // --------------------------------
  // //    setup ConfirmationAggregator
  // // --------------------------------

  // if (deployInitParams.deploy.ConfirmationAggregator) {
  //   let confirmationAggregator = await getLastDeployedProxy("ConfirmationAggregator", deployer);
  //   console.log(`deBridge setAggregator ${confirmationAggregator.address}`);
  //   tx = await deBridgeGateInstance.setAggregator(confirmationAggregator.address);
  //   await waitTx(tx);
  // }


  // --------------------------------
  //    setup CallProxy
  // --------------------------------

  const callProxy = await getLastDeployedProxy("CallProxy", deployer, []);
  console.log(`deBridge setCallProxy ${callProxy.address}`);
  tx = await deBridgeGateInstance.setCallProxy(callProxy.address);
  await waitTx(tx);

  console.log("callProxy get DEBRIDGE_GATE_ROLE");
  const DEBRIDGE_GATE_ROLE = await callProxy.DEBRIDGE_GATE_ROLE();
  console.log(`callProxy grantRole DEBRIDGE_GATE_ROLE "${DEBRIDGE_GATE_ROLE}" for deBridgeGate "${deBridgeGateInstance.address}"`);
  tx = await callProxy.grantRole(DEBRIDGE_GATE_ROLE, deBridgeGateInstance.address);
  await waitTx(tx);


  // --------------------------------
  //    setup FeeProxy
  // --------------------------------

  const feeProxy = await getLastDeployedProxy("SimpleFeeProxy", deployer);
  console.log(`deBridge setFeeProxy ${feeProxy.address}`);
  tx = await deBridgeGateInstance.setFeeProxy(feeProxy.address);
  await waitTx(tx);

  console.log(`feeProxy setDebridgeGate ${deBridgeGateInstance.address}`);
  tx = await feeProxy.setDebridgeGate(deBridgeGateInstance.address);
  await waitTx(tx);

  console.log(`feeProxy setTreasury ${deployInitParams.treasuryAddress}`);
  tx = await feeProxy.setTreasury(deployInitParams.treasuryAddress);
  await waitTx(tx);

  // --------------------------------
  //    setup DefiController
  // --------------------------------

  if (deployInitParams.deploy.DefiController) {
    let defiController = await getLastDeployedProxy("DefiController", deployer);
    console.log(`deBridge setDefiController ${defiController.address}`);
    tx = await deBridgeGateInstance.setDefiController(defiController.address);
    await waitTx(tx);
  }


  // --------------------------------
  //    setup WethGate
  // --------------------------------

  if (deployInitParams.deploy.wethGate) {
    let wethGate = (await deployments.get("WethGate")).address;
    console.log(`deBridge setWethGate ${wethGate}`);
    tx = await deBridgeGateInstance.setWethGate(wethGate);
    await waitTx(tx);
  }


  // --------------------------------
  //    setup DeBridgeTokenDeployer
  // --------------------------------

  const deBridgeTokenDeployer = await getLastDeployedProxy("DeBridgeTokenDeployer", deployer);

  console.log(`deBridge setDeBridgeTokenDeployer ${deBridgeTokenDeployer.address}`);
  tx = await deBridgeGateInstance.setDeBridgeTokenDeployer(deBridgeTokenDeployer.address);
  await waitTx(tx);

  console.log(`deBridgeTokenDeployer setDebridgeAddress ${deBridgeGateInstance.address}`);
  tx = await deBridgeTokenDeployer.setDebridgeAddress(deBridgeGateInstance.address);
  await waitTx(tx);


  const chainId = await deBridgeGateInstance.getChainId();
  console.log(`chainId: ${chainId}`);
  const wethDebridgeId = await deBridgeGateInstance.getDebridgeId(chainId, wethAddress);
  console.log(`wethDebridgeId: ${wethDebridgeId}`);


  // --------------------------------
  //    calling updateChainSupport
  // --------------------------------

  console.log("updateChainSupport");
  console.log(deployInitParams.supportedChains);
  console.log(deployInitParams.chainSupportInfo);
  tx = await deBridgeGateInstance.updateChainSupport(
    deployInitParams.supportedChains,
    deployInitParams.chainSupportInfo,
    false
  );
  await waitTx(tx);

  tx = await deBridgeGateInstance.updateChainSupport(
    deployInitParams.supportedChains,
    deployInitParams.chainSupportInfo,
    true //_isChainFrom is true for editing getChainFromConfig.
  );
  await waitTx(tx);

  console.log("deployInitParams.supportedChains: ", deployInitParams.supportedChains);
  console.log("deployInitParams.fixedNativeFee: ", deployInitParams.fixedNativeFee);


  // --------------------------------
  //    calling updateAssetFixedFees
  // --------------------------------

  // function updateAssetFixedFees(
  //   bytes32 _debridgeId,
  //   uint256[] memory _supportedChainIds,
  //   uint256[] memory _assetFeesInfo
  // )
  console.log("deBridgeGate updateAssetFixedFeesTx for WETH");
  tx = await deBridgeGateInstance.updateAssetFixedFees(
    wethDebridgeId,
    deployInitParams.supportedChains,
    deployInitParams.fixedNativeFee
  );
  await waitTx(tx);


  // --------------------------------
  //    calling updateGlobalFee
  // --------------------------------

  // function updateGlobalFee(
  //     uint256 _globalFixedNativeFee,
  //     uint16 _globalTransferFeeBps
  // )
  console.log("deBridgeGate updateGlobalFee");
  tx = await deBridgeGateInstance.updateGlobalFee(
    deployInitParams.globalFixedNativeFee,
    deployInitParams.globalTransferFeeBps
  );
  await waitTx(tx);
};

module.exports.tags = ["09_DeBridgeGateSetup"]
module.exports.dependencies = [
  '01-0_DeBridgeGate',
  '01-2_DeBridgeTokenDeployer',
  '02_SignatureAggregator',
  '03_SignatureVerifier',
  // '04_ConfirmationAggregator',
  '05_CallProxy',
  '06_FeeProxy',
  '07_DefiController',
  '08_wethGate',
];
