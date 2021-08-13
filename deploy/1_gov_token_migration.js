module.exports = async function({network, accounts, deployments, getNamedAccounts}) {
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  if (network == "kovan" || network == "mainnet" || network == "test") 
  {
    await deploy("GovToken", {
      from: deployer,
      log: true,
      args:["Debridge token", "DBR", 18, accounts[0], [accounts[0]]]

    })

  }
};

module.exports.tags = ["1_gov_token_migration"]
