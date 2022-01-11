import assert from "assert";
import {ethers, getChainId} from "hardhat";
import {FROM_CHAIN_ID, INCREMENTOR_ADDRESS_ON_FROM, TO_CHAIN_ID} from "./constants";
import {Contract, ContractReceipt, utils, Wallet} from "ethers";
import {Incrementor} from "../../../typechain-types";
import {
    abi as IncrementorAbi
} from "../../../artifacts/contracts/examples/Incrementor.sol/Incrementor.json";
import {
    abi as DeBridgeGateAbi
} from "../../../artifacts/contracts/examples/forkedInterfaces/IDeBridgeGate.sol/IDeBridgeGate.json";
import {parseEther} from "ethers/lib/utils";
import {IDeBridgeGateInterface} from "../../../typechain-types/IDeBridgeGate";
import {Log} from "hardhat-deploy/dist/types";
import {LogDescription} from "@ethersproject/abi";

const main = async () => {
    assert(await getChainId() === FROM_CHAIN_ID.toString(), `Must be called from chain 'from' (${FROM_CHAIN_ID}), got ${await getChainId()}`);
    const signer = new Wallet(process.env.DEPLOYER_PRIVATE_KEY as string, ethers.provider);

    const incrementorSender = new Contract(INCREMENTOR_ADDRESS_ON_FROM, IncrementorAbi, signer) as Incrementor;

    const executionFee = parseEther('0.01');
    const tx = await incrementorSender.send(TO_CHAIN_ID, signer.address, executionFee, {
        // executionFee + commissions + a little more
        // ~0,1% + 0.01
        value: parseEther('0.021'),
    });
    const receipt = await tx.wait();

    const sentLogDescription = await getSentEvent(receipt);
    const {submissionId} = sentLogDescription.args;

    console.log(`Submission id: ${submissionId}`);
    console.log(`Url: https://testnet.debridge.finance/transaction?tx=${tx.hash}&chainId=${FROM_CHAIN_ID}`);

}

async function getSentEvent(receipt: ContractReceipt): Promise<LogDescription> {
    const deBridgeGateInterface = new utils.Interface(DeBridgeGateAbi) as IDeBridgeGateInterface;
    const toLogDescription = (log: Log): LogDescription | null => {
        try {
            return deBridgeGateInterface.parseLog(log);
        } catch (e) {
            return null;
        }
    };
    const isNotNull = (x: unknown) => x !== null;
    const logDescriptions = receipt.logs.map(toLogDescription).filter(isNotNull) as LogDescription[];

    const sentEvent = logDescriptions.find(({name}) => name === 'Sent');
    assert(typeof sentEvent !== 'undefined', 'Sent event is not found');
    return sentEvent;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });