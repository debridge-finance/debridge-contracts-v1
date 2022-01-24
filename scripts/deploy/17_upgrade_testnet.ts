import {HardhatRuntimeEnvironment} from "hardhat/types";
import {isKnownNetwork, networks} from "../../assets/debridgeInitParams";
import {ethers, upgrades} from "hardhat";
// @ts-ignore because of module.exports in deploy-utils
import {getLastDeployedProxy, upgradeProxy} from "../deploy-utils";
import {DeBridgeGate, DeBridgeTokenDeployer, Ownable} from "../../typechain-types";

const DEBRIDGE_GATE_ADDRESS_IN_LIVE_NETWORKS = '0x68D936Cb4723BdD38C488FD50514803f96789d2D';
const TAG_NAME = '17_upgrade_testnet';

const func = async function({getNamedAccounts, deployments: {deploy}, network}: HardhatRuntimeEnvironment) {
    if (!isKnownNetwork(network.name)){
        throw Error(`Network "${network.name}" is unknown`);
    }

    const deployInitParams = networks[network.name];

    if (!deployInitParams.treasuryAddress) {
        throw Error('Undefined treasury address');
    }

    if (deployInitParams.deploy.wethGate && !deployInitParams.external.WETH) {
        throw Error('Undefined WETH address');
    }

    const proxyAdmin = await upgrades.admin.getInstance() as Ownable;
    const proxyAdminOwner = await proxyAdmin.owner();
    const { deployer } = await getNamedAccounts();

    if (deployer.toLowerCase() !== proxyAdminOwner.toLowerCase()){
        throw Error(`Deployer must be ProxyAdmin owner (${proxyAdminOwner}), got ${deployer}`);
    }

    console.log(
        '*'.repeat(80),
        `\n\t${TAG_NAME}\n`,
        '*'.repeat(80)
    );

    const deBrideGateFactory = await ethers.getContractFactory("DeBridgeGate", deployer);
    const deBridgeGate = network.live
        ? await deBrideGateFactory.attach(DEBRIDGE_GATE_ADDRESS_IN_LIVE_NETWORKS) as DeBridgeGate
        : await getLastDeployedProxy("DeBridgeGate", deployer) as DeBridgeGate

    const deBridgeTokenDeployerAddress = await deBridgeGate.deBridgeTokenDeployer();
    const deBridgeTokenDeployerFactory = await ethers.getContractFactory("DeBridgeTokenDeployer", deployer);
    const deBridgeTokenDeployer = await deBridgeTokenDeployerFactory.attach(deBridgeTokenDeployerAddress) as DeBridgeTokenDeployer;

    const changedContracts: {name: string, address: string}[] = [
        {name: 'DeBridgeGate', address: deBridgeGate.address,},
        {name: 'CallProxy', address: await deBridgeGate.callProxy(),},
        {name: 'SignatureVerifier', address: await deBridgeGate.signatureVerifier(),},
    ];

    let step: number = 1;
    for (const {name, address} of changedContracts){
        console.log(`${step++}. Upgrade ${name}`);
        await upgradeProxy(name, address, deployer);
    }

    console.log(`${step++}. Upgrade DeBridgeToken`);
    const deBridgeTokenNewImplementation = await deploy('DeBridgeToken', {from: deployer});

    console.log(`${step++}. Set new DeBridgeToken implementation in DeBridgeTokenDeployer`);
    await deBridgeTokenDeployer.setTokenImplementation(deBridgeTokenNewImplementation.address);
};

func.tags = [TAG_NAME];
export default func;
