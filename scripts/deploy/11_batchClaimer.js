
module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();

  console.log('*'.repeat(80));
  console.log(`\tStart deploy batch claimer`);
  console.log(`\tfrom DEPLOYER ${deployer}`);
  console.log('*'.repeat(80));

  const deBridgeGate = await getLastDeployedProxy("DeBridgeGate", deployer);
  await deployProxy("Claimer", deployer, deBridgeGate.address, true);
};

module.exports.tags = ["11_batchClaimer"];
module.exports.dependencies = ['08_DeBridgeGate'];
