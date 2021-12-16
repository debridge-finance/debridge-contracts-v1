const debridgeInitParams = require("../../assets/debridgeInitParams");
const { getLastDeployedProxy, waitTx } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();
  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  console.log("Start 07_DeBridgeTokenDeployerSetup");

  // --------------------------------
  //    setup DeBridgeTokenDeployer
  // --------------------------------

  const wethAddress = deployInitParams.external.WETH || (await deployments.get("MockWeth")).address;
  const deBridgeGateInstance = await getLastDeployedProxy("DeBridgeGate", deployer, [
    deployInitParams.excessConfirmations,
    wethAddress,
  ]);
  console.log("deBridgeGateInstance ", deBridgeGateInstance.address);
  const deBridgeTokenDeployer = await getLastDeployedProxy("DeBridgeTokenDeployer", deployer);

  const overridedTokens = debridgeInitParams.overridedTokens;
  const overridedTokensInfo = debridgeInitParams.overridedTokensInfo;

  console.log("overridedTokens ",  overridedTokens);
  console.log("overridedTokensInfo ",  overridedTokensInfo);
  console.log("Calculating debridgeId");
  let debridgeIds = [];

  for (let item of overridedTokens){
    //getDebridgeId(uint256 _chainId, address _tokenAddress)
    const debridgeId = await deBridgeGateInstance.getDebridgeId(item.chainId, item.address);
    console.log(`chainId: ${item.chainId} tokenAddress: ${item.address} debrigeId: ${debridgeId}`);
    debridgeIds.push(debridgeId);
  }

  tx = await deBridgeTokenDeployer.setOverridedTokenInfo(
    debridgeIds,
    overridedTokensInfo
  );

  await waitTx(tx);

  console.log("Checks");
  for (let debridgeId of debridgeIds){
    //getDebridgeId(uint256 _chainId, address _tokenAddress)
    const item = await deBridgeTokenDeployer.overridedTokens(debridgeId);
    console.log(`debridgeId: ${debridgeId} `, item);
  }
};

module.exports.tags = ["07_DeBridgeTokenDeployerSetup"]
module.exports.dependencies = [
  '01-0_DeBridgeGate',
  '01-2_DeBridgeTokenDeployer',
];
