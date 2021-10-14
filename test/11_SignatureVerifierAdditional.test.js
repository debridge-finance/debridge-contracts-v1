const { waffle } = require("hardhat")
const { deployMockContract } = waffle
const { expectRevert, singletons } = require("@openzeppelin/test-helpers");
const SignatureVerifier = artifacts.require("MockSignatureVerifierForTesting");
const DebridgeGate = artifacts.require("../build/DeBridgeGate.json");
const WrappedAsset = artifacts.require("../build/DeBridgeToken.json");
const { toWei, fromWei, toBN } = web3.utils;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MOCK_ADDRESS = "0x0000000000000000000000000000000000000001";
const MOCK_SIGNATURE = '0xd3ee395e82769b9e8ec18d0567bdba83e982140787c805eecd7db200291c4071b10ee5df72b9da54450cf739c6a35aef12f7ccab78b3f27679c1b9694da8982ae4'
const {
  keccak256,
  defaultAbiCoder,
  toUtf8Bytes,
  solidityPack,
} = require("ethers/lib/utils");
const expectEvent = require("@openzeppelin/test-helpers/src/expectEvent");

function parseHexString(str) {
  var result = [];
  str = str.substring(2, str.length);
  while (str.length >= 2) {
      result.push(parseInt(str.substring(0, 2), 16));

      str = str.substring(2, str.length);
  }

  return result;
}

