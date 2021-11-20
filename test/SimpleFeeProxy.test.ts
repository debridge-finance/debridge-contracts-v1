import { ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { SimpleFeeProxy } from '../typechain-types';

let simpleFeeProxyFactory: ContractFactory;
let simpleFeeProxy: SimpleFeeProxy;
let deployer: SignerWithAddress;
let user: SignerWithAddress;

before(async () => {
    [deployer, user] = await ethers.getSigners();
});

beforeEach(async () => {
    simpleFeeProxyFactory = await ethers.getContractFactory("SimpleFeeProxy", deployer);
    simpleFeeProxy = await upgrades.deployProxy(simpleFeeProxyFactory, []) as SimpleFeeProxy;
});

it('grants DEFAULT_ADMIN_ROLE only to a deployer', async () => {
    const DEFAULT_ADMIN_ROLE = await simpleFeeProxy.DEFAULT_ADMIN_ROLE();
    const isDeployerAdmin = await simpleFeeProxy.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
    const isUserAdmin = await simpleFeeProxy.hasRole(DEFAULT_ADMIN_ROLE, user.address);
    expect(isDeployerAdmin).to.be.true;
    expect(isUserAdmin).to.be.false;
})