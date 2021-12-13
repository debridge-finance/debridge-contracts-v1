import {deployMockContract, MockContract, Stub} from "@ethereum-waffle/mock-contract";
import {arrayify} from "@ethersproject/bytes";
import {AddressZero, Zero} from "@ethersproject/constants";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/dist/src/signers";
import ERC20Json from '@openzeppelin/contracts/build/contracts/ERC20.json';
import {BytesLike, ContractTransaction, Signer} from "ethers";
import {BigNumberish} from "ethers/lib/ethers";
import {ethers, expect} from "hardhat";
import {before, test} from "mocha";
import DeBridgeGateJson from "../artifacts/contracts/transfers/DeBridgeGate.sol/DeBridgeGate.json";
import {ControlWalletProxy, DeBridgeGate, ERC20, ICallProxy} from '../typechain-types';

const CHAIN_ID_FROM_SET_IN_INIT = 22;

type ERC20Mock = MockContract & { mock: { [K in keyof ERC20['functions']]: Stub } };
type DeBridgeGateMock = MockContract & { mock: { [K in keyof DeBridgeGate['functions']]: Stub } };

let [deployer, nativeSenderSetInInit, someRandomAddress]: SignerWithAddress[] = [];

let deBridgeGateMock: DeBridgeGateMock;
let callProxyMock: ICallProxy;
let erc20Mock: ERC20Mock;

let controlWalletProxy: ControlWalletProxy;

const initializeControlWalletProxy = async (): Promise<ContractTransaction> => controlWalletProxy.initialize(
    deBridgeGateMock.address,
    arrayify(nativeSenderSetInInit.address),
    CHAIN_ID_FROM_SET_IN_INIT
);

before(async () => {
    [deployer, nativeSenderSetInInit, someRandomAddress] = await ethers.getSigners();
});

beforeEach(async () => {
    erc20Mock = await deployMockContract(deployer, ERC20Json.abi) as ERC20Mock;

    const callProxyMockFactory = await ethers.getContractFactory('MockCallProxy', deployer);
    callProxyMock = await callProxyMockFactory.deploy() as ICallProxy;

    deBridgeGateMock = await deployMockContract(deployer, DeBridgeGateJson.abi) as DeBridgeGateMock;
    await deBridgeGateMock.mock.callProxy.returns(callProxyMock.address as any);

    const controlWalletProxyFactory = await ethers.getContractFactory('ControlWalletProxy', deployer);
    controlWalletProxy = await controlWalletProxyFactory.deploy() as ControlWalletProxy;
    await initializeControlWalletProxy();
});


test('initializer can be called only once', async () => {
    await expect(initializeControlWalletProxy()).to.be.revertedWith("Initializable: contract is already initialized");
})

describe('`call` method', () => {
    let mockArgsForCall: [string, BigNumberish, string, BytesLike];
    let callWithMockArgsCallData: string;

    beforeEach(async () => {
        await erc20Mock.mock.approve.returns(true as any);
        await erc20Mock.mock.allowance.returns(0 as any);
        await erc20Mock.mock.transfer.returns(true as any);

        const mockAcceptAnyCallFactory = await ethers.getContractFactory('MockAcceptAnyCall', deployer);
        const mockAcceptAnyCall = await mockAcceptAnyCallFactory.deploy();
        const callDataForMockAcceptAnyCall = (new ethers.utils.Interface(["function someFunction()"]))
            .encodeFunctionData('someFunction');

        mockArgsForCall = [
            erc20Mock.address, 0, mockAcceptAnyCall.address, callDataForMockAcceptAnyCall
        ];
        callWithMockArgsCallData = controlWalletProxy.interface.encodeFunctionData('call', mockArgsForCall);
    })

    const callFrom = async (from: Signer) => controlWalletProxy.connect(from)
        .call(...mockArgsForCall);

    const callWalletThroughCallProxy = async (
        callData: string,
        nativeAddressToSetInCallProxy?: string,
        chainIdToSetInCallProxy?: BigNumberish,
    ) => callProxyMock.call(
        AddressZero,
        controlWalletProxy.address,
        callData,
        Zero,
        arrayify(nativeAddressToSetInCallProxy ?? nativeSenderSetInInit.address),
        chainIdToSetInCallProxy ?? CHAIN_ID_FROM_SET_IN_INIT,
    );

    // noinspection TypeScriptValidateTypes it's a bug in webStorm
    const expectCallThroughCallProxyFail = async (
        ...args: Parameters<typeof callWalletThroughCallProxy>
    ): Promise<void> =>
        expect(callWalletThroughCallProxy(...args))
            .to.emit(callProxyMock, 'MockCallProxyCallFail')

    // noinspection TypeScriptValidateTypes it's a bug in webStorm
    const expectCallThroughCallProxySuccess = async (
        ...args: Parameters<typeof callWalletThroughCallProxy>
    ): Promise<void> =>
        expect(callWalletThroughCallProxy(...args))
            .to.emit(callProxyMock, 'MockCallProxyCallSuccess')


    test('only callProxy can call', async () => {
        await expectCallThroughCallProxySuccess(
            callWithMockArgsCallData,
            nativeSenderSetInInit.address,
            CHAIN_ID_FROM_SET_IN_INIT,
        );

        await expect(callFrom(someRandomAddress))
            .to.be.revertedWith('CallProxyBadRole()');

        await expect(callFrom(deployer))
            .to.be.revertedWith('CallProxyBadRole()');
    })

    describe('only allowed native sender from chainId can call', () => {
        const addControllingAddress = async (address: string, chainId: BigNumberish): Promise<void> => {
            const callData = controlWalletProxy.interface.encodeFunctionData(
                'addControllingAddress',
                [address, chainId]
            );

            await expectCallThroughCallProxySuccess(
                callData,
                nativeSenderSetInInit.address,
                CHAIN_ID_FROM_SET_IN_INIT,
            );
        }

        const theTest = async (address: string, chainId: BigNumberish): Promise<void> => {
            const argsToTest: Parameters<typeof callWalletThroughCallProxy> = [
                callWithMockArgsCallData,
                address,
                chainId,
            ];

            await expectCallThroughCallProxyFail(...argsToTest);
            await addControllingAddress(address, chainId);
            await expectCallThroughCallProxySuccess(...argsToTest);
        }

        test('chainId', async () => {
            const wrongChainId = CHAIN_ID_FROM_SET_IN_INIT + 1;

            await theTest(nativeSenderSetInInit.address, wrongChainId);
        })

        test('address', async () => {
            const wrongAddress = someRandomAddress.address;

            await theTest(wrongAddress, CHAIN_ID_FROM_SET_IN_INIT);
        })

        test('chainId and address', async () => {
            const wrongAddress = someRandomAddress.address;
            const wrongChainId = CHAIN_ID_FROM_SET_IN_INIT + 1;

            await theTest(wrongAddress, wrongChainId);
        })
    })
})
