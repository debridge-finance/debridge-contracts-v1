// @ts-nocheck TODO remove and fix
import DeBridgeGateJson from "../../../../test-send-method/precompiles/DeBridgeGate.json";
import log4js from "log4js";
import web3Utils from "web3-utils";
import Web3 from "web3";
import {log4jsConfig, Web3RpcUrl} from "./constants";
const {toWei} = web3Utils;
import "./parseDotEnvs";

log4js.configure(log4jsConfig);

const logger = log4js.getLogger('sendETH');
const chainIdFrom = process.env.CHAIN_ID_FROM;
const chainIdTo = process.env.CHAIN_ID_TO;
const amount = process.env.AMOUNT;
const rpc = Web3RpcUrl[chainIdFrom];
const web3 = new Web3(rpc);
const debridgeGateAddress = process.env.DEBRIDGEGATE_ADDRESS;
const debridgeGateInstance = new web3.eth.Contract(DeBridgeGateJson.abi, debridgeGateAddress);

const privKey = process.env.SENDER_PRIVATE_KEY;
const account = web3.eth.accounts.privateKeyToAccount(privKey);
const senderAddress = account.address;

logger.info(`ChainId from: ${chainIdFrom}`);
logger.info(`ChainId to: ${chainIdTo}`);
logger.info(`Amount: ${amount}`);
logger.info(`RPC : ${rpc}`);
logger.info(`senderAddress : ${senderAddress}`);

send(
    toWei(amount), // native amount for transfer
    "0x0000000000000000000000000000000000000000",//address _tokenAddress,
    toWei(amount), // token _amount
    chainIdTo,// _chainIdTo
    senderAddress, //_receiver
    "0x", // _permit
    false, //_useAssetFee
    0, //_referralCode
    "0x" //_autoParams
).catch(e => logger.error(e))


async function send(
    nativeAmount, // native amount for transfer
    tokenAddress, //address _tokenAddress,
    amount, // uint256 _amount,
    chainIdTo, //uint256 _chainIdTo,
    receiver, // bytes memory _receiver,
    permit, //bytes memory _permit,
    useAssetFee, //bool _useAssetFee,
    referralCode, //uint32 _referralCode,
    autoParams// bytes calldata _autoParams
) {
    logger.info("Test send");
    const nonce = await web3.eth.getTransactionCount(senderAddress);
    logger.info("Nonce current", nonce);
    const gasPrice = await web3.eth.getGasPrice();
    logger.info("gasPrice", gasPrice.toString());
    logger.info({
        tokenAddress, //address _tokenAddress,
        amount, // uint256 _amount,
        chainIdTo, //uint256 _chainIdTo,
        receiver, // bytes memory _receiver,
        permit, //bytes memory _permit,
        useAssetFee, //bool _useAssetFee,
        referralCode, //uint32 _referralCode,
        autoParams// bytes calldata _autoParams
    });

    const estimateGas = await debridgeGateInstance.methods
        .send(
            tokenAddress, //address _tokenAddress,
            amount, // uint256 _amount,
            chainIdTo, //uint256 _chainIdTo,
            receiver, // bytes memory _receiver,
            permit, //bytes memory _permit,
            useAssetFee, //bool _useAssetFee,
            referralCode, //uint32 _referralCode,
            autoParams// bytes calldata _autoParams
        )
        .estimateGas({
            from: senderAddress,
            value: nativeAmount
        });

    logger.info("estimateGas", estimateGas.toString());

    const tx =
        {
            from: senderAddress,
            to: debridgeGateAddress,
            gas: 300000,
            value: nativeAmount,
            gasPrice: gasPrice,
            nonce,
            data: debridgeGateInstance.methods
                .send(
                    tokenAddress, //address _tokenAddress,
                    amount, // uint256 _amount,
                    chainIdTo, //uint256 _chainIdTo,
                    receiver, // bytes memory _receiver,
                    permit, //bytes memory _permit,
                    useAssetFee, //bool _useAssetFee,
                    referralCode, //uint32 _referralCode,
                    autoParams// bytes calldata _autoParams
                )
                .encodeABI(),
        };

    logger.info("Tx", tx);
    const signedTx = await web3.eth.accounts.signTransaction(tx, privKey);
    logger.info("Signed tx", signedTx);

    const result = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    logger.info("Result", result);
    const logs = result.logs.find(l => l.address === debridgeGateAddress);
    const submissionId = logs.data.substring(0, 66);
    logger.info(`SUBMISSION ID ${submissionId}`);
    logger.info("Success");
}