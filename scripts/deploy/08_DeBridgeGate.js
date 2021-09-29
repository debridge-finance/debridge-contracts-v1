const debridgeInitParams = require("../../assets/debridgeInitParams");
const { ethers } = require("hardhat");
const { deployProxy, getLastDeployedProxy } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;
  const multisig = process.env.MULTISIG_ACCOUNT;

  console.log(`MULTISIG_ACCOUNT: ${multisig}`);
  if (!multisig) {
    console.error("ERROR. env.MULTISIG_ACCOUNT is eampty");
    return;
  }

  if (multisig==deployer) {
    console.error("ERROR. env.MULTISIG_ACCOUNT must be different from the deployer");
    return;
  }

  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

  console.log("Start 08_DeBridgeGate");

  let signatureVerifier;
  if (deployInitParams.deploy.SignatureVerifier) {
    signatureVerifier = await getLastDeployedProxy("SignatureVerifier", deployer);
  }

  let confirmationAggregator;
  if (deployInitParams.deploy.ConfirmationAggregator) {
    confirmationAggregator = await getLastDeployedProxy("ConfirmationAggregator", deployer);
    console.log("confirmationAggregator grantRole DEFAULT_ADMIN_ROLE for multisig");
    await confirmationAggregator.grantRole(DEFAULT_ADMIN_ROLE, multisig);
    console.log("confirmationAggregator revokeRole DEFAULT_ADMIN_ROLE for deployer");
    await confirmationAggregator.revokeRole(DEFAULT_ADMIN_ROLE, deployer);
  }

  const wethAddress = deployInitParams.external.WETH || (await deployments.get("WETH9")).address;
  //TODO: deploy callProxy with sender
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
  console.log("deBridgeGate updateAssetFixedFeesTx for WETH");
  let updateAssetFixedFeesTx = await deBridgeGateInstance.updateAssetFixedFees(
    wethDebridgeId,
    deployInitParams.supportedChains,
    deployInitParams.fixedNativeFee
  );

  let updateAssetFixedFeesReceipt = await updateAssetFixedFeesTx.wait();
  // console.log(updateAssetFixedFeesReceipt);

  console.log("deBridgeGate grantRole DEFAULT_ADMIN_ROLE for multisig");
  await deBridgeGateInstance.grantRole(DEFAULT_ADMIN_ROLE, multisig);
  console.log("deBridgeGate revokeRole DEFAULT_ADMIN_ROLE for deployer");
  await deBridgeGateInstance.revokeRole(DEFAULT_ADMIN_ROLE, deployer);


  // --------------------------------
  //    granting role for debridge in CallProxy
  // --------------------------------

  console.log("callProxy grantRole");
  const DEBRIDGE_GATE_ROLE = await callProxy.DEBRIDGE_GATE_ROLE();
  console.log("callProxy grantRole DEBRIDGE_GATE_ROLE for deBridgeGate");
  await callProxy.grantRole(DEBRIDGE_GATE_ROLE, deBridgeGateInstance.address);
  console.log("callProxy grantRole DEFAULT_ADMIN_ROLE for multisig");
  await callProxy.grantRole(DEFAULT_ADMIN_ROLE, multisig);
  console.log("callProxy revokeRole DEFAULT_ADMIN_ROLE for deployer");
  await callProxy.revokeRole(DEFAULT_ADMIN_ROLE, deployer);


  console.log("feeProxy setDebridgeGate");
  await feeProxy.setDebridgeGate( deBridgeGateInstance.address);
  console.log("feeProxy grantRole DEFAULT_ADMIN_ROLE for multisig");
  await feeProxy.grantRole(DEFAULT_ADMIN_ROLE, multisig);
  console.log("feeProxy revokeRole DEFAULT_ADMIN_ROLE for deployer");
  await feeProxy.revokeRole(DEFAULT_ADMIN_ROLE, deployer);

  // --------------------------------
  //    setting debridge address for contracts
  // --------------------------------
  console.log("deBridgeTokenDeployer setDebridgeAddress");
  await deBridgeTokenDeployer.setDebridgeAddress(deBridgeGateInstance.address);

  console.log("deBridgeTokenDeployer grantRole DEFAULT_ADMIN_ROLE for multisig");
  await deBridgeTokenDeployer.grantRole(DEFAULT_ADMIN_ROLE, multisig);
  console.log("deBridgeTokenDeployer revokeRole DEFAULT_ADMIN_ROLE for deployer");
  await deBridgeTokenDeployer.revokeRole(DEFAULT_ADMIN_ROLE, deployer);

  if (signatureVerifier) {
    console.log("signatureVerifier setDebridgeAddress");
    await signatureVerifier.setDebridgeAddress(deBridgeGateInstance.address);
    console.log("signatureVerifier grantRole DEFAULT_ADMIN_ROLE for multisig");
    await signatureVerifier.grantRole(DEFAULT_ADMIN_ROLE, multisig);
    console.log("signatureVerifier revokeRole DEFAULT_ADMIN_ROLE for deployer");
    await signatureVerifier.revokeRole(DEFAULT_ADMIN_ROLE, deployer);
  }
};

module.exports.tags = ["08_DeBridgeGate"]
// TODO: set dependencies
// module.exports.dependencies = ['07_DefiController'];
