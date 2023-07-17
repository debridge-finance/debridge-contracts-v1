const debridgeInitParams = require("../../assets/debridgeInitParams");
const { deployProxy, waitTx, getLastDeployedProxy } = require("../deploy-utils");

module.exports = async function ({ getNamedAccounts, deployments, network }) {
  const { deployer } = await getNamedAccounts();
  const networkName = network.name;
  const deployInitParams = debridgeInitParams[networkName];
  if (!deployInitParams) return;

  const wethAddress = deployInitParams.external.WETH || (await deployments.get("MockWeth")).address;
  const deBridgeGateInstance = await getLastDeployedProxy("DeBridgeGate", deployer, [
    deployInitParams.excessConfirmations,
    wethAddress,
  ]);

  const { contract: signatureVerifierInstance, isDeployed } = await deployProxy("SignatureVerifier", deployer, [
    deployInitParams.minConfirmations,
    deployInitParams.confirmationThreshold,
    deployInitParams.excessConfirmations,
    deBridgeGateInstance.address
  ], true);
};

module.exports.tags = ["02_SignatureVerifier"]
