import send, {TsSendArguments} from "./genericSend";
import {AbiItem, fromWei, toWei} from "web3-utils";
import {IERC20} from "../../../typechain-types-web3/IERC20";
import BN from "bn.js";
import {MaxUint256} from "@ethersproject/constants";
import IERC20Json from "@openzeppelin/contracts/build/contracts/IERC20.json"

export default async function sendERC20(args: TsSendArguments) {
    const {logger, web3, gateSendArguments: {tokenAddress, amount}, senderPrivateKey, debridgeGateAddress} = args;
    const account = web3.eth.accounts.privateKeyToAccount(senderPrivateKey);
    const senderAddress =  account.address;
    const tokenInstance = new web3.eth.Contract(IERC20Json.abi as AbiItem[], tokenAddress) as unknown as IERC20;

    async function getAllowance(): Promise<BN> {
        const allowanceString = await tokenInstance.methods.allowance(senderAddress, debridgeGateAddress).call();
        return new BN(allowanceString);
    }
    async function approve(newAllowance: string) {
        logger.info(`Approving token ${tokenAddress}, amount: ${newAllowance.toString()}`);
        const nonce = await web3.eth.getTransactionCount(senderAddress);
        logger.info("Approve nonce current", nonce);
        const gasPrice = await web3.eth.getGasPrice();
        logger.info("Approve gasPrice", gasPrice.toString());

        const approveMethod = await tokenInstance.methods.approve(
            debridgeGateAddress,
            toWei(amount)
        )
        // sometimes gas estimation is lower than real
        const estimatedGas = (await approveMethod.estimateGas({from: senderAddress})) * 2;
        logger.info("Approve estimateGas", estimatedGas.toString());

        const tx = {
            from: senderAddress,
            to: tokenAddress,
            gas: estimatedGas,
            value: 0,
            gasPrice,
            nonce,
            data: tokenInstance.methods.approve(debridgeGateAddress, newAllowance).encodeABI(),
        };

        logger.info("Approve tx", tx);
        const signedTx = await web3.eth.accounts.signTransaction(tx, senderPrivateKey);
        logger.info("Approve signed tx", signedTx);

        let result = await web3.eth.sendSignedTransaction(signedTx.rawTransaction as string);
        logger.info("Approve result", result);
    }

    const allowance = await getAllowance();
    logger.info('Allowance', fromWei(allowance));
    const amountBn = new BN(amount);
    if (allowance.lt(amountBn)){
        logger.info(`Insufficient allowance ${allowance.toString()} for token ${tokenAddress}, calling approve`);
        await approve(MaxUint256.toHexString());
    }
    await send(args);
}
