const { expectRevert } = require("@openzeppelin/test-helpers");
const { waffle } = require("hardhat")
const SignatureUtilContract = artifacts.require("MockSignatureUtil");
const { toWei, fromWei, toBN } = web3.utils;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

contract("SignatureUtil", function([alice, bob, carol, eve, devid]) {
  it('should split bytes signature, fail invalid signature length', async()=>{
      const signatureUtil = await SignatureUtilContract.new();
      await expectRevert(signatureUtil.call_splitSignature('0x00'),"splitSignature: invalid signature length");
  })
});