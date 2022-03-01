import {Command} from 'commander';
import {ChainId} from "@uniswap/sdk";
import logger from "./logger";
import {GENERIC_ERROR_CODE} from "../constants";
import {Web3RpcUrl} from "../constants";
import {isAddress} from "ethers/lib/utils";

const program = new Command()
    .requiredOption('--chain-id-from <id>', 'Chain id from', parseInt)
    .requiredOption('--chain-id-to <id>', 'Chain id to', parseInt)
    .requiredOption('--token-address-from <address>')
    .requiredOption('--token-address-to <address>')
    .requiredOption('--amount <amount in ether(10**18)>')
    .showHelpAfterError()
;

program.parse();

const {chainIdFrom, chainIdTo, tokenAddressFrom, tokenAddressTo, amount} = program.opts<{
    chainIdFrom: number,
    chainIdTo: number,
    tokenAddressFrom: string,
    tokenAddressTo: string,
    amount: string,
}>();

type KeyOfWeb3RpcUrl = keyof typeof Web3RpcUrl;

const isKeyOfWeb3Rpc = (value: number): value is KeyOfWeb3RpcUrl =>
    Object.keys(Web3RpcUrl).includes(value.toString());

let hasErrors = false;

if (!isKeyOfWeb3Rpc(chainIdFrom)){
    logger.error(`--chain-id-from must be one of ${Object.keys(Web3RpcUrl).join('|')}`);
    hasErrors = true;
}

if (chainIdTo !== ChainId.KOVAN) {
    logger.error(`--chain-id-to must be ${ChainId.KOVAN}. This example allows sending to kovan only for now, because only this networks has both uniswap v2 and debridgeGate`);
    hasErrors = true;
}

if (!isAddress(tokenAddressFrom)){
    logger.error('--token-address-from must be an address');
    hasErrors = true;
}

if (!isAddress(tokenAddressTo)){
    logger.error('--token-address-to must be an address');
    hasErrors = true;
}

if (hasErrors){
    process.exit(GENERIC_ERROR_CODE)
}

const CHAIN_ID_FROM = chainIdFrom as KeyOfWeb3RpcUrl;
const CHAIN_ID_TO = chainIdTo as ChainId.KOVAN;

export default {
    CHAIN_ID_FROM,
    CHAIN_ID_TO,
    TOKEN_ADDRESS_FROM: tokenAddressFrom,
    TOKEN_ADDRESS_TO: tokenAddressTo,
    AMOUNT: amount,
};
