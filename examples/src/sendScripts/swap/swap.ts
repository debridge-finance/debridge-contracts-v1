import Web3 from "web3";
import DeBridgeGateJson from "../../../../artifacts/contracts/transfers/DeBridgeGate.sol/DeBridgeGate.json";
import ERC20Json from "@openzeppelin/contracts/build/contracts/ERC20.json"
import {AbiItem, toWei, fromWei} from "web3-utils";
import {Web3RpcUrl} from "../constants";
import envVars from './getTypedEnvVariables';
import consoleOptions from './getTypedConsoleArguments';
import {FACTORY_ADDRESS, Fetcher, Percent, Route, Token, TokenAmount, Trade, TradeType, WETH} from "@uniswap/sdk";
import {ERC20} from "../../../../typechain-types-web3/ERC20";
import {DeBridgeGate} from "../../../../typechain-types-web3/DeBridgeGate";
import {AddressZero} from "@ethersproject/constants";
import logger from "./logger";
import {GENERIC_ERROR_CODE} from "./constants";
import UniswapV2Router02Json from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import IUniswapV2FactoryJson from "@uniswap/v2-periphery/build/IUniswapV2Factory.json";
import {UniswapV2Router02} from "../../../../typechain-types-web3/UniswapV2Router02";
import send, {GateSendArguments, TsSendArguments} from "../genericSend";
import {ethers} from "ethers";
import BN from "bn.js";
import {IUniswapV2Factory} from "../../../../typechain-types-web3/IUniswapV2Factory";
import sendERC20 from "../genericSendERC20";

const DEFAULT_EXECUTION_FEE = new BN(toWei('0.01'));
const ether = new BN(toWei('1'));
const zero = new BN('0');

// Just for validation and type parsing, you can use `= process.env`
const {
    DEBRIDGEGATE_ADDRESS,
    SENDER_PRIVATE_KEY,
    ROUTER_ADDRESS
} = envVars;

const {CHAIN_ID_FROM, CHAIN_ID_TO, TOKEN_ADDRESS_FROM, TOKEN_ADDRESS_TO, AMOUNT} = consoleOptions;

const rpcFrom = Web3RpcUrl[CHAIN_ID_FROM]
const web3From = new Web3(rpcFrom);
const deBridgeGateFrom = new web3From.eth.Contract(
    DeBridgeGateJson.abi as AbiItem[],
    DEBRIDGEGATE_ADDRESS
) as unknown as DeBridgeGate;

const rpcTo = Web3RpcUrl[CHAIN_ID_TO]
const web3To = new Web3(rpcTo);
const deBridgeGateTo = new web3To.eth.Contract(
    DeBridgeGateJson.abi as AbiItem[],
    DEBRIDGEGATE_ADDRESS
) as unknown as DeBridgeGate;

async function getDecimalsMultiplierForSentToken() {
    if (TOKEN_ADDRESS_FROM === AddressZero){
        return ether;
    }

    const tokenInstance = new web3From.eth.Contract(ERC20Json.abi as AbiItem[], TOKEN_ADDRESS_FROM) as unknown as ERC20;
    const decimals = new BN(await tokenInstance.methods.decimals().call());
    const ten = new BN('10');

    return ten.pow(decimals);
}

function normalizeToDecimals(bnInWei: BN, decimalsMultiplierForSentToken: BN): BN {
    return bnInWei.mul(decimalsMultiplierForSentToken).div(ether);
}

async function getDebridgeId(
    tokenNativeChainId: number,
    tokenAddressOnNativeChain: string
): Promise<string> {
    const isMainTokenRequested = tokenAddressOnNativeChain === AddressZero;
    const addressToUseForDebridgeId = isMainTokenRequested
        ? await deBridgeGateFrom.methods.weth().call()
        : tokenAddressOnNativeChain;

    logger.info(`Address to use for debridge id`, addressToUseForDebridgeId);

    return deBridgeGateTo.methods.getDebridgeId(tokenNativeChainId, addressToUseForDebridgeId).call();
}

async function getTokenAddressOnToChain(
    fromChainId: keyof typeof Web3RpcUrl,
    tokenAddressOnFromChain: string
) {
    const nativeTokenInfo = await deBridgeGateFrom.methods.getNativeInfo(tokenAddressOnFromChain).call();
    const isNativeToken = TOKEN_ADDRESS_FROM === AddressZero || nativeTokenInfo.nativeChainId === fromChainId.toString();

    const deBridgeId = isNativeToken
        ?  await getDebridgeId(fromChainId, tokenAddressOnFromChain)
        :  await getDebridgeId(parseInt(nativeTokenInfo.nativeChainId), nativeTokenInfo.nativeAddress)

    const deBridgeInfo = await deBridgeGateTo.methods.getDebridge(deBridgeId).call();

    logger.info(`Sending ${isNativeToken ? '' : 'not '}native token`);
    logger.info(`nativeTokenInfo`, nativeTokenInfo);
    logger.info('deBridgeId of sending token', deBridgeId);
    logger.info('deBridgeInfo',deBridgeInfo);

    if (!deBridgeInfo.exist) {
        logger.error(`Token with address ${tokenAddressOnFromChain} does not have debridgeInfo on receiving chain`);
        process.exit(GENERIC_ERROR_CODE);
    }
    return isNativeToken ? deBridgeInfo.tokenAddress : nativeTokenInfo.nativeAddress;
}

