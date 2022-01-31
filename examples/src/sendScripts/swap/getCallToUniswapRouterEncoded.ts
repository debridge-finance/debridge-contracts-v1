import {FACTORY_ADDRESS, Fetcher, Percent, Route, Token, TokenAmount, Trade, TradeType, WETH} from "@uniswap/sdk";
import {AbiItem} from "web3-utils";
import {ERC20} from "../../../../typechain-types-web3/ERC20";
import BN from "bn.js";
import {AddressZero} from "@ethersproject/constants";
import {IUniswapV2Factory} from "../../../../typechain-types-web3/IUniswapV2Factory";
import logger from "./logger";
import {UniswapV2Router02} from "../../../../typechain-types-web3/UniswapV2Router02";
import {GENERIC_ERROR_CODE, Web3RpcUrl} from "../constants";
import UniswapV2Router02Json from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import IUniswapV2FactoryJson from "@uniswap/v2-periphery/build/IUniswapV2Factory.json";
import ERC20Json from "@openzeppelin/contracts/build/contracts/ERC20.json";
import Web3 from "web3";
import {DeBridgeGate} from "../../../../typechain-types-web3/DeBridgeGate";
import getDebridgeId from "./getDebridgeId";
import normalizeToDecimals from "./normalizeToDecimals";

async function getUniswapTokenInstanceFromAddress(
    web3To: Web3,
    chainId: number,
    address: string
): Promise<Token> {
    const tokenInstance = new web3To.eth.Contract(ERC20Json.abi as AbiItem[], address) as unknown as ERC20;
    const tokenDecimals = parseInt(
        await tokenInstance.methods.decimals().call()
    );
    return new Token(chainId, address, tokenDecimals);
}

async function getTokenAddressOnToChain(
    deBridgeGateFrom: DeBridgeGate,
    deBridgeGateTo: DeBridgeGate,
    TOKEN_ADDRESS_FROM: string,
    fromChainId: keyof typeof Web3RpcUrl,
    tokenAddressOnFromChain: string
) {
    const nativeTokenInfo = await deBridgeGateFrom.methods.getNativeInfo(tokenAddressOnFromChain).call();
    const isNativeToken = TOKEN_ADDRESS_FROM === AddressZero || nativeTokenInfo.nativeChainId === fromChainId.toString();
    const nativeChainId = parseInt(nativeTokenInfo.nativeChainId);

    const deBridgeId = isNativeToken
        ?  await getDebridgeId(deBridgeGateFrom, deBridgeGateTo, fromChainId, tokenAddressOnFromChain)
        :  await getDebridgeId(deBridgeGateFrom, deBridgeGateTo, nativeChainId, nativeTokenInfo.nativeAddress)

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

export default async function getCallToUniswapRouterEncoded(
    web3To: Web3,
    deBridgeGateFrom: DeBridgeGate,
    deBridgeGateTo: DeBridgeGate,
    TOKEN_ADDRESS_FROM: string,
    TOKEN_ADDRESS_TO: string,
    CHAIN_ID_FROM: keyof typeof Web3RpcUrl,
    CHAIN_ID_TO: keyof typeof WETH,
    ROUTER_ADDRESS: string,
    SENDER_PRIVATE_KEY: string,
    amountToSell: BN,
    decimalsMultiplierForSentToken: BN,
): Promise<string> {
    const addressOfFromTokenOnToChain = await getTokenAddressOnToChain(
        deBridgeGateFrom,
        deBridgeGateTo,
        TOKEN_ADDRESS_FROM,
        CHAIN_ID_FROM,
        TOKEN_ADDRESS_FROM
    );
    const fromTokenOnToChainUniswap = await getUniswapTokenInstanceFromAddress(
        web3To,
        CHAIN_ID_TO,
        addressOfFromTokenOnToChain
    );
    const shouldReceiveNativeToken = TOKEN_ADDRESS_TO === AddressZero;

    const toTokenUniswap =  shouldReceiveNativeToken
        ? WETH[CHAIN_ID_TO]
        : await getUniswapTokenInstanceFromAddress(web3To, CHAIN_ID_TO, TOKEN_ADDRESS_TO)
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
