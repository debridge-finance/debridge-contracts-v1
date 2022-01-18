import Web3 from "web3";
import DeBridgeGateJson from "../../../artifacts/contracts/transfers/DeBridgeGate.sol/DeBridgeGate.json";

import log4js from "log4js";
import {AbiItem, toWei} from "web3-utils";
import {log4jsConfig, Web3RpcUrl} from "./constants";
import "./parseDotEnvs";
import {GateSendArguments, TsSendArguments} from "./genericSend";
import {DeBridgeGate} from "../../../typechain-types-web3/DeBridgeGate";
import sendERC20 from "./genericSendERC20";


log4js.configure(log4jsConfig);
const logger = log4js.getLogger('sendERC20');

const chainIdFrom = parseInt(process.env.CHAIN_ID_FROM || '');
const chainIdTo = parseInt(process.env.CHAIN_ID_TO || '');
const amount = process.env.AMOUNT as string;
const rpc = Web3RpcUrl[chainIdFrom as unknown as keyof typeof Web3RpcUrl];
const web3 = new Web3(rpc);
const debridgeGateAddress = process.env.DEBRIDGEGATE_ADDRESS as string;
const debridgeGateInstance = new web3.eth.Contract(DeBridgeGateJson.abi as AbiItem[], debridgeGateAddress) as unknown as DeBridgeGate;

const senderPrivateKey = process.env.SENDER_PRIVATE_KEY as string;
const account = web3.eth.accounts.privateKeyToAccount(senderPrivateKey);
const senderAddress = account.address;

logger.info(`ChainId from: ${chainIdFrom}`);
logger.info(`ChainId to: ${chainIdTo}`);
logger.info(`Amount: ${amount}`);
logger.info(`RPC : ${rpc}`);
logger.info(`senderAddress : ${senderAddress}`);

const gateSendArguments: GateSendArguments = {
    tokenAddress: process.env.TOKEN_ADDRESS as string,
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
sendERC20(tsSendArguments).catch(e => logger.error(e));
