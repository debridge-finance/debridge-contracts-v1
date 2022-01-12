import Web3 from "web3";
import DeBridgeGateJson from "../../../../artifacts/contracts/transfers/DeBridgeGate.sol/DeBridgeGate.json";
import ERC20Json from "@openzeppelin/contracts/build/contracts/ERC20.json"
import {AbiItem, toWei} from "web3-utils";
import {Web3RpcUrl} from "../constants";
import envVars from './getTypedEnvVariables';
import {Fetcher, Percent, Route, Token, TokenAmount, Trade, TradeType} from "@uniswap/sdk";
import {ERC20} from "../../../../typechain-types-web3/ERC20";
import {DeBridgeGate} from "../../../../typechain-types-web3/DeBridgeGate";
import {AddressZero} from "@ethersproject/constants";
import logger from "./logger";
import {GENERIC_ERROR_CODE} from "./constants";
import UniswapV2Router02Json from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import {UniswapV2Router02} from "../../../../typechain-types-web3/UniswapV2Router02";

const {
    CHAIN_ID_FROM,
    CHAIN_ID_TO,
    TOKEN_ADDRESS_FROM,
    TOKEN_ADDRESS_TO,
    AMOUNT,
    DEBRIDGEGATE_ADDRESS,
    SENDER_PRIVATE_KEY,
    ROUTER_ADDRESS
} = envVars;

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

async function getDebridgeTokenAddressOnToChain(
    tokenNativeChainId: keyof typeof Web3RpcUrl,
    tokenAddressOnNativeChain: string
) {
    const isNativeTokenRequested = tokenAddressOnNativeChain === AddressZero;
    const addressToUseForDebridgeId = isNativeTokenRequested
        ? await deBridgeGateFrom.methods.weth().call()
        : tokenAddressOnNativeChain;

    const deBridgeId = await deBridgeGateTo.methods.getDebridgeId(tokenNativeChainId, addressToUseForDebridgeId).call();
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

async function getUniswapPairToUseForSwapInfoOnToChain() {
    const deTokenOfFromTokenOnToChainAddress = await getDebridgeTokenAddressOnToChain(
        CHAIN_ID_FROM,
        TOKEN_ADDRESS_FROM
    );
    const deTokenOfFromTokenOnToChainUniswap = await getUniswapTokenInstanceFromAddress(
        CHAIN_ID_TO,
        deTokenOfFromTokenOnToChainAddress
    );

    const toTokenUniswap = await getUniswapTokenInstanceFromAddress(CHAIN_ID_TO, TOKEN_ADDRESS_TO);

    const pair = await Fetcher.fetchPairData(deTokenOfFromTokenOnToChainUniswap, toTokenUniswap);
    const route = new Route([pair], toTokenUniswap);
    const amount = new TokenAmount(toTokenUniswap, toWei(AMOUNT));
    const trade = new Trade(route, amount, TradeType.EXACT_INPUT);
    const slippageTolerance = new Percent("50", "10000"); // 50 bips, or 0.50%
    const deadline = Math.floor(Date.now() / 1000) + 60 * 30; // 30 minutes from the current Unix time

    const router = new web3To.eth.Contract(
        UniswapV2Router02Json.abi as AbiItem[],
        ROUTER_ADDRESS
    ) as unknown as UniswapV2Router02;

    const encoded = router.methods.swapExactTokensForTokens(
        toWei(trade.inputAmount.toExact()),
        toWei(trade.minimumAmountOut(slippageTolerance).toExact()),
        [deTokenOfFromTokenOnToChainAddress, TOKEN_ADDRESS_TO],
        TOKEN_ADDRESS_TO,
        deadline
    ).encodeABI();
}

getUniswapPairToUseForSwapInfoOnToChain();