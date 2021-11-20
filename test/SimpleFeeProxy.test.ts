import { deployMockContract, MockContract, Stub } from '@ethereum-waffle/mock-contract';
import { BigNumber } from '@ethersproject/bignumber';
import { arrayify, Bytes } from '@ethersproject/bytes';
import { ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import ERC20Json from '@openzeppelin/contracts/build/contracts/ERC20.json';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { before } from 'mocha';
import DeBridgeGateJson from '../artifacts/contracts/transfers/DeBridgeGate.sol/DeBridgeGate.json';
import { DeBridgeGate, ERC20, SimpleFeeProxy } from '../typechain-types';
import expectStubFunctionIsCalledWith from './utils/expectStubFunctionIsCalledWith';

type DeBridgeGateMock = MockContract & {mock: { [K in keyof DeBridgeGate['functions']]: Stub }};
type ERC20Mock = MockContract & {mock: { [K in keyof ERC20['functions']]: Stub }};

let simpleFeeProxyFactory: ContractFactory;
let simpleFeeProxy: SimpleFeeProxy;
let deployer: SignerWithAddress;
let treasury: SignerWithAddress;
let user: SignerWithAddress;
let native: SignerWithAddress;
let donor: SignerWithAddress;
let newAdmin: SignerWithAddress;
let CHAIN_ID: number;
let DEFAULT_ADMIN_ROLE: string;

let deBridgeGateMock: DeBridgeGateMock;
let erc20Mock: ERC20Mock;
let NATIVE_ADDRESS: Bytes;

before(async () => {
    [deployer, treasury, user, native, donor, newAdmin] = await ethers.getSigners();
    CHAIN_ID =  (await ethers.provider.getNetwork()).chainId;
    NATIVE_ADDRESS = arrayify(native.address);
});

beforeEach(async () => {
    simpleFeeProxyFactory = await ethers.getContractFactory("SimpleFeeProxy", deployer);
    simpleFeeProxy = await upgrades.deployProxy(simpleFeeProxyFactory, []) as SimpleFeeProxy;
    DEFAULT_ADMIN_ROLE = await simpleFeeProxy.DEFAULT_ADMIN_ROLE();
    await simpleFeeProxy.setTreasury(treasury.address);

    erc20Mock = await deployMockContract(deployer, ERC20Json.abi) as ERC20Mock;
    await erc20Mock.mock.balanceOf.returns(0 as any);
    await erc20Mock.mock.transfer.returns(true as any);

    deBridgeGateMock = await deployMockContract(deployer, DeBridgeGateJson.abi) as DeBridgeGateMock;
    await deBridgeGateMock.mock.getNativeTokenInfo
        .withArgs(erc20Mock.address)
        .returns(CHAIN_ID, NATIVE_ADDRESS);
    await deBridgeGateMock.mock.withdrawFee.returns();

    await simpleFeeProxy.setDebridgeGate(deBridgeGateMock.address);
});

it('grants DEFAULT_ADMIN_ROLE only to a deployer', async () => {
    const isDeployerAdmin = await simpleFeeProxy.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
    const isUserAdmin = await simpleFeeProxy.hasRole(DEFAULT_ADMIN_ROLE, user.address);
    expect(isDeployerAdmin).to.be.true;
    expect(isUserAdmin).to.be.false;
})

describe('withdrawFee', () => {
    it('reverts on 0 treasury address', async () => {
        await expect(
            simpleFeeProxy.withdrawFee(erc20Mock.address)
        ).not.to.be.revertedWith("EmptyTreasuryAddress()");

        await simpleFeeProxy.setTreasury(ethers.constants.AddressZero);
        await expect(
            simpleFeeProxy.withdrawFee(erc20Mock.address)
        ).to.be.revertedWith("EmptyTreasuryAddress()");
    })

    it('calls withdrawFee with correct id', async () => {
        const correctId = ethers.utils.solidityKeccak256(
            ['uint256', 'bytes'], [CHAIN_ID, NATIVE_ADDRESS]
        );

        await expectStubFunctionIsCalledWith(
            deBridgeGateMock.mock.withdrawFee,
            [correctId],
            async () => simpleFeeProxy.withdrawFee(erc20Mock.address),
        )        
    })

    it('transfers correct amount to treasury', async () => {
        const BALANCE_OF_SIMPLE_FEE_PROXY = 1234567890;

        erc20Mock.mock.balanceOf.withArgs(simpleFeeProxy.address)
            .returns(BALANCE_OF_SIMPLE_FEE_PROXY);

        await expectStubFunctionIsCalledWith(
            erc20Mock.mock.transfer,
            [treasury.address, BALANCE_OF_SIMPLE_FEE_PROXY],
            async () => simpleFeeProxy.withdrawFee(erc20Mock.address)
        )
    })
})

describe('withdrawNativeFee', () => {
    it('reverts on 0 treasury address', async () => {
        await expect(
            simpleFeeProxy.withdrawNativeFee()
        ).not.to.be.revertedWith("EmptyTreasuryAddress()");

        await simpleFeeProxy.setTreasury(ethers.constants.AddressZero);
        await expect(
            simpleFeeProxy.withdrawNativeFee()
        ).to.be.revertedWith("EmptyTreasuryAddress()");
    })

    it('calls withdrawFee with correct id', async () => {
        const correctId = ethers.utils.solidityKeccak256(
            ['uint256', 'bytes'], [CHAIN_ID, ethers.constants.AddressZero]
        );

        await expectStubFunctionIsCalledWith(
            deBridgeGateMock.mock.withdrawFee,
            [correctId],
            async () => simpleFeeProxy.withdrawNativeFee(),
        )        
    })

    describe('transfer to treasury', () => {
        const BALANCE_OF_SIMPLE_FEE_PROXY = 1234567890;
        let treasuryBalance: BigNumber;
        beforeEach(async () => {
            await donor.sendTransaction({
                to: simpleFeeProxy.address, value: BALANCE_OF_SIMPLE_FEE_PROXY
            })

            expect(await ethers.provider.getBalance(simpleFeeProxy.address))
                .to.equal(BALANCE_OF_SIMPLE_FEE_PROXY);
            treasuryBalance = await ethers.provider.getBalance(treasury.address);
        })

        it('transfers correct amount to treasury', async () => {
            await simpleFeeProxy.withdrawNativeFee();

            expect(await ethers.provider.getBalance(simpleFeeProxy.address))
                .to.equal(0);
            expect(await ethers.provider.getBalance(treasury.address))
                .to.equal(treasuryBalance.add(BALANCE_OF_SIMPLE_FEE_PROXY));
        })

        it('reverts on treasury revert', async () => {
            const emptyContractMock = await deployMockContract(deployer, []);
            await simpleFeeProxy.setTreasury(emptyContractMock.address);

            await expect(simpleFeeProxy.withdrawNativeFee())
                .to.be.revertedWith('EthTransferFailed()');
        })
    })
})

describe('onlyAdmin', () => {
    beforeEach(async () => {
        await simpleFeeProxy.grantRole(DEFAULT_ADMIN_ROLE, newAdmin.address);
        await simpleFeeProxy.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    })

    const getProtectedFunctions = (account: SignerWithAddress) => {
        const simpleFeeProxyConnected = simpleFeeProxy.connect(account);
        return [
            async () => simpleFeeProxyConnected.pause(),
            async () => simpleFeeProxyConnected.unpause(),
            async () => simpleFeeProxyConnected.setDebridgeGate(deBridgeGateMock.address),
            async () => simpleFeeProxyConnected.setTreasury(treasury.address),
        ];
    }


    const expectToRevert = async (account: SignerWithAddress): Promise<void> => {
        const promises = getProtectedFunctions(account).map(
            fn => expect(fn()).to.be.revertedWith('AdminBadRole()')
        );
        await Promise.all(promises);
    }

    const expectNotToRevert = async (account: SignerWithAddress): Promise<void> => {
        const promises = getProtectedFunctions(account).map(
            fn => expect(fn()).not.to.be.revertedWith('AdminBadRole()')
        );
        await Promise.all(promises);
    }

    it(`allows admin to call admin functions`, async () => {
        await expectNotToRevert(newAdmin);
    });

    it(`denies deployer to call admin functions`, async () => {
        await expectToRevert(deployer);
    });

    it(`denies user to call admin functions`, async () => {
        await expectToRevert(user);
    });
})

