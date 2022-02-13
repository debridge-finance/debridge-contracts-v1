const debridgeInitParams = require("../../assets/debridgeInitParams");
const { deployProxy } = require("../deploy-utils");

module.exports = async function ({ getNamedAccounts, deployments, network }) {
  const { deployer } = await getNamedAccounts();
  const networkName = network.name;
  const deployInitParams = debridgeInitParams[networkName];
  if (!deployInitParams) return;

  //TODO: getLastDeployedProxy not working
  // const wethAddress = deployInitParams.external.WETH || (await deployments.get("MockWeth")).address;
  // const deBridgeGateInstance = await getLastDeployedProxy("DeBridgeGate", deployer, [
  //   deployInitParams.excessConfirmations,
  //   wethAddress,
  // ]);

  //testnet
  const debridgeGateAddress = "0x68D936Cb4723BdD38C488FD50514803f96789d2D";
  //mainnet
  // const debridgeGateAddress = "0x43dE2d77BF8027e25dBD179B491e8d64f38398aA";
  console.log("deBridgeGateInstance", debridgeGateAddress);

  await deployProxy("InvitationContract", deployer, [debridgeGateAddress], true);
};

module.exports.tags = ["13-InvitationContract"]
