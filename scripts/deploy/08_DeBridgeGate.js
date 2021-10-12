const debridgeInitParams = require("../../assets/debridgeInitParams");
const { ethers } = require("hardhat");
const { FLAGS, deployProxy, getLastDeployedProxy, sleepInterval } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  console.log("Start 08_DeBridgeGate");

  let signatureVerifier;
  if (deployInitParams.deploy.SignatureVerifier) {
    signatureVerifier = await getLastDeployedProxy("SignatureVerifier", deployer);
  }

  let confirmationAggregator;
  if (deployInitParams.deploy.ConfirmationAggregator) {
    confirmationAggregator = await getLastDeployedProxy("ConfirmationAggregator", deployer);
  }

  const wethAddress = deployInitParams.external.WETH || (await deployments.get("WETH9")).address;
  const feeProxy = await getLastDeployedProxy("FeeProxy", deployer);
  const deBridgeTokenDeployer = await getLastDeployedProxy("DeBridgeTokenDeployer", deployer);

  const callProxy = await getLastDeployedProxy("CallProxy", deployer, [0]);
  const callProxyWithSender = await getLastDeployedProxy("CallProxy", deployer, [FLAGS.PROXY_WITH_SENDER]);
  if (callProxy.address == callProxyWithSender.address) {
    console.error("ERROR. CallProxy and CallProxy with sender are the same");
    return;
  }

  let defiController;
  if (deployInitParams.deploy.DefiController) {
    defiController = await getLastDeployedProxy("DefiController", deployer);
  }

  // function initialize(
  //   uint8 _excessConfirmations,
  //   address _signatureVerifier,
  //   address _confirmationAggregator,
  //   address _callProxy,
  //   IWETH _weth,
  //   address _feeProxy,
  //   address _defiController
  // )
  console.log("deployProxy DeBridgeGate");
  const { contract: deBridgeGateInstance, isDeployed } = await deployProxy("DeBridgeGate", deployer, [
    deployInitParams.excessConfirmations,
    signatureVerifier ? signatureVerifier.address : ethers.constants.AddressZero,
    confirmationAggregator ? confirmationAggregator.address : ethers.constants.AddressZero,
    callProxy.address,
    wethAddress,
    feeProxy.address,
    deBridgeTokenDeployer.address,
    defiController ? defiController.address : ethers.constants.AddressZero,
  ], true)

  if (!isDeployed) {
    // exit if contract was already deployed and initialized before
    return
  }

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
  const updateChainSupportTx = await deBridgeGateInstance.updateChainSupport(
    deployInitParams.supportedChains,
    deployInitParams.chainSupportInfo
    //  [bscChainId, hecoChainId],
    //  [
    //      {
    //          transferFeeBps,
    //          fixedNativeFee: fixedNativeFeeBNB,
    //          isSupported,
    //      },
    //      {
    //          transferFeeBps,
    //          fixedNativeFee: fixedNativeFeeHT,
    //          isSupported,
    //      },
    //  ]
  );

  const updateChainSupportReceipt = await updateChainSupportTx.wait();
  await sleepInterval();
  // console.log(updateChainSupportReceipt);

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
  const updateAssetFixedFeesTx = await deBridgeGateInstance.updateAssetFixedFees(
    wethDebridgeId,
    deployInitParams.supportedChains,
    deployInitParams.fixedNativeFee
  );

  const updateAssetFixedFeesReceipt = await updateAssetFixedFeesTx.wait();
  await sleepInterval();
  // console.log(updateAssetFixedFeesReceipt);

  console.log("Set callProxy with sender for deBridgeGate");
  await deBridgeGateInstance.setCallProxy(FLAGS.PROXY_WITH_SENDER, callProxyWithSender.address);
  await sleepInterval();
  // --------------------------------
  //    calling updateGlobalFee
  // --------------------------------

  // function updateGlobalFee(
  //     uint256 _globalFixedNativeFee,
  //     uint16 _globalTransferFeeBps
  // )
  console.log("deBridgeGate updateGlobalFee");
  const updateGlobalFeeTx = await deBridgeGateInstance.updateGlobalFee(
    deployInitParams.globalFixedNativeFee,
    deployInitParams.globalTransferFeeBps
  );

  const updateGlobalFeeReceipt = await updateGlobalFeeTx.wait();
  await sleepInterval();
  // console.log(updateGlobalFeeReceipt);

  // --------------------------------
  //    granting role for debridge in CallProxy
  // --------------------------------

  console.log("callProxy grantRole");
  const DEBRIDGE_GATE_ROLE = await callProxy.DEBRIDGE_GATE_ROLE();
  console.log("callProxy grantRole DEBRIDGE_GATE_ROLE for deBridgeGate");
  await callProxy.grantRole(DEBRIDGE_GATE_ROLE, deBridgeGateInstance.address);
  await sleepInterval();
  console.log("callProxyWithSender grantRole DEBRIDGE_GATE_ROLE for deBridgeGate");
  await callProxyWithSender.grantRole(DEBRIDGE_GATE_ROLE, deBridgeGateInstance.address);
  await sleepInterval();
  console.log("feeProxy setDebridgeGate");
  await feeProxy.setDebridgeGate( deBridgeGateInstance.address);
  await sleepInterval();
  // --------------------------------
  //    setting debridge address for contracts
  // --------------------------------
  console.log("deBridgeTokenDeployer setDebridgeAddress");
  await deBridgeTokenDeployer.setDebridgeAddress(deBridgeGateInstance.address);
  await sleepInterval();
  if (signatureVerifier) {
    console.log("signatureVerifier setDebridgeAddress");
    await signatureVerifier.setDebridgeAddress(deBridgeGateInstance.address);
    await sleepInterval();
  }
};

module.exports.tags = ["08_DeBridgeGate"]
module.exports.dependencies = [
  '01-2_DeBridgeTokenDeployer',
  '02_SignatureAggregator',
  '03_SignatureVerifier',
  '04_ConfirmationAggregator',
  '05_CallProxy',
  '06_FeeProxy',
  '07_DefiController',
];
