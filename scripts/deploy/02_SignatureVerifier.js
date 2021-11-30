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

  //TODO: disable for keeping the same nonce
  // if (isDeployed) {
  //   let oracleAddresses = deployInitParams.oracles;
  //   let required = deployInitParams.oracles.map(o => false);

  //   console.log("add non required oracles:");
  //   console.log(deployInitParams.oracles);

  //   // function addOracles(
  //   //   address[] memory _oracles,
  //   //   bool[] memory _required
  //   // )

  //   if (oracleAddresses.length) {
  //     const tx = await signatureVerifierInstance.addOracles(oracleAddresses, required);
  //     await waitTx(tx);
  //   }
  // }
};

module.exports.tags = ["02_SignatureVerifier"]
