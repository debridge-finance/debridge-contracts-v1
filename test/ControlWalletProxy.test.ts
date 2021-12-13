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

let [deployer, nativeSenderSetInInit, someRandomAddress1, someRandomAddress2]: SignerWithAddress[] = [];

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
    [deployer, nativeSenderSetInInit, someRandomAddress1, someRandomAddress2] = await ethers.getSigners();
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


describe('initializer', async () => {
    test('can be called only once', async () => {
        await expect(initializeControlWalletProxy()).to.be.revertedWith("Initializable: contract is already initialized");
    })
    test('controllingAddressesCount is set to 1', async () => {
        expect(await controlWalletProxy.controllingAddressesCount()).to.equal(1);
    })
})

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


const testOnlyCallProxyFromControllingAddressModifier = (
    getCallData: () => string,
    callFrom: (from: Signer) => Promise<ContractTransaction>
) => {
    test('only callProxy can call', async () => {
        await expectCallThroughCallProxySuccess(
            getCallData(),
            nativeSenderSetInInit.address,
            CHAIN_ID_FROM_SET_IN_INIT,
        );

        await expect(callFrom(someRandomAddress1))
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
                getCallData(),
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
            const wrongAddress = someRandomAddress1.address;

            await theTest(wrongAddress, CHAIN_ID_FROM_SET_IN_INIT);
        })

        test('chainId and address', async () => {
            const wrongAddress = someRandomAddress1.address;
            const wrongChainId = CHAIN_ID_FROM_SET_IN_INIT + 1;

            await theTest(wrongAddress, wrongChainId);
        })
    })
}

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

    testOnlyCallProxyFromControllingAddressModifier(() => callWithMockArgsCallData, callFrom);

    test('failed external call reverts', async () => {
        const callDataThatWillBeRejectedByWallet = (new ethers.utils.Interface(["function unknownFunction()"]))
            .encodeFunctionData('unknownFunction');
        await expectCallThroughCallProxyFail(callDataThatWillBeRejectedByWallet);
    })
})

describe('add/remove calling address', () => {
    let mockArgsForAddControllingAddress: [address: BytesLike, chainId: BigNumberish];
    let addControllingAddressCallData: string;

    let [addressTupleSetInInit, firstAddressTuple, secondAddressTuple]: [address: string, chainId: BigNumberish][] = [];

    const addressTupleCallData: Record<'addFirst' | 'addSecond' | 'removeFirst' | 'removeSecond' | 'removeSetInInit',
        string> = {
        addFirst: '',
        addSecond: '',
        removeFirst: '',
        removeSecond: '',
        removeSetInInit: '',
    };


    beforeEach(() => {
        const someChainId0 = CHAIN_ID_FROM_SET_IN_INIT + 3;
        mockArgsForAddControllingAddress = [arrayify(someRandomAddress1.address), someChainId0,];
        addControllingAddressCallData = controlWalletProxy.interface
            .encodeFunctionData('addControllingAddress', mockArgsForAddControllingAddress);

        const someChainId1 = CHAIN_ID_FROM_SET_IN_INIT + 39;
        const someChainId2 = CHAIN_ID_FROM_SET_IN_INIT + 93;

        addressTupleSetInInit = [nativeSenderSetInInit.address, CHAIN_ID_FROM_SET_IN_INIT];
        firstAddressTuple = [someRandomAddress1.address, someChainId1];
        secondAddressTuple = [someRandomAddress1.address, someChainId2];

        addressTupleCallData.addFirst = controlWalletProxy.interface.encodeFunctionData(
            'addControllingAddress', firstAddressTuple
        );
        addressTupleCallData.addSecond = controlWalletProxy.interface.encodeFunctionData(
            'addControllingAddress', secondAddressTuple
        );
        addressTupleCallData.removeFirst = controlWalletProxy.interface.encodeFunctionData(
            'removeControllingAddress', firstAddressTuple
        );
        addressTupleCallData.removeSecond = controlWalletProxy.interface.encodeFunctionData(
            'removeControllingAddress', secondAddressTuple
        );
        addressTupleCallData.removeSetInInit = controlWalletProxy.interface.encodeFunctionData(
            'removeControllingAddress', addressTupleSetInInit
        )
    })

    const callFrom = async (from: Signer) => controlWalletProxy.connect(from)
        .addControllingAddress(...mockArgsForAddControllingAddress);

    testOnlyCallProxyFromControllingAddressModifier(() => addControllingAddressCallData, callFrom);

    test('adding increases controllingAddressesCount', async () => {
        expect(await controlWalletProxy.controllingAddressesCount()).to.be.equal(1);

        await callWalletThroughCallProxy(addressTupleCallData.addFirst);
        expect(await controlWalletProxy.controllingAddressesCount()).to.be.equal(2);

        await callWalletThroughCallProxy(addressTupleCallData.addSecond);
        expect(await controlWalletProxy.controllingAddressesCount()).to.be.equal(3);
    })
    test("can't add already added", async () => {
        await expectCallThroughCallProxySuccess(addressTupleCallData.addFirst);
        await expectCallThroughCallProxyFail(addressTupleCallData.addFirst);
    })

    test('removing decreases controllingAddressesCount', async () => {
        await callWalletThroughCallProxy(addressTupleCallData.addFirst);
        await callWalletThroughCallProxy(addressTupleCallData.addSecond);

        expect(await controlWalletProxy.controllingAddressesCount()).to.be.equal(3);

        await callWalletThroughCallProxy(addressTupleCallData.removeFirst);
        expect(await controlWalletProxy.controllingAddressesCount()).to.be.equal(2);

        await callWalletThroughCallProxy(addressTupleCallData.removeSecond);
        expect(await controlWalletProxy.controllingAddressesCount()).to.be.equal(1);
    })
    test("can't remove not in list", async () => {
        await expectCallThroughCallProxyFail(addressTupleCallData.removeFirst);
    })
    test("can't remove last", async () => {
        expect(await controlWalletProxy.controllingAddressesCount()).to.be.equal(1);
        expect(await controlWalletProxy.isControllingAddress(...addressTupleSetInInit)).to.be.true;

        await expectCallThroughCallProxyFail(addressTupleCallData.removeSetInInit);
    })
    test('becomes controlling address after add', async () => {
        expect(await controlWalletProxy.isControllingAddress(...firstAddressTuple)).to.be.false;
        await callWalletThroughCallProxy(addressTupleCallData.addFirst);
        expect(await controlWalletProxy.isControllingAddress(...firstAddressTuple)).to.be.true;
    })
    test('stops being controlling address after remove', async () => {
        await callWalletThroughCallProxy(addressTupleCallData.addFirst);
        expect(await controlWalletProxy.isControllingAddress(...firstAddressTuple)).to.be.true;

        await callWalletThroughCallProxy(addressTupleCallData.removeFirst);
        expect(await controlWalletProxy.isControllingAddress(...firstAddressTuple)).to.be.false;
    })

    test.only('ControllingAddressUpdated is emitted on add and remove', async () => {
        await expect(callWalletThroughCallProxy(addressTupleCallData.addFirst))
            .to.emit(controlWalletProxy, 'ControllingAddressUpdated')
            .withArgs(firstAddressTuple[0].toLowerCase(), firstAddressTuple[1], true)

        await expect(callWalletThroughCallProxy(addressTupleCallData.removeFirst))
            .to.emit(controlWalletProxy, 'ControllingAddressUpdated')
            .withArgs(firstAddressTuple[0].toLowerCase(), firstAddressTuple[1], false)
    })
})
