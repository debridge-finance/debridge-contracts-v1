import {Logger} from "log4js";
import Web3 from "web3";
import {DeBridgeGate} from "../../../typechain-types-web3/DeBridgeGate";

export type GateSendArguments = {
    tokenAddress: string, //address _tokenAddress,
    amount: string, // uint256 _amount,
    chainIdTo: number, //uint256 _chainIdTo,
    receiver: string, // bytes memory _receiver,
    permit?: string, //bytes memory _permit,
    useAssetFee?: boolean, //bool _useAssetFee,
    referralCode?: number, //uint32 _referralCode,
    autoParams?: string,// bytes calldata _autoParams
}

export type TsSendArguments = {
    logger: Logger,
    web3: Web3,
    senderPrivateKey: string,
    debridgeGateInstance: DeBridgeGate,
    debridgeGateAddress: string,
    fixNativeFee: string, // fix fee for transfer
    gateSendArguments: GateSendArguments,
};

const gateSendDefaultNotRequiredValue = {
    permit: '0x',
    useAssetFee: false,
    referralCode: 0,
    autoParams: '0x',
}

export default async function send({
    logger,
    web3,
    senderPrivateKey,
    fixNativeFee,
    debridgeGateInstance,
    debridgeGateAddress,
    gateSendArguments
}: TsSendArguments) {
    logger.info("Sending");
    logger.info(gateSendArguments);

    const senderAddress = web3.eth.accounts.privateKeyToAccount(senderPrivateKey).address;
    const nonce = await web3.eth.getTransactionCount(senderAddress);
    logger.info("Nonce current", nonce);

    const gasPrice = await web3.eth.getGasPrice();
    logger.info("gasPrice", gasPrice.toString());

    const gateSendArgValues = Object.values({
        ...gateSendDefaultNotRequiredValue,
        ...gateSendArguments
    }) as Parameters<DeBridgeGate["methods"]["send"]>;
    const sendMethod = debridgeGateInstance.methods.send(...gateSendArgValues);

    const estimatedGas = await sendMethod.estimateGas({from: senderAddress, value: fixNativeFee});
    logger.info("Send estimateGas", estimatedGas.toString());

    const tx = {
            from: senderAddress,
            to: debridgeGateAddress,
            gas: estimatedGas,
            value: fixNativeFee,
            gasPrice: gasPrice,
            nonce,
            data: sendMethod.encodeABI(),
    };

    logger.info("Send tx", tx);
    const signedTx = await web3.eth.accounts.signTransaction(tx, senderPrivateKey);
    logger.info("Send signed tx", signedTx);

    let result = await web3.eth.sendSignedTransaction(signedTx.rawTransaction as string);
    logger.info("Send result", result);

    const logs = result.logs.find(l=>l.address===debridgeGateAddress);
    const submissionId = logs?.data.substring(0, 66);
    logger.info(`SUBMISSION ID ${submissionId}`);
    logger.info("Success");
}