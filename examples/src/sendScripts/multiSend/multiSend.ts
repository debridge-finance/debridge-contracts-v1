import {AbiItem, toWei} from "web3-utils";
import {Web3RpcUrl} from "../constants";
import Web3 from "web3";
import envVars from "./getTypedEnvVariables";
import {encodeSingle, TransactionType} from "ethers-multisend";
import {getMetaUsdZap} from "./getMetaUsdZap";
import BN from "bn.js";
import {ERC20} from "../../../../typechain-types-web3/ERC20";
import ERC20Json from "@openzeppelin/contracts/build/contracts/ERC20.json"

const {
    DEBRIDGEGATE_ADDRESS,
    SENDER_PRIVATE_KEY,
    CHAIN_ID_TO,
    CHAIN_ID_FROM,
    AMOUNT,
} = envVars;

const usdcAddressOnSending = '0x9362bbef4b8313a8aa9f0c9808b80577aa26b73b';
const deUsdcAddressOnReceiving = '0x1ddcaa4ed761428ae348befc6718bcb12e63bfaa';
const usdtAddressOnReceiving = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';
const multiSendCallOnlyAddress = '0x40A2aCCbd92BCA938b02010E17A5b8929b49130D';
const metaUsdZapAddress = '0x5ab5C56B9db92Ba45a0B46a207286cD83C15C939';
const deUsdcAm3CrvPoolAddress = '0xda43bfd7ecc6835aa6f1761ced30b986a574c0d2';
const deUsdcIdInPool = 0;
const usdtIdInPool = 2;
const oneInchAddress = '0x1111111254fb6c44bAC0beD2854e76F90643097d';

const web3To = new Web3(Web3RpcUrl[CHAIN_ID_TO]);
const sender = web3To.eth.accounts.privateKeyToAccount(SENDER_PRIVATE_KEY).address;
// send USDC from HT, got deUSDC on Polygon
// deBridgeGate.claim ==deUSDC=> callProxy => MultiSendCallOnly =>
// 1. exchange deUSDC to USDT
// 2. approve USDT to 1inch
// 3. !! exchange USDT to MATIC
// 4. !! send to my address
const metaUsdZap = getMetaUsdZap(web3To, metaUsdZapAddress);
const amount = new BN(toWei(AMOUNT));
const minReceivePercents = new BN('0.99');
const amountToReceive = amount.mul(minReceivePercents);
const exchangeDeUsdcToUsdtData =  metaUsdZap.methods.exchange_underlying(
    deUsdcAm3CrvPoolAddress,
    deUsdcIdInPool,
    usdtIdInPool,
    toWei(amount),
    toWei(amountToReceive),
    multiSendCallOnlyAddress,
).encodeABI();
const exchangeDeUsdcToUsdt = encodeSingle({
    type: TransactionType.raw,
    id: '0',
    to: metaUsdZapAddress,
    value: '0',
    data: exchangeDeUsdcToUsdtData,
});

const deUsdc = new web3To.eth.Contract(ERC20Json.abi as AbiItem[], deUsdcAddressOnReceiving) as unknown as ERC20;
const approveDeUsdcToOneInchData = deUsdc.methods.approve(oneInchAddress, amount).encodeABI();
const approveDeUsdcToOneInch = encodeSingle({
    type: TransactionType.raw,
    id: '1',
    to: deUsdcAddressOnReceiving,
    value: '0',
    data: approveDeUsdcToOneInchData,
})

const oneInchAbi =   {
    "inputs": [
        {
            "internalType": "contract IAggregationExecutor",
            "name": "caller",
            "type": "address"
        },
        {
            "components": [
                {
                    "internalType": "contract IERC20",
                    "name": "srcToken",
                    "type": "address"
                },
                {
                    "internalType": "contract IERC20",
                    "name": "dstToken",
                    "type": "address"
                },
                {
                    "internalType": "address payable",
                    "name": "srcReceiver",
                    "type": "address"
                },
                {
                    "internalType": "address payable",
                    "name": "dstReceiver",
                    "type": "address"
                },
                {
                    "internalType": "uint256",
                    "name": "amount",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "minReturnAmount",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "flags",
                    "type": "uint256"
                },
                {
                    "internalType": "bytes",
                    "name": "permit",
                    "type": "bytes"
                }
            ],
            "internalType": "struct AggregationRouterV4.SwapDescription",
            "name": "desc",
            "type": "tuple"
        },
        {
            "internalType": "bytes",
            "name": "data",
            "type": "bytes"
        }
    ],
    "name": "swap",
    "outputs": [
        {
            "internalType": "uint256",
            "name": "returnAmount",
            "type": "uint256"
        },
        {
            "internalType": "uint256",
            "name": "gasLeft",
            "type": "uint256"
        }
    ],
    "stateMutability": "payable",
    "type": "function"
};


// const tx = fetch(urlToGetTxFromOneInch).then(res => res.json()).then(res => res.tx)

//
// const dataToSendToMultiSend =
//
//
// const autoParams = encodeSubmissionAutoParamsTo({
//     executionFee: toWei('0.01'),
//     flags: 0,
//     fallbackAddress: sender,
//     data:
// });
//
// const gateSendArguments: GateSendArguments = {
//     tokenAddress: usdcAddressOnSending,
//     amount: toWei('0.01'), // uint256 _amount,
//     chainIdTo: 137, //uint256 _chainIdTo,
//     receiver: multiSendCallOnlyAddress, // bytes memory _receiver,
//     autoParams: //TODO find where have I added SubmissionAutoParamsTo in ts packer
// }
