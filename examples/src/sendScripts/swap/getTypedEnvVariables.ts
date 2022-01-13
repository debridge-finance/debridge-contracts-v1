// Validation and parsing to typed values, you may skip this step
import * as t from "io-ts";
import {Web3RpcUrl} from "../constants";
import reporter from "io-ts-reporters";
import "../parseDotEnvs";
import {isLeft} from "fp-ts/Either";
import {ChainId} from "@uniswap/sdk";
import logger from "./logger";
import {GENERIC_ERROR_CODE} from "./constants";

if (process.env.CHAIN_ID_TO !== ChainId.KOVAN.toString()){
    logger.error('This example allows sending to kovan only for now because only this networks has both uniswap v2 and debridgeGate');
    process.exit(GENERIC_ERROR_CODE);
}

const ExpectedEnvVars = t.exact(t.type({
    CHAIN_ID_FROM: t.keyof(Web3RpcUrl),
    CHAIN_ID_TO: t.literal(ChainId.KOVAN),
    TOKEN_ADDRESS_FROM: t.string,
    TOKEN_ADDRESS_TO: t.string,
    AMOUNT: t.string,
    DEBRIDGEGATE_ADDRESS: t.string,
    SENDER_PRIVATE_KEY: t.string,
    ROUTER_ADDRESS: t.string,
}));

const processEnv = {
    ...process.env,
    // helps to parse CHAIN_ID_TO as ChainId.KOVAN, not generic number if IntFromString is used
    CHAIN_ID_TO: parseInt(process.env.CHAIN_ID_TO)
}

const parsed = ExpectedEnvVars.decode(processEnv);
const hasErrors = isLeft(parsed);
if (hasErrors){
    const errors = reporter.report(parsed);
    errors.forEach(message => logger.error(message));
    process.exit(GENERIC_ERROR_CODE);
}

export default parsed.right;