const { expectRevert } = require("@openzeppelin/test-helpers");
const { waffle } = require("hardhat")
const SignatureUtilContract = artifacts.require("MockSignatureUtil");
const { toWei, fromWei, toBN } = web3.utils;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

contract("SignatureUtil", function([alice, bob, carol, eve, devid]) {
  beforeEach(async()=>{
    this.signatureUtil = await SignatureUtilContract.new();
  })

  it('should split bytes signature, fail invalid signature length', async()=>{
      await expectRevert(this.signatureUtil.call_splitSignature('0x00'),"SignatureInvalidLength()");
  })

  it('should parse bytes signature, fail signature invalid', async()=>{
    const signature  = '0xd3ee395e82769b9e8ec18d0567bdba83e982140787c805eecd7db200291c4071b10ee5df72b9da54450cf739c6a35aef12f7ccab78b3f27679c1b9694da8982ae4'
    await expectRevert(this.signatureUtil.call_parseSignature(signature,0),"SignatureInvalidV()");
  })

  it('should parse bytes signature, fail wrong arguments', async()=>{
    await expectRevert(this.signatureUtil.call_toUint256([],65),"WrongArgumentLength()");
  })
});