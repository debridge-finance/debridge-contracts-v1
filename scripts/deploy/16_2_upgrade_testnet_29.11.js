const { ethers, upgrades } = require("hardhat");
const { deployProxy, upgradeProxy, waitTx } = require("../deploy-utils");

const debridgeInitParams = require("../../assets/debridgeInitParams");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const deployInitParams = debridgeInitParams[network.name];
  if (!deployInitParams) return;

  if (!deployInitParams.treasuryAddress) {
    throw Error('Undefined treasury address!');
  }

  if (deployInitParams.deploy.wethGate && !deployInitParams.external.WETH) {
    throw Error('Undefined WETH address!');
  }


  console.log('*'.repeat(80));
  console.log('\t16_upgrade_testnet_29.11');
  console.log('*'.repeat(80));


  const DEBRIDGE_GATE_ADDRESS = '0x68D936Cb4723BdD38C488FD50514803f96789d2D';
  const CALL_PROXY_ADDRESS = '0xEF3B092e84a2Dbdbaf507DeCF388f7f02eb43669';

  const DebrideGateFactory = await hre.ethers.getContractFactory("DeBridgeGate", deployer);
  const deBridgeGateInstance = await DebrideGateFactory.attach(DEBRIDGE_GATE_ADDRESS);
  let tx;


  // 1. Deploy SimpleFeeProxy
  console.log('1. Deploy SimpleFeeProxy');
  const { contract: simpleFeeProxy, isDeployed } = await deployProxy(
    "SimpleFeeProxy",
    deployer,
    [
      deBridgeGateInstance.address,
      deployInitParams.treasuryAddress,
    ],
    true);

  // 1.1 Set new deployed SimpleFeeProxy in DebridgeGate
  if (isDeployed) {
    console.log(`1.1 Set new deployed SimpleFeeProxy in DebridgeGate - Calling DeBridgeGate.setFeeProxy(${simpleFeeProxy.address})`);
    tx = await deBridgeGateInstance.setFeeProxy(simpleFeeProxy.address);
    await waitTx(tx);
  }

  // 2. Upgrade DebrideGate
  console.log('2. Upgrade DebrideGate');
  const { contract: upgradedDeBridgeGateInstance } = await upgradeProxy(
    "DeBridgeGate",
    DEBRIDGE_GATE_ADDRESS,
    deployer);


  // 2.1 Update getChainFromConfig mapping
  console.log(`2.1 Update getChainFromConfig mapping - Calling DeBridgeGate.updateChainSupport`);
  console.log('chainIds: ', deployInitParams.supportedChains);
  console.log('chainSupportInfo: ', deployInitParams.chainSupportInfo);
  tx = await upgradedDeBridgeGateInstance.updateChainSupport(
    deployInitParams.supportedChains,
    deployInitParams.chainSupportInfo,
    true //_isChainFrom is true for editing getChainFromConfig.
  );
  await waitTx(tx);

  // 3. Upgrade CallProxy
  // Changes:
  // * removed variation variable
  // * added submissionChainIdFrom, submissionNativeSender variables
  console.log('3. Upgrade CallProxy')
  const { contract: callProxy } = await upgradeProxy(
    "CallProxy",
    CALL_PROXY_ADDRESS,
    deployer);

  // 3.1 Set CallProxy in DebridgeGate
  console.log(`3.1 Set CallProxy in DebridgeGate - Calling DeBridgeGate.setCallProxy(${CALL_PROXY_ADDRESS})`)
  tx = await upgradedDeBridgeGateInstance.setCallProxy(CALL_PROXY_ADDRESS);
   // await deBridgeGateInstance.setCallProxy(CALL_PROXY_ADDRESS);
  await waitTx(tx);


  // 4. Deploy WethGate
  if (deployInitParams.deploy.wethGate) {
    console.log('4. Deploy WethGate');
    const WETH = deployInitParams.external.WETH; // || (await deployments.get("MockWeth")).address;
    const wethGate = await deploy("WethGate", {
      from: deployer,
      args: [WETH],
      log: true,
    });

    // 4.1 Set WethGate in DebridgeGate
    console.log(`4.1 Set WethGate in DebridgeGate - Calling DeBridgeGate.setWethGate(${wethGate.address})`);
    tx = await upgradedDeBridgeGateInstance.setWethGate(wethGate.address);
     // deBridgeGateInstance.setWethGate(wethGate.address);
    await waitTx(tx);
  }


  // 5. DeBridgeTokenDeployer
  // Don't upgrade it because WETH deTokens already were deployed.
  // Changes:
  // * added overridedTokens mapping
};

module.exports.tags = ["16_2_upgrade_testnet_29.11"];
