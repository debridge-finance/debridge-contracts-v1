module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log('*'.repeat(80));
  console.log('\t m_421_upgrade');
  console.log('*'.repeat(80));

  // 1. Upgrade DebrideGate
  console.log('1. Deploy new implementation of DeBridgeGate');
  await deploy("DeBridgeGate", {
    from: deployer,
    args: [],
    log: true,
  });
};

module.exports.tags = ["m_421_upgrade"];