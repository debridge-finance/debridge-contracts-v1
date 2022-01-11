import {ethers, upgrades} from "hardhat";
import {Incrementor} from "../../../typechain-types";
import {DE_BRIDGE_GATE_ADDRESS} from "./constants";
import { getImplementationAddress } from '@openzeppelin/upgrades-core';

async function main() {
    const IncrementorFactory = await ethers.getContractFactory("Incrementor");
    const incrementor = await upgrades.deployProxy(IncrementorFactory, [DE_BRIDGE_GATE_ADDRESS]) as Incrementor;
    await incrementor.deployed();
    console.log("incrementorScripts proxy deployed to:", incrementor.address);
    console.log("incrementorScripts implementation deployed to:", await getImplementationAddress(ethers.provider, incrementor.address));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });