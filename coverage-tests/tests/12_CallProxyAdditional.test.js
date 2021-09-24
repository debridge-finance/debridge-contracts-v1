const { waffle, artifacts, ethers } = require("hardhat")
const { deployMockContract } = waffle
const { expectRevert } = require("@openzeppelin/test-helpers");
const { Contract } = require("hardhat/internal/hardhat-network/stack-traces/model");
const SignatureVerifier = artifacts.require("MockSignatureVerifierForTesting");
const DebridgeGate = artifacts.require("../build/DeBridgeGate.json");
const WrappedAsset = artifacts.require("../build/WrappedAsset.json");
const { toWei, fromWei, toBN } = web3.utils;
const CallProxy = artifacts.require("CallProxy");


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

    it('shoul use call function with result value false', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAsset.abi);
        await mockWrappedAsset.mock.mint.returns();
        functionSigHash = web3.eth.abi.encodeFunctionSignature('mint()');
        this.callProxy.call(bob, mockWrappedAsset.address, functionSigHash,{from:alice, value:ethers.utils.parseEther("1.0")})
    })
})