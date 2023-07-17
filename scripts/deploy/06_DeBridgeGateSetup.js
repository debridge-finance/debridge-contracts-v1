const debridgeInitParams = require("../../assets/debridgeInitParams");
const { getLastDeployedProxy, waitTx } = require("../deploy-utils");

module.exports = async function ({ getNamedAccounts, deployments, network }) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  console.log("Start 06_DeBridgeGateSetup");

  const deBridgeGateInstance = await getLastDeployedProxy("DeBridgeGate", deployer);

  let tx;

  // --------------------------------
  //    setup SignatureVerifier
  // --------------------------------


  let signatureVerifier = await getLastDeployedProxy("SignatureVerifier", deployer);

  console.log(`deBridge setSignatureVerifier ${signatureVerifier.address}`);
  tx = await deBridgeGateInstance.setSignatureVerifier(signatureVerifier.address);
  await waitTx(tx);

  // --------------------------------
  //    setup CallProxy
  // --------------------------------

  const callProxy = await getLastDeployedProxy("CallProxy", deployer, []);
  console.log(`deBridge setCallProxy ${callProxy.address}`);
  tx = await deBridgeGateInstance.setCallProxy(callProxy.address);
  await waitTx(tx);


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

  // --------------------------------
  //    calling updateChainSupport
  // --------------------------------

  console.log("deployInitParams.supportedChains: ", deployInitParams.supportedChains);
  console.log("deployInitParams.chainSupportInfo: ", deployInitParams.chainSupportInfo);
  console.log("updateChainSupport isChainFrom false");
  tx = await deBridgeGateInstance.updateChainSupport(
    deployInitParams.supportedChains,
    deployInitParams.chainSupportInfo,
    false
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

  console.log("updateChainSupport isChainFrom true");
  tx = await deBridgeGateInstance.updateChainSupport(
    deployInitParams.supportedChains,
    deployInitParams.chainSupportInfo,
    true //_isChainFrom is true for editing getChainFromConfig.
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
  console.log(`globalFixedNativeFee: ${deployInitParams.globalFixedNativeFee}`);
  console.log(`globalTransferFeeBps: ${deployInitParams.globalTransferFeeBps}`);

  tx = await deBridgeGateInstance.updateGlobalFee(
    deployInitParams.globalFixedNativeFee,
    deployInitParams.globalTransferFeeBps
  );
  await waitTx(tx);
};

module.exports.tags = ["06_DeBridgeGateSetup"]
module.exports.dependencies = [
  '01-0_DeBridgeGate',
  '01-2_DeBridgeTokenDeployer',
  '02_SignatureVerifier',
  '03_CallProxy',
  '04_FeeProxy',
  '05_wethGate',
];
