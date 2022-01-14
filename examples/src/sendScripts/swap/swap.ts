import Web3 from "web3";
import DeBridgeGateJson from "../../../../artifacts/contracts/transfers/DeBridgeGate.sol/DeBridgeGate.json";
import ERC20Json from "@openzeppelin/contracts/build/contracts/ERC20.json"
import {AbiItem, toWei, fromWei} from "web3-utils";
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
import send, {GateSendArguments} from "../genericSend";
import {ethers} from "ethers";
import BN from "bn.js";

const DEFAULT_EXECUTION_FEE_BN = new BN(toWei('0.01'));

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

    const toTokenUniswap = await getUniswapTokenInstanceFromAddress(CHAIN_ID_TO, TOKEN_ADDRESS_TO);

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

    return router.methods.swapExactTokensForTokens(
        toWei(trade.inputAmount.toExact()),
        toWei(trade.minimumAmountOut(slippageTolerance).toExact()),
        [deTokenOfFromTokenOnToChainAddress, TOKEN_ADDRESS_TO],
        TOKEN_ADDRESS_TO,
        deadline
    ).encodeABI();
}

async function calculateTotalFeesWithoutExecutionFees(amountWholeBN: BN): Promise<BN> {
    const BPS_DENOMINATOR_BN = new BN(await deBridgeGateFrom.methods.BPS_DENOMINATOR().call());

    const toChainConfig = await deBridgeGateFrom.methods.getChainToConfig(CHAIN_ID_TO).call();
    const globalTransferFeeBpsBN = new BN( await deBridgeGateFrom.methods.globalTransferFeeBps().call() );
    const transferFeeBpsBN = toChainConfig.transferFeeBps === '0' ? globalTransferFeeBpsBN : new BN('0');
    const transferFeeBN = amountWholeBN.mul(transferFeeBpsBN).div(BPS_DENOMINATOR_BN);

    const deBridgeId = await getDebridgeId(CHAIN_ID_FROM, TOKEN_ADDRESS_FROM);
    const debridgeChainAssetFixedFeeBN = new BN(
        await deBridgeGateFrom.methods.getDebridgeChainAssetFixedFee(deBridgeId, CHAIN_ID_TO).call()
    );
    return  transferFeeBN.add(debridgeChainAssetFixedFeeBN);
}

async function main() {
    if (TOKEN_ADDRESS_FROM === AddressZero) {
        logger.info('TOKEN_ADDRESS_FROM is set to address zero, native token will be used, value will be set to AMOUNT');
    } else {
        logger.error('TOKEN_ADDRESS_FROM is NOT set to address zero, non-native tokens are not supported yet, set TOKEN_ADDRESS_FROM to address zero to use this example');
    }

    const amountWholeBN = new BN(toWei(AMOUNT));
    const totalFeeWithoutExecutionBN = await calculateTotalFeesWithoutExecutionFees(amountWholeBN);
    const executionFeeBN = DEFAULT_EXECUTION_FEE_BN;
    const totalFees = totalFeeWithoutExecutionBN.add(executionFeeBN);
    const amountAfterFeeBN = amountWholeBN.sub(totalFees);

    logger.info('amount whole', fromWei(amountWholeBN));
    logger.info('total fee without execution', fromWei(totalFeeWithoutExecutionBN));
    logger.info('execution fee ', fromWei(executionFeeBN));
    logger.info('total fee ', fromWei(totalFees));
    logger.info('left after fees', fromWei(amountAfterFeeBN));

    const autoParamsTo = ['tuple(uint256 executionFee, uint256 flags, bytes fallbackAddress, bytes data)'];
    const callToUniswapRouterEncoded = await getCallToUniswapRouterEncoded(amountAfterFeeBN.toString());
    const autoParams = ethers.utils.defaultAbiCoder.encode(autoParamsTo, [[
        executionFeeBN.toString(),
        parseInt('110', 2), // REVERT_IF_EXTERNAL_FAIL && PROXY_WITH_SENDER, see Flags.sol,
        web3To.eth.accounts.privateKeyToAccount(SENDER_PRIVATE_KEY).address,
        callToUniswapRouterEncoded,
    ]]);
    logger.info('autoParams', autoParams);
    logger.info('callToUniswapRouterEncoded', callToUniswapRouterEncoded);

    const gateSendArguments: GateSendArguments = {
        tokenAddress: TOKEN_ADDRESS_FROM,
        amount: amountWholeBN.toString(),
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
        value: amountWholeBN.toString(),
        gateSendArguments,
    });
}

main()
    .catch(e => {
        logger.error('Fail with error:');
        console.error(e);
        process.exit(GENERIC_ERROR_CODE);
    })

