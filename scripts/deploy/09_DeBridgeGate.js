const debridgeInitParams = require("../../assets/debridgeInitParams");
const { ethers } = require("hardhat");
const { FLAGS, deployProxy, getLastDeployedProxy, waitTx } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  console.log("Start 09_DeBridgeGate");

  let signatureVerifier;
  if (deployInitParams.deploy.SignatureVerifier) {
    signatureVerifier = await getLastDeployedProxy("SignatureVerifier", deployer);
  }

  let confirmationAggregator;
  if (deployInitParams.deploy.ConfirmationAggregator) {
    confirmationAggregator = await getLastDeployedProxy("ConfirmationAggregator", deployer);
  }

  const wethAddress = deployInitParams.external.WETH || (await deployments.get("MockWeth")).address;
  const feeProxy = await getLastDeployedProxy("FeeProxy", deployer);
  const deBridgeTokenDeployer = await getLastDeployedProxy("DeBridgeTokenDeployer", deployer);

  const callProxy = await getLastDeployedProxy("CallProxy", deployer, []);

  let defiController;
  if (deployInitParams.deploy.DefiController) {
    defiController = await getLastDeployedProxy("DefiController", deployer);
  }

  let wethGate;
  if (deployInitParams.deploy.wethGate) {
    wethGate = (await deployments.get("WethGate")).address;
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

  let tx;

  // --------------------------------
  //    calling updateChainSupport
  // --------------------------------

  console.log("updateChainSupport");
  console.log(deployInitParams.supportedChains);
  console.log(deployInitParams.chainSupportInfo);
  tx = await deBridgeGateInstance.updateChainSupport(
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


  if (wethGate) {
    console.log(`Setting wethGate ${wethGate} for debridge`);
    tx = await deBridgeGateInstance.setWethGate(wethGate);
    await waitTx(tx);
  }

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

  // --------------------------------
  //    granting role for debridge in CallProxy
  // --------------------------------

  console.log("callProxy grantRole");
  const DEBRIDGE_GATE_ROLE = await callProxy.DEBRIDGE_GATE_ROLE();
  console.log("callProxy grantRole DEBRIDGE_GATE_ROLE for deBridgeGate");
  tx = await callProxy.grantRole(DEBRIDGE_GATE_ROLE, deBridgeGateInstance.address);
  await waitTx(tx);

  console.log("feeProxy setDebridgeGate");
  tx = await feeProxy.setDebridgeGate( deBridgeGateInstance.address);
  await waitTx(tx);

  // --------------------------------
  //    setting debridge address for contracts
  // --------------------------------
  console.log("deBridgeTokenDeployer setDebridgeAddress");
  tx = await deBridgeTokenDeployer.setDebridgeAddress(deBridgeGateInstance.address);
  await waitTx(tx);

  if (signatureVerifier) {
    console.log("signatureVerifier setDebridgeAddress");
    tx = await signatureVerifier.setDebridgeAddress(deBridgeGateInstance.address);
    await waitTx(tx);
  }
};

module.exports.tags = ["09_DeBridgeGate"]
module.exports.dependencies = [
  '01-2_DeBridgeTokenDeployer',
  '02_SignatureAggregator',
  '03_SignatureVerifier',
  '04_ConfirmationAggregator',
  '05_CallProxy',
  '06_FeeProxy',
  '07_DefiController',
  '08_wethGate',
];
