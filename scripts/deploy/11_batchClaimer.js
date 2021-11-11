
const { FLAGS, deployProxy, getLastDeployedProxy, waitTx } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();

  console.log('*'.repeat(80));
  console.log(`\tStart deploy batch claimer`);
  console.log(`\tfrom DEPLOYER ${deployer}`);
  console.log('*'.repeat(80));

  //No deployed proxy found for "DeBridgeGate"
  const deBridgeGate = await getLastDeployedProxy("DeBridgeGate", deployer);
  await deployProxy("Claimer", deployer,
  //["0x68d936cb4723bdd38c488fd50514803f96789d2d"],
  [deBridgeGate.address],
  true);
};

module.exports.tags = ["11_batchClaimer"];
module.exports.dependencies = [];// ['08_DeBridgeGate'];