async function getUniswapTokenInstanceFromAddress(chainId: number, address: string): Promise<Token> {
    const tokenInstance = new web3To.eth.Contract(ERC20Json.abi as AbiItem[], address) as unknown as ERC20;
    const tokenDecimals = parseInt(
        await tokenInstance.methods.decimals().call()
    );
    return new Token(chainId, address, tokenDecimals);
}

async function getCallToUniswapRouterEncoded(amountToSell: BN, decimalsMultiplierForSentToken: BN): Promise<string> {
    const addressOfFromTokenOnToChain = await getTokenAddressOnToChain(
        CHAIN_ID_FROM,
        TOKEN_ADDRESS_FROM
    );
    const fromTokenOnToChainUniswap = await getUniswapTokenInstanceFromAddress(
        CHAIN_ID_TO,
        addressOfFromTokenOnToChain
    );
    const shouldReceiveNativeToken = TOKEN_ADDRESS_TO === AddressZero;

    const toTokenUniswap =  shouldReceiveNativeToken
        ? WETH[CHAIN_ID_TO]
        : await getUniswapTokenInstanceFromAddress(CHAIN_ID_TO, TOKEN_ADDRESS_TO)
    ;

    const factory =  new web3To.eth.Contract(
        IUniswapV2FactoryJson.abi as AbiItem[],
        FACTORY_ADDRESS
    ) as unknown as IUniswapV2Factory;
    const pairAddress  = await factory.methods.getPair(addressOfFromTokenOnToChain, toTokenUniswap.address).call();
    const isPairMissing = pairAddress === AddressZero;
    if (isPairMissing){
        logger.error('Pair does not exist on receiving chain, please create it first');
        process.exit(GENERIC_ERROR_CODE);
    }

    const pair = await Fetcher.fetchPairData(fromTokenOnToChainUniswap, toTokenUniswap);
    const route = new Route([pair], fromTokenOnToChainUniswap);
    const amountToSellNormalized = normalizeToDecimals(amountToSell, decimalsMultiplierForSentToken);
    const amount = new TokenAmount(fromTokenOnToChainUniswap, amountToSellNormalized.toString());
    const trade = new Trade(route, amount, TradeType.EXACT_INPUT);
    const slippageTolerance = new Percent("300", "10000"); // 300 bips, or 3%
    const deadline = Math.floor(Date.now() / 1000) + 60 * 30; // 30 minutes from the current Unix time

    const router = new web3To.eth.Contract(
        UniswapV2Router02Json.abi as AbiItem[],
        ROUTER_ADDRESS
    ) as unknown as UniswapV2Router02;

    logger.info('Will sell deTokens', trade.inputAmount.toExact());
    logger.info('Will get at least', trade.minimumAmountOut(slippageTolerance).toExact());

    // Same for *forETH and *forTokens
    const swapExactTokensArguments: Parameters<UniswapV2Router02['methods']['swapExactTokensForETH']> = [
        trade.inputAmount.raw.toString(),
        trade.minimumAmountOut(slippageTolerance).raw.toString(),
        [addressOfFromTokenOnToChain, toTokenUniswap.address],
        web3To.eth.accounts.privateKeyToAccount(SENDER_PRIVATE_KEY).address,
        deadline
    ];
    logger.info('Uniswap router call arguments', swapExactTokensArguments);

    return shouldReceiveNativeToken
        ?  router.methods.swapExactTokensForETH(...swapExactTokensArguments).encodeABI()
        :  router.methods.swapExactTokensForTokens(...swapExactTokensArguments).encodeABI()
}

async function getChainFeeForDebridgeId(): Promise<BN> {
    const deBridgeId = await getDebridgeId(CHAIN_ID_FROM, TOKEN_ADDRESS_FROM);
    return new BN(
        await deBridgeGateFrom.methods.getDebridgeChainAssetFixedFee(deBridgeId, CHAIN_ID_TO).call()
    );
}

