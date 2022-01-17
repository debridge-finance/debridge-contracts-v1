import Web3 from "web3";
import DeBridgeGateJson from "../../../../artifacts/contracts/transfers/DeBridgeGate.sol/DeBridgeGate.json";
import ERC20Json from "@openzeppelin/contracts/build/contracts/ERC20.json"
import {AbiItem, toWei, fromWei} from "web3-utils";
import {Web3RpcUrl} from "../constants";
import envVars from './getTypedEnvVariables';
import consoleOptions from './getTypedConsoleArguments';
import {Fetcher, Percent, Route, Token, TokenAmount, Trade, TradeType, WETH} from "@uniswap/sdk";
import {ERC20} from "../../../../typechain-types-web3/ERC20";
import {DeBridgeGate} from "../../../../typechain-types-web3/DeBridgeGate";
import {AddressZero} from "@ethersproject/constants";
import logger from "./logger";
import {GENERIC_ERROR_CODE} from "./constants";
import UniswapV2Router02Json from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import {UniswapV2Router02} from "../../../../typechain-types-web3/UniswapV2Router02";
import send, {GateSendArguments} from "../genericSend";
import {ethers} from "ethers";
import BN from "bn.js";

const DEFAULT_EXECUTION_FEE = new BN(toWei('0.01'));

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

async function getDebridgeId(
    tokenNativeChainId: keyof typeof Web3RpcUrl,
    tokenAddressOnNativeChain: string
): Promise<string> {
    const isNativeTokenRequested = tokenAddressOnNativeChain === AddressZero;
    const addressToUseForDebridgeId = isNativeTokenRequested
        ? await deBridgeGateFrom.methods.weth().call()
        : tokenAddressOnNativeChain;

    return deBridgeGateTo.methods.getDebridgeId(tokenNativeChainId, addressToUseForDebridgeId).call();
}

async function getDebridgeTokenAddressOnToChain(
    tokenNativeChainId: keyof typeof Web3RpcUrl,
    tokenAddressOnNativeChain: string
) {
    const deBridgeId = await getDebridgeId(tokenNativeChainId, tokenAddressOnNativeChain);
    const deBridgeInfo = await deBridgeGateTo.methods.getDebridge(deBridgeId).call();
    if (!deBridgeInfo.exist) {
        logger.error(`Token with address ${tokenAddressOnNativeChain} does not have debridgeInfo on receiving chain`);
        process.exit(GENERIC_ERROR_CODE);
    }
    return deBridgeInfo.tokenAddress;
}

async function getUniswapTokenInstanceFromAddress(chainId: number, address: string): Promise<Token> {
    const tokenInstance = new web3To.eth.Contract(ERC20Json.abi as AbiItem[], address) as unknown as ERC20;
    const tokenDecimals = parseInt(
        await tokenInstance.methods.decimals().call()
    );
    return new Token(chainId, address, tokenDecimals);
}

async function getCallToUniswapRouterEncoded(amountToSell: string): Promise<string> {
    const deTokenOfFromTokenOnToChainAddress = await getDebridgeTokenAddressOnToChain(
        CHAIN_ID_FROM,
        TOKEN_ADDRESS_FROM
    );
    const deTokenOfFromTokenOnToChainUniswap = await getUniswapTokenInstanceFromAddress(
        CHAIN_ID_TO,
        deTokenOfFromTokenOnToChainAddress
    );

    const shouldReceiveNativeToken = TOKEN_ADDRESS_TO === AddressZero;

    const toTokenUniswap =  shouldReceiveNativeToken
        ? WETH[CHAIN_ID_TO]
        : await getUniswapTokenInstanceFromAddress(CHAIN_ID_TO, TOKEN_ADDRESS_TO)
    ;

    const pair = await Fetcher.fetchPairData(deTokenOfFromTokenOnToChainUniswap, toTokenUniswap);
    const route = new Route([pair], deTokenOfFromTokenOnToChainUniswap);
    const amount = new TokenAmount(deTokenOfFromTokenOnToChainUniswap, amountToSell);
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
        toWei(trade.inputAmount.toExact()),
        toWei(trade.minimumAmountOut(slippageTolerance).toExact()),
        [deTokenOfFromTokenOnToChainAddress, toTokenUniswap.address],
        web3To.eth.accounts.privateKeyToAccount(SENDER_PRIVATE_KEY).address,
        deadline
    ];

    return shouldReceiveNativeToken
        ?  router.methods.swapExactTokensForETH(...swapExactTokensArguments).encodeABI()
        :  router.methods.swapExactTokensForTokens(...swapExactTokensArguments).encodeABI()
}

