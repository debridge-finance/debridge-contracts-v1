const debridgeInitParams = require("../../assets/debridgeInitParams");
const { ethers } = require("hardhat");
const { deployProxy, getLastDeployedProxy } = require("../deploy-utils");

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
  const callProxy = await getLastDeployedProxy("CallProxy", deployer);
  const feeProxy = await getLastDeployedProxy("FeeProxy", deployer);
  const deBridgeTokenDeployer = await getLastDeployedProxy("DeBridgeTokenDeployer", deployer);

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
  let updateChainSupportTx = await deBridgeGateInstance.updateChainSupport(
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

  let updateChainSupportReceipt = await updateChainSupportTx.wait();
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
  let updateAssetFixedFeesTx = await deBridgeGateInstance.updateAssetFixedFees(
    wethDebridgeId,
    deployInitParams.supportedChains,
    deployInitParams.fixedNativeFee
  );

  let updateAssetFixedFeesReceipt = await updateAssetFixedFeesTx.wait();
  // console.log(updateAssetFixedFeesReceipt);


  // --------------------------------
  //    granting role for debridge in CallProxy
  // --------------------------------

  console.log("callProxy grantRole");
  const DEBRIDGE_GATE_ROLE = await callProxy.DEBRIDGE_GATE_ROLE();
  await callProxy.grantRole(DEBRIDGE_GATE_ROLE, deBridgeGateInstance.address);

  // --------------------------------
  //    setting debridge address for contracts
  // --------------------------------
  await deBridgeTokenDeployer.setDebridgeAddress(deBridgeGateInstance.address);

  if (signatureVerifier) {
    await signatureVerifier.setDebridgeAddress(deBridgeGateInstance.address);
  }
};

module.exports.tags = ["08_DeBridgeGate"]
// TODO: set dependencies
// module.exports.dependencies = ['07_DefiController'];