async function calculateTransferFee(amountWholeBN: BN): Promise<BN> {
    const BPS_DENOMINATOR = new BN(await deBridgeGateFrom.methods.BPS_DENOMINATOR().call());

    const toChainConfig = await deBridgeGateFrom.methods.getChainToConfig(CHAIN_ID_TO).call();
    const globalTransferFeeBps = new BN( await deBridgeGateFrom.methods.globalTransferFeeBps().call() );
    const transferFeeBps = toChainConfig.transferFeeBps === '0'
        ? globalTransferFeeBps
        : new BN(toChainConfig.transferFeeBps);

    return amountWholeBN.mul(transferFeeBps).div(BPS_DENOMINATOR);
}

async function calculateNativeFee(): Promise<BN> {
    const toChainConfig = await deBridgeGateFrom.methods.getChainToConfig(CHAIN_ID_TO).call();
    const globalFixedNativeFee = new BN( await deBridgeGateFrom.methods.globalFixedNativeFee().call() );
    return toChainConfig.transferFeeBps === '0'
        ? globalFixedNativeFee
        : new BN(toChainConfig.transferFeeBps);
}

async function main() {
    const isSendingNativeToken = TOKEN_ADDRESS_FROM === AddressZero;

    if (isSendingNativeToken){
        logger.info('"Token address from" is set to address zero, native token will be used, value will be set to AMOUNT');
    }

    if (TOKEN_ADDRESS_TO === AddressZero) {
        logger.info(`"Token address to" is set to address zero, you will get native token of the receiving chain (id ${CHAIN_ID_TO})`);
    }

    const decimalsMultiplierForSentToken = await getDecimalsMultiplierForSentToken();
    const amountWhole = new BN(toWei(AMOUNT));
    const transferFee = await calculateTransferFee(amountWhole);
    const executionFee = DEFAULT_EXECUTION_FEE;
    const nativeFee = await calculateNativeFee();
    const chainFee = await getChainFeeForDebridgeId();

    const feesToPayInNativeToken = isSendingNativeToken
        ? transferFee.add(executionFee).add(chainFee)
        : nativeFee
    ;
    const feesToPayInSentToken = isSendingNativeToken
        ? feesToPayInNativeToken
        : executionFee.add(transferFee)
    ;
    const amountAfterFee = amountWhole.sub(feesToPayInSentToken);

    if (amountAfterFee.lt(zero)){
        logger.error(`amount (${fromWei(amountWhole)}) is less than fees (${fromWei(feesToPayInSentToken)})`);
        process.exit(GENERIC_ERROR_CODE);
    }

    logger.info('amount whole in sending token', fromWei(amountWhole));
    if (isSendingNativeToken) {
        logger.info('sending token is native token, fees to pay', fromWei(feesToPayInSentToken));
    } else {
        logger.info('fees to pay in native token', fromWei(feesToPayInNativeToken));
        logger.info('fees to pay in sent token', fromWei(feesToPayInSentToken));
    }
    logger.info('sent token left after fees', fromWei(amountAfterFee));

    const autoParamsTo = ['tuple(uint256 executionFee, uint256 flags, bytes fallbackAddress, bytes data)'];
    const callToUniswapRouterEncoded = await getCallToUniswapRouterEncoded(amountAfterFee, decimalsMultiplierForSentToken);
    const autoParams = ethers.utils.defaultAbiCoder.encode(autoParamsTo, [[
        normalizeToDecimals(executionFee, decimalsMultiplierForSentToken).toString(),
        parseInt('100', 2), // set only PROXY_WITH_SENDER flag, see Flags.sol and CallProxy.sol
        web3To.eth.accounts.privateKeyToAccount(SENDER_PRIVATE_KEY).address,
        callToUniswapRouterEncoded,
    ]]);
    logger.info('autoParams', autoParams);
    logger.info('callToUniswapRouterEncoded', callToUniswapRouterEncoded);

    const gateSendArguments: GateSendArguments = {
        tokenAddress: TOKEN_ADDRESS_FROM,
        amount: normalizeToDecimals(amountWhole, decimalsMultiplierForSentToken).toString(),
        chainIdTo: CHAIN_ID_TO,
        receiver: ROUTER_ADDRESS,
        useAssetFee: isSendingNativeToken,
        autoParams,
    }

    const tsSendArguments: TsSendArguments = {
        logger,
        web3: web3From,
        senderPrivateKey: SENDER_PRIVATE_KEY,
        debridgeGateInstance: deBridgeGateFrom,
        debridgeGateAddress: DEBRIDGEGATE_ADDRESS,
        value: isSendingNativeToken ? amountWhole.toString() : feesToPayInNativeToken.toString(),
        gateSendArguments,
    }

    if (isSendingNativeToken) {
        await send(tsSendArguments);
    } else {
        await sendERC20(tsSendArguments);
    }
}

main()
    .catch(e => {
        logger.error('Fail with error:');
        console.error(e);
        process.exit(GENERIC_ERROR_CODE);
    })

