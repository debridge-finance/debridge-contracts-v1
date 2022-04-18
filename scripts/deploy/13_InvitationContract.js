const debridgeInitParams = require("../../assets/debridgeInitParams");
const { deployProxy } = require("../deploy-utils");

module.exports = async function ({ getNamedAccounts, deployments, network }) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const networkName = network.name;
  const deployInitParams = debridgeInitParams[networkName];
  if (!deployInitParams) return;

  //testnet
  //const debridgeGateAddress = "0x68D936Cb4723BdD38C488FD50514803f96789d2D";
  //mainnet
  const debridgeGateAddress = "0x43dE2d77BF8027e25dBD179B491e8d64f38398aA";
  console.log("deBridgeGateInstance", debridgeGateAddress);

  await deploy("InvitationContract", {
    from: deployer,
    args: [debridgeGateAddress],
    // deterministicDeployment: true,
    log: true,
  });
};

module.exports.tags = ["13-InvitationContract"]
