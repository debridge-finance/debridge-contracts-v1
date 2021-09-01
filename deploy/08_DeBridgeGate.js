const debridgeInitParams = require("../assets/debridgeInitParams");

module.exports = async function({getNamedAccounts, deployments, network}) {
  // const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

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
  let signatureVerifier;
  if (deployInitParams.deploy.SignatureVerifier) {
    signatureVerifier = await deployments.get("SignatureVerifier");
  }
  let confirmationAggregator;
  if (deployInitParams.deploy.ConfirmationAggregator) {
    confirmationAggregator = await deployments.get('ConfirmationAggregator');
  }
  const callProxy = await deployments.get('CallProxy');
  const weth = deployInitParams.external.WETH || (await deployments.get("WETH9")).address;
  const feeProxy = await deployments.get('FeeProxy');
  const defiController = await deployments.get('DefiController');

  // const DeBridgeGate = await ethers.getContractFactory("DeBridgeGate", deployer);
  // const deBridgeGateInstance = await upgrades.deployProxy(DeBridgeGate, [
  //   deployInitParams.excessConfirmations,
  //   signatureVerifier ? signatureVerifier.address : ethers.constants.AddressZero,
  //   confirmationAggregator ? confirmationAggregator.address : ethers.constants.AddressZero,
  //   callProxy.address,
  //   weth,
  //   feeProxy.address,
  //   defiController.address,
  // ]);

  // await deBridgeGateInstance.deployed();
  // console.log("DeBridgeGate: " + deBridgeGateInstance.address);

  console.log('Deploying DeBridgeGate with params');
  console.log({
    excessConfirmations: deployInitParams.excessConfirmations,
    signatureVerifier: signatureVerifier ? signatureVerifier.address : ethers.constants.AddressZero,
    confirmationAggregator: confirmationAggregator ? confirmationAggregator.address : ethers.constants.AddressZero,
    callProxy: callProxy.address,
    weth: weth,
    feeProxy: feeProxy.address,
    defiController: defiController.address,
  })

  // TODO: call updateChainSupport

  // TODO: call setDebridgeAddress
  // if (deployInitParams.deploy.SignatureVerifier) {
  //   signatureVerifier.setDebridgeAddress(deBridgeGateInstance.address);
  // }
  // if (deployInitParams.deploy.ConfirmationAggregator) {
  //   confirmationAggregator.setDebridgeAddress(deBridgeGateInstance.address);
  // }
};

module.exports.tags = ["08_DeBridgeGate"]
// TODO: set dependencies
module.exports.dependencies = ['07_DefiController'];
