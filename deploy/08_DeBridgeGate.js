const debridgeInitParams = require("../assets/debridgeInitParams");
const { getWeth, ZERO_ADDRESS } = require("./utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  // const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];

  // function initialize(
  //   uint8 _excessConfirmations,
  //   address _signatureVerifier,
  //   address _confirmationAggregator,
  //   address _callProxy,
  //   IWETH _weth,
  //   address _feeProxy,
  //   address _defiController
  // )

  let signatureVerifier;
  if (deployInitParams.deploy.SignatureVerifier) {
    signatureVerifier = await deployments.getArtifact('SignatureVerifier');
  }
  let confirmationAggregator;
  if (deployInitParams.deploy.ConfirmationAggregator) {
    confirmationAggregator = await deployments.getArtifact('ConfirmationAggregator');
  }
  const callProxy = await deployments.getArtifact('CallProxy');
  const weth = await getWeth(deployer, network.name);
  const feeProxy = await deployments.getArtifact('FeeProxy');
  const defiController = await deployments.getArtifact('DefiController');

  console.log(feeProxy);


  const DeBridgeGate = await ethers.getContractFactory("DeBridgeGate", deployer);
  const deBridgeGateInstance = await upgrades.deployProxy(DeBridgeGate, [
    deployInitParams.excessConfirmations,
    signatureVerifier ? signatureVerifier.address : ZERO_ADDRESS,
    confirmationAggregator ? confirmationAggregator.address : ZERO_ADDRESS,
    callProxy.address,
    weth.address,
    feeProxy.address,
    defiController.address,
  ]);

  await deBridgeGateInstance.deployed();
  console.log("DeBridgeGate: " + deBridgeGateInstance.address);
  console.log({
    excessConfirmations: deployInitParams.excessConfirmations,
    signatureVerifier: signatureVerifier ? signatureVerifier.address : ZERO_ADDRESS,
    confirmationAggregator: confirmationAggregator ? confirmationAggregator.address : ZERO_ADDRESS,
    callProxy: callProxy.address,
    weth: weth.address,
    feeProxy: feeProxy.address,
    defiController: defiController.address,
  })

  // TODO: call updateChainSupport

  if (deployInitParams.deploy.SignatureVerifier) {
    signatureVerifier.setDebridgeAddress(deBridgeGateInstance.address);
  }
  if (deployInitParams.deploy.ConfirmationAggregator) {
    confirmationAggregator.setDebridgeAddress(deBridgeGateInstance.address);
  }
};

module.exports.tags = ["08_DeBridgeGate"]
// TODO: set dependencies
module.exports.dependencies = ['Token'];
