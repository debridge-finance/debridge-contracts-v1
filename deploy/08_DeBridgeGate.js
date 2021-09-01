const debridgeInitParams = require("../assets/debridgeInitParams");
const { ethers } = require("hardhat");
const fs = require("fs");
const {getContractAddress} = require("../utils");
const { toWei } = web3.utils;

module.exports = async function({getNamedAccounts, deployments, network}) {
  // const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;


  console.log("Start 08_DeBridgeGate");

  // function initialize(
  //   uint8 _excessConfirmations,
  //   address _signatureVerifier,
  //   address _confirmationAggregator,
  //   address _callProxy,
  //   IWETH _weth,
  //   address _feeProxy,
  //   address _defiController
  // )

  // TODO: fix getting already deployed contracts
  let signatureVerifierAddress;
  if (deployInitParams.deploy.SignatureVerifier) {
    const SignatureAggregatorFactory = await ethers.getContractFactory("SignatureVerifier", deployer);
    const byteCodeImplementanionHash = ethers.utils.keccak256(SignatureAggregatorFactory.bytecode);
    signatureVerifierAddress = await getContractAddress(network, byteCodeImplementanionHash);
  }

  let confirmationAggregatorAddress;
  // if (deployInitParams.deploy.ConfirmationAggregator) {
  //   confirmationAggregatorAddress = await deployments.get('ConfirmationAggregator');
  // }

  const callProxyFactory = await ethers.getContractFactory("CallProxy", deployer);

  const callProxyHash = ethers.utils.keccak256(callProxyFactory.bytecode);
  const callProxyAddress = await getContractAddress(network, callProxyHash);

  const callProxy = await callProxyFactory.attach(
    callProxyAddress
  );

  // const callProxy = await deployments.get('CallProxy');
  const weth = deployInitParams.external.WETH || (await deployments.get("WETH9")).address;
  // const feeProxy = await deployments.get('FeeProxy');

  const feeProxyFactory = await ethers.getContractFactory("FeeProxy", deployer);
  const feeProxyHash = ethers.utils.keccak256(feeProxyFactory.bytecode);
  const feeProxyAddress = await getContractAddress(network, feeProxyHash);

  const feeProxy = await feeProxyFactory.attach(
    feeProxyAddress
  );

  console.log("signatureVerifierAddress " + signatureVerifierAddress);
  console.log("callProxyAddress " + callProxyAddress);
  console.log("feeProxyAddress " + feeProxyAddress);


  //TODO:  defiControllerAddress is AddressZero
  const defiControllerAddress = ethers.constants.AddressZero;
  // = await deployments.get('DefiController');

  console.log('Deploying DeBridgeGate with params');
  console.log({
    excessConfirmations: deployInitParams.excessConfirmations,
    signatureVerifier: signatureVerifierAddress ? signatureVerifierAddress : ethers.constants.AddressZero,
    confirmationAggregator: confirmationAggregatorAddress ? confirmationAggregatorAddress: ethers.constants.AddressZero,
    callProxy: callProxyAddress,
    weth: weth,
    feeProxy: feeProxyAddress,
    defiController: defiControllerAddress,
  })

  const DeBridgeGate = await ethers.getContractFactory("DeBridgeGate", deployer);
  const deBridgeGateInstance = await upgrades.deployProxy(DeBridgeGate, [
    deployInitParams.excessConfirmations,
    signatureVerifierAddress ? signatureVerifierAddress : ethers.constants.AddressZero,
    confirmationAggregatorAddress ? confirmationAggregatorAddress : ethers.constants.AddressZero,
    callProxyAddress,
    weth,
    feeProxyAddress,
    defiControllerAddress,
  ]);

  await deBridgeGateInstance.deployed();
  console.log("DeBridgeGate: " + deBridgeGateInstance.address);

  const wethAddress = deployInitParams.external.WETH || (await deployments.get("WETH9")).address;
  console.log(`wethETH: ${wethAddress}`);
  const chainId = await deBridgeGateInstance.getChainId();
  console.log(`chainId: ${chainId}`);
  const wethDebridgeId = await deBridgeGateInstance.getDebridgeId(chainId, wethAddress);
  console.log(`wethDebridgeId: ${wethDebridgeId}`);


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
  console.log(updateChainSupportReceipt);

  // TODO: call setDebridgeAddress
  // if (deployInitParams.deploy.SignatureVerifier) {
  //   signatureVerifier.setDebridgeAddress(deBridgeGateInstance.address);
  // }
  // if (deployInitParams.deploy.ConfirmationAggregator) {
  //   confirmationAggregator.setDebridgeAddress(deBridgeGateInstance.address);
  // }


  console.log("deployInitParams.supportedChains");
  console.log(deployInitParams.supportedChains);
  console.log("deployInitParams.fixedNativeFee");
  console.log(deployInitParams.fixedNativeFee);

  //   function updateAssetFixedFees(
  //     bytes32 _debridgeId,
  //     uint256[] memory _supportedChainIds,
  //     uint256[] memory _assetFeesInfo
  // )
  console.log("updateAssetFixedFees");
  let updateAssetFixedFeesTx =  await deBridgeGateInstance.updateAssetFixedFees(
    wethDebridgeId,
    deployInitParams.supportedChains,
    deployInitParams.fixedNativeFee
    // wethDebridgeId,
    // deployInitParams.supportedChains,
    // deployInitParams.fixedNativeFee
  );

  let updateAssetFixedFeesReceipt = await updateAssetFixedFeesTx.wait();
  console.log(updateAssetFixedFeesReceipt);
  console.log("Success");

  console.log("callProxy grantRole");
  const DEBRIDGE_GATE_ROLE = await callProxy.DEBRIDGE_GATE_ROLE();
  await callProxy.grantRole(DEBRIDGE_GATE_ROLE, deBridgeGateInstance.address);
  console.log("Success");
};

module.exports.tags = ["08_DeBridgeGate"]
// TODO: set dependencies
// module.exports.dependencies = ['07_DefiController'];