async function calculateTotalFeesWithoutExecutionFees(amountWholeBN: BN): Promise<BN> {
    const BPS_DENOMINATOR = new BN(await deBridgeGateFrom.methods.BPS_DENOMINATOR().call());

    const toChainConfig = await deBridgeGateFrom.methods.getChainToConfig(CHAIN_ID_TO).call();
    const globalTransferFeeBps = new BN( await deBridgeGateFrom.methods.globalTransferFeeBps().call() );
    const transferFeeBps = toChainConfig.transferFeeBps === '0'
        ? globalTransferFeeBps
        : new BN(toChainConfig.transferFeeBps);
    const transferFee = amountWholeBN.mul(transferFeeBps).div(BPS_DENOMINATOR);

    const deBridgeId = await getDebridgeId(CHAIN_ID_FROM, TOKEN_ADDRESS_FROM);
    const debridgeChainAssetFixedFee = new BN(
        await deBridgeGateFrom.methods.getDebridgeChainAssetFixedFee(deBridgeId, CHAIN_ID_TO).call()
    );
    return  transferFee.add(debridgeChainAssetFixedFee);
}

async function main() {
    if (TOKEN_ADDRESS_FROM === AddressZero) {
        logger.info('"Token address from" is set to address zero, native token will be used, value will be set to AMOUNT');
    } else {
        logger.error('"Token address from" is NOT set to address zero, non-native tokens are not supported yet, set TOKEN_ADDRESS_FROM to address zero to use this example');
    }

    if (TOKEN_ADDRESS_TO === AddressZero) {
        logger.info(`"Token address to" is set to address zero, you will get native token of the receiving chain (id ${CHAIN_ID_TO})`);
    }

    const amountWhole = new BN(toWei(AMOUNT));
    const totalFeeWithoutExecution = await calculateTotalFeesWithoutExecutionFees(amountWhole);
    const executionFee = DEFAULT_EXECUTION_FEE;
    const totalFees = totalFeeWithoutExecution.add(executionFee);
    const amountAfterFee = amountWhole.sub(totalFees);

    logger.info('amount whole', fromWei(amountWhole));
    logger.info('total fee without execution', fromWei(totalFeeWithoutExecution));
    logger.info('execution fee ', fromWei(executionFee));
    logger.info('total fee ', fromWei(totalFees));
    logger.info('left after fees', fromWei(amountAfterFee));

    const autoParamsTo = ['tuple(uint256 executionFee, uint256 flags, bytes fallbackAddress, bytes data)'];
    const callToUniswapRouterEncoded = await getCallToUniswapRouterEncoded(amountAfterFee.toString());
    const autoParams = ethers.utils.defaultAbiCoder.encode(autoParamsTo, [[
        executionFee.toString(),
        parseInt('100', 2), // set only PROXY_WITH_SENDER flag, see Flags.sol and CallProxy.sol
        web3To.eth.accounts.privateKeyToAccount(SENDER_PRIVATE_KEY).address,
        callToUniswapRouterEncoded,
    ]]);
    logger.info('autoParams', autoParams);
    logger.info('callToUniswapRouterEncoded', callToUniswapRouterEncoded);

    const gateSendArguments: GateSendArguments = {
        tokenAddress: TOKEN_ADDRESS_FROM,
        amount: amountWhole.toString(),
        chainIdTo: CHAIN_ID_TO,
        receiver: ROUTER_ADDRESS,
        useAssetFee: true,
        autoParams,
    }

    await send({
        logger,
        web3: web3From,
        senderPrivateKey: SENDER_PRIVATE_KEY,
        debridgeGateInstance: deBridgeGateFrom,
        debridgeGateAddress: DEBRIDGEGATE_ADDRESS,
        value: amountWhole.toString(),
        gateSendArguments,
    });
}

main()
    .catch(e => {
        logger.error('Fail with error:');
        console.error(e);
        process.exit(GENERIC_ERROR_CODE);
    })

