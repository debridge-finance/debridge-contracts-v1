import BN from "bn.js";
import { DeBridgeGate } from "../../../../typechain-types-web3/DeBridgeGate";
import getDebridgeId from "./getDebridgeId";
import {Web3RpcUrl} from "../constants";
import {toWei} from "web3-utils";
import {AddressZero} from "@ethersproject/constants";

const DEFAULT_EXECUTION_FEE = new BN(toWei('0.01'));

export default class FeesCalculator {
    constructor(
        private readonly amountToSend: BN,
        private readonly tokenToSend: string,
        private readonly deBridgeGateTo: DeBridgeGate,
        private readonly deBridgeGateFrom: DeBridgeGate,
        private readonly CHAIN_ID_TO: keyof typeof Web3RpcUrl,
        private readonly CHAIN_ID_FROM: keyof typeof Web3RpcUrl,
    ) {
    }

    public isSendingNativeToken() {
        return this.tokenToSend === AddressZero;
    }

    public async getTransferFee(){
        const BPS_DENOMINATOR = new BN(await this.deBridgeGateFrom.methods.BPS_DENOMINATOR().call());

        const toChainConfig = await this.deBridgeGateFrom.methods.getChainToConfig(this.CHAIN_ID_TO).call();
        const globalTransferFeeBps = new BN( await this.deBridgeGateFrom.methods.globalTransferFeeBps().call() );
        const transferFeeBps = toChainConfig.transferFeeBps === '0'
            ? globalTransferFeeBps
            : new BN(toChainConfig.transferFeeBps);

        return this.amountToSend.mul(transferFeeBps).div(BPS_DENOMINATOR);
    }

    public getExecutionFee() {
        return DEFAULT_EXECUTION_FEE;
    }

    public async getNativeFee(): Promise<BN> {
        const toChainConfig = await this.deBridgeGateFrom.methods.getChainToConfig(this.CHAIN_ID_TO).call();
        const globalFixedNativeFee = new BN( await this.deBridgeGateFrom.methods.globalFixedNativeFee().call() );
        return toChainConfig.transferFeeBps === '0'
            ? globalFixedNativeFee
            : new BN(toChainConfig.transferFeeBps);
    }


    public async getChainFeeForDebridgeId(): Promise<BN> {
        const deBridgeId = await getDebridgeId(
            this.deBridgeGateFrom,
            this.deBridgeGateTo,
            this.CHAIN_ID_FROM,
            this.tokenToSend
        );
        return new BN(
            await this.deBridgeGateFrom.methods.getDebridgeChainAssetFixedFee(deBridgeId, this.CHAIN_ID_TO).call()
        );
    }

    public async getFeesToPayInNativeToken(): Promise<BN> {
        const transferFee = await this.getTransferFee();
        const executionFee = await this.getExecutionFee();
        const chainFee = await this.getChainFeeForDebridgeId();
        const nativeFee = await this.getNativeFee();

        return this.isSendingNativeToken()
            ? transferFee.add(executionFee).add(chainFee)
            : nativeFee
    }

    public async getFeesToPayInSentToken(): Promise<BN> {
        const transferFee = await this.getTransferFee();
        const executionFee = await this.getExecutionFee();

        return this.isSendingNativeToken()
            ? await this.getFeesToPayInNativeToken()
            : executionFee.add(transferFee)
    }

    public async getAmountAfterFee(): Promise<BN> {
        return this.amountToSend.sub(await this.getFeesToPayInSentToken());
    }

}