contract("SignatureVerifier", () =>{
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
    this.minConfirmations = 2;
    this.confirmationThreshold = 5; //Confirmations per block before extra check enabled.
    this.excessConfirmations = 3; //Confirmations count in case of excess activity.

    //  constructor(
    //  uint256 _minConfirmations,
    //  uint256 _confirmationThreshold,
    //  uint256 _excessConfirmations,
    //  address _wrappedAssetAdmin,
    //  address _debridgeAddress
    //  )

    this.signatureVerifier = await SignatureVerifier.new(
      this.minConfirmations,
      this.confirmationThreshold,
      this.excessConfirmations,
      alice,
      ZERO_ADDRESS,
      {
        from: alice,
      }
    );
    this.initialOracles = [
      {
        address: alice,
        admin: alice,
      },
      {
        address: bob,
        admin: carol,
      },
      {
        address: eve,
        admin: carol,
      },
    ];
    this.debridge = await deployMockContract(aliceAccount, DebridgeGate.abi);
    this.wrappedAsset = await deployMockContract(aliceAccount, WrappedAsset.abi);
    this.signatureVerifier = await SignatureVerifier.new(this.minConfirmations,this.confirmationThreshold,this.excessConfirmations,
      eve, fei, {from:alice});
    
  });


  it('should set debrdige address', async()=>{
    await this.signatureVerifier.setDebridgeAddress(MOCK_ADDRESS, {from:alice});
    let result = await this.signatureVerifier.debridgeAddress();
    expect(result).to.be.equal(MOCK_ADDRESS);
  })

  it('should set threshdol fail wrong arguments', async()=>{
    await expectRevert(this.signatureVerifier.setThreshold(0),'WrongArgument()')
  })

  it('should set threshdol, work', async()=>{
    const value = '255';
    await this.signatureVerifier.setThreshold(value);
    let result = await this.signatureVerifier.confirmationThreshold();
    expect(result.toString()).to.be.equal(value);
  })

  it('should call version', async()=>{
    let result = await this.signatureVerifier.version();
    expect(result.toNumber()).to.be.equal(101);
  })

  it('should call submit, fail not confirmed', async()=>{
    const submissionId='0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed';
    const signature = await bobAccount.signMessage(parseHexString(submissionId)) 
    const oracle=ZERO_ADDRESS;
    const _confirmations=0; 
    const _hasVerified= true;
    await this.signatureVerifier.mock_set_oracle_valid(oracle,true);
    await this.signatureVerifier.setDebridgeAddress(alice);
    await expectRevert(this.signatureVerifier.submit(submissionId, signature,this.excessConfirmations),"SubmissionNotConfirmed()");
  })

  it('should call submit, oracle is valid false, submision has verified false', async()=>{
    const submissionId='0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed'; 
    const signature = await bobAccount.signMessage(parseHexString(submissionId))
    const oracle=bob;
    await this.signatureVerifier.mock_set_oracle_valid(oracle,false);
    await this.signatureVerifier.mock_set_min_confirmations(0);
    await this.signatureVerifier.setDebridgeAddress(alice);
    const recipe = await this.signatureVerifier.submit(
      submissionId, 
      signature, 
      0
    )

    expectEvent.notEmitted(recipe, 'Confirmed', 
    {
      submissionId: submissionId,
      operator: oracle,
    })

    expectEvent(recipe, 'SubmissionApproved', 
    {
      submissionId: submissionId
    })

    let submissionsInBlock = await this.signatureVerifier.submissionsInBlock();
    expect(submissionsInBlock.toNumber()).to.be.equal(1);
  })

  it('should call submit, fail not confirmed by required oracle', async()=>{
    const submissionId='0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed'; 
    let signature = await bobAccount.signMessage(parseHexString(submissionId))
    await this.signatureVerifier.mock_set_oracle_valid(bob, true);
    const oracle=ZERO_ADDRESS;
    await this.signatureVerifier.mock_set_oracle_valid(oracle,false);
    await this.signatureVerifier.mock_set_min_confirmations(0);
    await this.signatureVerifier.setDebridgeAddress(alice);
    await this.signatureVerifier.mock_set_required_oracles_count(10);
    await expectRevert(this.signatureVerifier.submit(submissionId, signature,this.excessConfirmations),'NotConfirmedByRequiredOracles()');
  })

  it('should call submit, oracle required true', async()=>{
    const submissionId='0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed'; 
    const signature = await bobAccount.signMessage(parseHexString(submissionId))
    await this.signatureVerifier.mock_set_oracle_valid(bob,true);
    await this.signatureVerifier.mock_set_min_confirmations(0);
    await this.signatureVerifier.setDebridgeAddress(alice);
    await this.signatureVerifier.mock_set_oracle_requires(bob,true);
    await this.signatureVerifier.mock_set_required_oracles_count(1);
    const recipe = await this.signatureVerifier.submit(
      submissionId, 
      signature, 
      0
    )

    expectEvent(recipe, 'Confirmed', 
    {
      submissionId: submissionId,
      operator: bob,
    })

    expectEvent(recipe, 'SubmissionApproved', 
    {
      submissionId: submissionId
    })

    let submissionsInBlock = await this.signatureVerifier.submissionsInBlock();
    expect(submissionsInBlock.toNumber()).to.be.equal(1);
  })

  it('should call submit, oracle is valid true, block is confirmed', async()=>{
    const submissionId='0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed'; 
    const signature = await bobAccount.signMessage(parseHexString(submissionId))
    const oracle=ZERO_ADDRESS;
    await this.signatureVerifier.mock_set_oracle_valid(oracle,true);
    await this.signatureVerifier.mock_set_min_confirmations(0);
    await this.signatureVerifier.setDebridgeAddress(alice);
    await this.signatureVerifier.mock_set_submissionsInBlock(1);
    let oldSubmissionsInBlock = await this.signatureVerifier.submissionsInBlock();
    expect(oldSubmissionsInBlock.toNumber()).to.be.equal(1);

    const block = await ethers.provider.getBlockNumber();
    await this.signatureVerifier.mock_set_currentBlock(block+2);
    const reciept = await this.signatureVerifier.submit(submissionId, signature,0);
    expectEvent(reciept, 'SubmissionApproved', 
    {
      submissionId: submissionId
    })

    let submissionsInBlock = await this.signatureVerifier.submissionsInBlock();
    expect(submissionsInBlock.toNumber()).to.be.above(oldSubmissionsInBlock.toNumber());

  })


  it('should call submit, fail not confirmed threshold', async()=>{
    const submissionId='0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed'; 
    const signature = await bobAccount.signMessage(parseHexString(submissionId))
    const oracle=ZERO_ADDRESS;
    const _block= 1; 
    const _confirmations=0; 
    const _hasVerified= false;
    await this.signatureVerifier.mock_set_oracle_valid(oracle,true);
    await this.signatureVerifier.mock_set_min_confirmations(0);
    await this.signatureVerifier.mock_set_confirmation_threshold(0);
    await this.signatureVerifier.mock_set_oracle_requires(oracle,true);
    await this.signatureVerifier.setDebridgeAddress(alice);
    await expectRevert(this.signatureVerifier.submit(submissionId, signature,this.excessConfirmations),"NotConfirmedThreshold()");
  })

  it('should call submit, work, global excess confirmations smaller then confirmations', async()=>{
    const submissionId='0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed'; 
    const signature = await bobAccount.signMessage(parseHexString(submissionId))
    const _block= 1; 
    const _confirmations=0; 
    const _hasVerified= false;
    await this.signatureVerifier.mock_set_oracle_valid(bob,true);
    await this.signatureVerifier.mock_set_min_confirmations(0);
    await this.signatureVerifier.mock_set_confirmation_threshold(0);
    await this.signatureVerifier.mock_set_oracle_requires(bob,true);
    await this.signatureVerifier.mock_set_required_oracles_count(1);
    await this.signatureVerifier.setDebridgeAddress(alice);
    await this.signatureVerifier.mock_set_excessConfirmations(0);
    const receipt = await this.signatureVerifier.submit(submissionId, signature,0);

    expectEvent(receipt, 'SubmissionApproved', 
    {
      submissionId: submissionId
    })
  })

  it('should call submit, fail debridge gate bad role', async()=>{
    await expectRevert(this.signatureVerifier.submit(
      MOCK_ADDRESS, 
      MOCK_SIGNATURE,
      0
    ),"DeBridgeGateBadRole()");
  })

  it('should call is valid signature', async()=>{
    await this.signatureVerifier.mock_set_oracle_valid(bob,true);
    const submissionId='0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed'; 
    const signatures = await bobAccount.signMessage(parseHexString(submissionId));
    let result = await this.signatureVerifier.isValidSignature(submissionId, signatures)
    expect(result).to.be.equal(true);
  })

});
