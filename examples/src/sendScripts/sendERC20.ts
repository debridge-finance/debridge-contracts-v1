import Web3 from "web3";
import DeBridgeGateJson from "../../../artifacts/contracts/transfers/DeBridgeGate.sol/DeBridgeGate.json";
import IERC20Json from "@openzeppelin/contracts/build/contracts/IERC20.json"
import log4js from "log4js";
import {AbiItem, toWei} from "web3-utils";
import {log4jsConfig, Web3RpcUrl} from "./constants";
import "./parseDotEnvs";
import send, {GateSendArguments, TsSendArguments} from "./genericSend";
import {IERC20} from "../../../typechain-types-web3/IERC20";
import BN from "bn.js";
import {MaxUint256} from "@ethersproject/constants";
import {DeBridgeGate} from "../../../typechain-types-web3/DeBridgeGate";

const UINT_MAX_VALUE = MaxUint256.toHexString();

log4js.configure(log4jsConfig);
const logger = log4js.getLogger('sendERC20');


const tokenAddress = process.env.TOKEN_ADDRESS as string;
const chainIdFrom = parseInt(process.env.CHAIN_ID_FROM || '');
const chainIdTo = parseInt(process.env.CHAIN_ID_TO || '');
const amount = process.env.AMOUNT as string;
const rpc = Web3RpcUrl[chainIdFrom as unknown as keyof typeof Web3RpcUrl];
const web3 = new Web3(rpc);
const debridgeGateAddress = process.env.DEBRIDGEGATE_ADDRESS as string;
const debridgeGateInstance = new web3.eth.Contract(DeBridgeGateJson.abi as AbiItem[], debridgeGateAddress) as unknown as DeBridgeGate;
const tokenInstance = new web3.eth.Contract(IERC20Json.abi as AbiItem[], tokenAddress) as unknown as IERC20;

const senderPrivateKey = process.env.SENDER_PRIVATE_KEY as string;
const account = web3.eth.accounts.privateKeyToAccount(senderPrivateKey);
const senderAddress =  account.address;

logger.info(`ChainId from: ${chainIdFrom}`);
logger.info(`ChainId to: ${chainIdTo}`);
logger.info(`Amount: ${amount}`);
logger.info(`RPC : ${rpc}`);
logger.info(`senderAddress : ${senderAddress}`);

const gateSendArguments: GateSendArguments = {
    tokenAddress,
    amount: toWei(amount),
    chainIdTo,
    receiver: senderAddress,
}
const value = toWei("0.01");
const tsSendArguments: TsSendArguments = {
    logger,
    web3,
    senderPrivateKey,
    debridgeGateInstance,
    debridgeGateAddress,
    value,
    gateSendArguments,
};

export async function sendERC20(args: TsSendArguments) {
    const allowance = await getAllowance();
    const amountBn = new BN(args.gateSendArguments.amount);
    if (allowance.lt(amountBn)){
        logger.info(`Insufficient allowance ${allowance.toString()} for token ${tokenAddress}, calling approve`);
        await approve(UINT_MAX_VALUE);
    }
    await send(args);
}

sendERC20(tsSendArguments).catch(e => logger.error(e));

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
