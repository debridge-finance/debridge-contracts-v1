import {Incrementor} from "../../../typechain-types";
import {abi as IncrementorAbi} from "../../../artifacts/contracts/examples/Incrementor.sol/Incrementor.json";
import {Contract, Wallet} from "ethers";
import {ethers, getChainId} from "hardhat";
import assert from "assert";
import {FROM_CHAIN_ID, INCREMENTOR_ADDRESS_ON_FROM, INCREMENTOR_ADDRESS_ON_TO, TO_CHAIN_ID} from "./constants";

const main = async () => {
    assert(await getChainId() === TO_CHAIN_ID.toString(), `Must be called from chain 'to' (${TO_CHAIN_ID}), but got ${await getChainId()}`);

    const signer = new Wallet(process.env.DEPLOYER_PRIVATE_KEY as string, ethers.provider);

    const incrementorReceiver = new Contract(INCREMENTOR_ADDRESS_ON_TO, IncrementorAbi, signer) as Incrementor;
    if (await incrementorReceiver.isAddressFromChainIdControlling(FROM_CHAIN_ID, INCREMENTOR_ADDRESS_ON_FROM)){
        console.log('The address is already controlling');
        return;
    }
    await incrementorReceiver.addControllingAddress(INCREMENTOR_ADDRESS_ON_FROM, FROM_CHAIN_ID);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
