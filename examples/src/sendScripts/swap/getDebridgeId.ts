import {AddressZero} from "@ethersproject/constants";
import logger from "./logger";
import {DeBridgeGate} from "../../../../typechain-types-web3/DeBridgeGate";

export default async function getDebridgeId(
    deBridgeGateFrom: DeBridgeGate,
    deBridgeGateTo: DeBridgeGate,
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
