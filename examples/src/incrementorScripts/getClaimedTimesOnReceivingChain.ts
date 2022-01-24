import {ethers, getChainId} from "hardhat";
import {INCREMENTOR_ADDRESS_ON_TO, TO_CHAIN_ID} from "./constants";
import {Contract, Wallet} from "ethers";
import {Incrementor} from "../../../typechain-types";
import {
    abi as IncrementorAbi
} from "../../../artifacts/contracts/examples/Incrementor.sol/Incrementor.json";
import assert from "assert";

const main = async () => {
    assert(await getChainId() === TO_CHAIN_ID.toString(), `Must be called from chain 'to' (${TO_CHAIN_ID}), but got ${await getChainId()}`);

    const signer = new Wallet(process.env.DEPLOYER_PRIVATE_KEY as string, ethers.provider);
    const incrementorTo = new Contract(INCREMENTOR_ADDRESS_ON_TO, IncrementorAbi, signer) as Incrementor;
    const claimedTimes = (await incrementorTo.claimedTimes()).toNumber();
    console.log(`claimedTimes: ${claimedTimes}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });