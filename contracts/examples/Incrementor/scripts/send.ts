import assert from "assert";
import {ethers, getChainId} from "hardhat";
import {FROM_CHAIN_ID, INCREMENTOR_ADDRESS_ON_FROM, TO_CHAIN_ID} from "./constants";
import {Contract, Wallet} from "ethers";
import {Incrementor} from "../../../../typechain-types";
import {
    abi as IncrementorAbi
} from "../../../../artifacts/contracts/examples/Incrementor/Incrementor.sol/Incrementor.json";
import {parseEther} from "ethers/lib/utils";

const main = async () => {
    assert(await getChainId() === FROM_CHAIN_ID.toString(), `Must be called from chain 'from' (${FROM_CHAIN_ID}), got ${await getChainId()}`);
    const signer = new Wallet(process.env.DEPLOYER_PRIVATE_KEY as string, ethers.provider);

    const incrementorSender = new Contract(INCREMENTOR_ADDRESS_ON_FROM, IncrementorAbi, signer) as Incrementor;

    const executionFee = parseEther('0.01');
    const tx = await incrementorSender.send(TO_CHAIN_ID, signer.address, executionFee, {
        // executionFee + commissions + a little more
        // 0.1 is much more than required
        value: parseEther('0.1'),
    });
    const receipt = await tx.wait();

    // Events position may change in the future, right now the Sent event has an index 1
    const sentEventData = receipt.events![1]?.data as string;
    const debridgeIdLength = 64 + '0x'.length;
    const submissionId = sentEventData.substring(0, debridgeIdLength);
    console.log(`Submission id: ${submissionId}`);
    console.log(`Url: https://testnet-explorer.debridge.finance/explorer?s=${submissionId}`);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });