import {ethers, upgrades} from "hardhat";
import {Incrementor} from "../../../../typechain-types";
import {DE_BRIDGE_GATE_ADDRESS} from "./constants";

async function main() {
    const IncrementorFactory = await ethers.getContractFactory("Incrementor");
    const incrementor = await upgrades.deployProxy(IncrementorFactory, [DE_BRIDGE_GATE_ADDRESS]) as Incrementor;
    console.log("Incrementor deployed to:", incrementor.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });