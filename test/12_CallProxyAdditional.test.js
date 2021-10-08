const { waffle, artifacts, ethers } = require("hardhat")
const { deployMockContract } = waffle
const { expectRevert } = require("@openzeppelin/test-helpers");
const { Contract } = require("hardhat/internal/hardhat-network/stack-traces/model");
const SignatureVerifier = artifacts.require("MockSignatureVerifierForTesting");
const DebridgeGate = artifacts.require("../build/DeBridgeGate.json");
const WrappedAsset = artifacts.require("../build/DeBridgeToken.json");
const MockToken = artifacts.require("MockToken");
const { toWei, fromWei, toBN } = web3.utils;
const CallProxy = artifacts.require("MockCallProxy");
const ZERO_ADDRESS   = "0x0000000000000000000000000000000000000000";
const MOCK_ADDRESS   = "0x0000000000000000000000000000000000000001";



contract("CallProxy", ()=>{
    beforeEach(async()=>{
        this.signers = await ethers.getSigners()
        aliceAccount=this.signers[0]
        bobAccount=this.signers[1]
        carolAccount=this.signers[2]
        eveAccount=this.signers[3]
        feiAccount=this.signers[4]
        devidAccount=this.signers[5]
        alice=aliceAccount.address
        bob=bobAccount.address
        carol=carolAccount.address
        eve=eveAccount.address
        fei=feiAccount.address
        devid=devidAccount.address
        this.callProxy = await CallProxy.new({from:alice});
    })

    it('should call version',async()=>{
        let result = await this.callProxy.version();
        expect(result.toNumber()).to.be.equal(101);
    })

    it('shoul use call function, fail, external call failed, flags 0', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAsset.abi);
        await mockWrappedAsset.mock.mint.returns();
        functionSigHash = web3.eth.abi.encodeFunctionSignature('mint()');
        await this.callProxy.mock_set_gate_role(alice)
        await expectRevert(this.callProxy.call(
            bob, 
            mockWrappedAsset.address, 
            0, 
            functionSigHash, 
            '0x00',
            {
                from:alice, 
                value:ethers.utils.parseEther("1.0")
            }),"ExternalCallFailed()");
    })

    it('shoul use call function, should work', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAsset.abi);
        await mockWrappedAsset.mock.mint.returns();
        functionSigHash = web3.eth.abi.encodeFunctionSignature('mint()');
        await this.callProxy.mock_set_gate_role(alice)
        await this.callProxy.call(
            bob, 
            mockWrappedAsset.address, 
            functionSigHash, 
            2**0, 
            '0x00',
            {
                from:alice, 
                value:ethers.utils.parseEther("1.0")
            });
    })

    it('shoul use call function, should work, external call result true', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAsset.abi);
        await mockWrappedAsset.mock.mint.returns();
        functionSigHash = web3.eth.abi.encodeFunctionSignature('mint(address,uint256)');
        await this.callProxy.mock_set_gate_role(alice)
        await this.callProxy.call(
            bob, 
            mockWrappedAsset.address, 
            functionSigHash, 
            2**0, 
            '0x00',
            {
                from:alice, 
                value:ethers.utils.parseEther("1.0")
            });
    })

    it('shoul use call function, should work, flag proxy sender', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAsset.abi);
        await mockWrappedAsset.mock.mint.returns();
        functionSigHash = web3.eth.abi.encodeFunctionSignature('mint()');
        await this.callProxy.mock_set_gate_role(alice)
        await this.callProxy.call(
            bob, 
            mockWrappedAsset.address, 
            functionSigHash, 
            4, 
            '0x00',
            {
                from:alice, 
                value:ethers.utils.parseEther("1.0")
            });
    })

    it('shoul use call function, should fail call failed', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAsset.abi);
        await mockWrappedAsset.mock.mint.returns();
        functionSigHash = web3.eth.abi.encodeFunctionSignature('mint()');
        await this.callProxy.mock_set_gate_role(alice)
        await expectRevert(this.callProxy.call(
            this.callProxy.address, 
            mockWrappedAsset.address, 
            functionSigHash, 
            2**0, 
            '0x00',
            {
                from:alice, 
                value:ethers.utils.parseEther("1.0")
            }),"CallFailed()");
    })

    it('should use callERC20, fail gate role', async()=>{
        const mockToken = await MockToken.new("MOCK", "MCK",18,{from:alice});
        const functionSigHash = web3.eth.abi.encodeFunctionSignature('mint()');
        const flags = 4;
        const nativeSender = '0x00';
        await expectRevert(this.callProxy.callERC20(
            mockToken.address,
            bob,
            alice,
            functionSigHash,
            flags,
            nativeSender
        ),"DeBridgeGateBadRole()")
    })

    it('should use callERC20, fail external call failed', async()=>{
        const mockToken = await MockToken.new("MOCK", "MCK",18,{from:alice});
        const functionSigHash = web3.eth.abi.encodeFunctionSignature('mint()');
        const flags = 4;
        const nativeSender = '0x00';
        await this.callProxy.mock_set_gate_role(alice)
        await this.callProxy.callERC20(
            mockToken.address,
            bob,
            alice,
            functionSigHash,
            flags,
            nativeSender
        )
    })
})