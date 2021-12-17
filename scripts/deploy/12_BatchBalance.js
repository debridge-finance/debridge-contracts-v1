module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  await deploy("BatchBalance", {
    from: deployer,
    log: true,
    waitConfirmations: 1,
  });
};

module.exports.tags = ["12_BatchBalance"]
