const debridgeInitParams = require("../../assets/debridgeInitParams");
const { ethers, upgrades } = require("hardhat");
const { upgradeProxy } = require("../deploy-utils");
const { waitTx } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();
  const networkName = network.name;
  const deployInitParams = debridgeInitParams[networkName];
  if (!deployInitParams) return;

  console.log('*'.repeat(80));
  console.log(`\tAdd oracles`);
  console.log(`\tfrom DEPLOYER ${deployer}`);
  console.log('*'.repeat(80));

  let oracleAddresses = deployInitParams.oracles;
  let required = deployInitParams.oracles.map(o => false);

  console.log("add non required oracles:");
  console.log(deployInitParams.oracles);

  // function addOracles(
  //   address[] memory _oracles,
  //   bool[] memory _required
  // )

  const signatureVerifierFactory = await ethers.getContractFactory("SignatureVerifier", deployer);
  const signatureVerifierInstance = await signatureVerifierFactory.attach("0xDa05C84Ac1c1c62E6d81ba4EB786Fe5F49A801a9");

  if (oracleAddresses.length) {
    const tx = await signatureVerifierInstance.addOracles(oracleAddresses, required);
    await waitTx(tx);
  }
};

module.exports.tags = ["AddOracles"];
module.exports.dependencies = [''];