import {Incrementor} from "../../../typechain-types";
import {
    abi as IncrementorAbi
} from "../../../artifacts/contracts/examples/Incrementor.sol/Incrementor.json";
import {Contract, Wallet} from "ethers";
import assert from "assert";
import {ethers, getChainId} from "hardhat";
import {FROM_CHAIN_ID, INCREMENTOR_ADDRESS_ON_FROM, INCREMENTOR_ADDRESS_ON_TO, TO_CHAIN_ID} from "./constants";

const main = async () => {
    assert(await getChainId() === FROM_CHAIN_ID.toString(), `Must be called from chain 'from' (${FROM_CHAIN_ID}), but got ${await getChainId()}`);

    const signer = new Wallet(process.env.DEPLOYER_PRIVATE_KEY as string, ethers.provider);

    const incrementorSender = new Contract(INCREMENTOR_ADDRESS_ON_FROM, IncrementorAbi, signer) as Incrementor;
    await incrementorSender.setContractAddressOnChainId(INCREMENTOR_ADDRESS_ON_TO, TO_CHAIN_ID);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
