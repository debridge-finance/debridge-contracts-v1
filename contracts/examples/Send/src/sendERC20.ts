// @ts-nocheck TODO remove and fix
import Web3 from "web3";
import DeBridgeGateJson from "../../../../../test-send-method/precompiles/DeBridgeGate.json";
import IERC20Json from "@openzeppelin/contracts/build/contracts/IERC20.json"
import log4js from "log4js";
import {toWei} from "web3-utils";
import {log4jsConfig, Web3RpcUrl} from "./constants";
const UINT_MAX_VALUE = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
import "./parseDotEnvs";

log4js.configure(log4jsConfig);

const logger = log4js.getLogger('sendERC20');


const tokenAddress = process.env.TOKEN_ADDRESS;
const chainIdFrom = process.env.CHAIN_ID_FROM;
const chainIdTo = process.env.CHAIN_ID_TO;
const amount = process.env.AMOUNT;
const rpc = Web3RpcUrl[chainIdFrom];
const web3 = new Web3(rpc);
const debridgeGateAddress = process.env.DEBRIDGEGATE_ADDRESS;
const debridgeGateInstance = new web3.eth.Contract(DeBridgeGateJson.abi, debridgeGateAddress);
const tokenInstance = new web3.eth.Contract(IERC20Json.abi, tokenAddress);

const privKey = process.env.PRIVATE_KEY;
const account = web3.eth.accounts.privateKeyToAccount(privKey);
const senderAddress =  account.address;

logger.info(`ChainId from: ${chainIdFrom}`);
logger.info(`ChainId to: ${chainIdTo}`);
logger.info(`Amount: ${amount}`);
logger.info(`RPC : ${rpc}`);
logger.info(`senderAddress : ${senderAddress}`);

const main = async () => {
    const allowance = await getAllowance();
    if (allowance < toWei(amount)){
        logger.info(`Insufficient allowance ${allowance} for token ${tokenAddress}, calling approve`);
        await approve(UINT_MAX_VALUE);
    }
    await send(
        toWei("0.01"), // fix fee for transfer
        tokenAddress,//address _tokenAddress,
        toWei(amount), // token _amount
        chainIdTo,// _chainIdTo
        senderAddress, //_receiver
        "0x", // _permit
        false, //_useAssetFee
        0, //_referralCode
        "0x" //_autoParams
    );
}

main().catch(e => logger.error(e));

async function getAllowance() {
    const allowanceString = await tokenInstance.methods.allowance(senderAddress, debridgeGateAddress).call();
    return parseInt(allowanceString);
}

async function approve(newAllowance) {
    logger.info(`Approving token ${tokenAddress}, amount: ${newAllowance}`);
    const nonce = await web3.eth.getTransactionCount(senderAddress);
    logger.info("Approve nonce current", nonce);
    const gasPrice = await web3.eth.getGasPrice();
    logger.info("Approve gasPrice", gasPrice.toString());

    let estimateGas = await tokenInstance.methods
        .approve(debridgeGateAddress, toWei(amount))
        .estimateGas({from: senderAddress})
    ;
    // sometimes not enough estimateGas
    estimateGas = estimateGas*2;
    logger.info("Approve estimateGas", estimateGas.toString());

    const tx = {
            from: senderAddress,
            to: tokenAddress,
            gas: estimateGas,
            value: 0,
            gasPrice,
            nonce,
            data: tokenInstance.methods.approve(debridgeGateAddress, newAllowance).encodeABI(),
        };

    logger.info("Approve tx", tx);
    const signedTx = await web3.eth.accounts.signTransaction(tx, privKey);
    logger.info("Approve signed tx", signedTx);

    let result = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    logger.info("Approve result", result);
}

async function send(
    fixNativeFee, // fix fee for transfer
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
    logger.info("Send nonce current", nonce);
    const gasPrice = await web3.eth.getGasPrice();
    logger.info("Send gasPrice", gasPrice.toString());
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
            value: fixNativeFee
        });

    logger.info("Send estimateGas", estimateGas.toString());

    const tx =
    {
        from: senderAddress,
        to: debridgeGateAddress,
        gas: estimateGas,
        value: fixNativeFee,
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

    logger.info("Send tx", tx);
    const signedTx = await web3.eth.accounts.signTransaction(tx, privKey);
    logger.info("Send signed tx", signedTx);

    let result = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    logger.info("Send result", result);

    const logs = result.logs.find(l=>l.address===debridgeGateAddress);
    const submissionId = logs.data.substring(0, 66);
    logger.info(`SUBMISSION ID ${submissionId}`);
    logger.info("Success");
}