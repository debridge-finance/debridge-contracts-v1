const { waffle, ethers, expect } = require("hardhat")
const { expectRevert } = require("@openzeppelin/test-helpers");
const expectEvent = require("@openzeppelin/test-helpers/src/expectEvent");
const ConfirmationAggregator = artifacts.require("MockConfirmationAggregator");
const { toWei, fromWei, toBN } = web3.utils;
const ZERO_ADDRESS   = "0x0000000000000000000000000000000000000000";
const MOCK_ADDRESS   = "0x0000000000000000000000000000000000000001";
const MOCK_BYTES32   = '0X08e9f6e736749207285bb00559dd3ac2ab5e95dc6756e60733c13dbd110d9aec';
const MOCK_BYTES32_2 = '0X08e9f6e736749207285bb00559dd3ac2ab5e95dc6756e60733c13dbd110d9aee'
const MOCK_PERMIT    = '0x73776076d1d562764a521239b8acdb6249d791f2a691a922e301474d90afb396'
const MOCK_PERMIT_2  = '0x73776076d1d562764a521239b8acdb6249d791f2a691a922e301474d90afb399'



contract("ConfirmationAggregator", function() {
  beforeEach(async function(){

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
    this.confirmationThreshold = 5;
    this.excessConfirmations = 3;

    // constructor(
    //   uint256 _minConfirmations,
    //   uint256 _confirmationThreshold,
    //   uint256 _excessConfirmations,
    //   address _wrappedAssetAdmin,
    //   address _debridgeAddress
    // )

    this.aggregator = await ConfirmationAggregator.new(
      this.minConfirmations,
      this.confirmationThreshold,
      this.excessConfirmations,
    );
    this.initialOracles = [
      {
          address: bob,
          required: false,
      },
      {
          address: carol,
          required: false,
      }
    ];
    oracleAddresses=[];
    oracleRequired=[]
    for (let oracle of this.initialOracles) {
      oracleAddresses.push(oracle.address);
      oracleRequired.push(oracle.required);
    }
    await this.aggregator.addOracles(oracleAddresses, oracleRequired, {
      from: alice,
    });
  });

  it('should submit many, by oracle, should succeed', async function(){
    const submissions = ['0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed',
     '0x2a16bc164de069184383a55bbddb893f418fd72781f5b2db1b68de1dc697ea44']
    await this.aggregator.submitMany(submissions,{from:bob})
    let submitInfo = await this.aggregator.getSubmissionInfo(submissions[0])
    expect(submitInfo.confirmations.toNumber()).to.equal(1)
    submitInfo = await this.aggregator.getSubmissionInfo(submissions[1])
    expect(submitInfo.confirmations.toNumber()).to.equal(1)
  })

  it("should set min confirmations, as admin, should succeed", async function(){
    await this.aggregator.setMinConfirmations(5,{from:alice});
    let minConfirmations = await this.aggregator.minConfirmations();
    expect(minConfirmations.toNumber()).to.be.equal(5);
  })

  it('should set min confirmations, not as admin, should fail', async function(){
      await expectRevert(this.aggregator.setMinConfirmations(5, {from:bob}),"AdminBadRole()");
  })


  it('should update oracle, fail not exist', async function(){
    await this.aggregator.mock_set_oracle_exist(alice, false);
    await expectRevert(this.aggregator.updateOracle(alice, true,true),"OracleNotFound()");
  })

  it('should confirm new asset, fail deployed already', async function(){
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const name = "Token";
    const symbol = "TKN";
    const decimal = 18;
    const debridgeId = await this.aggregator.getDebridgeId(chainId, tokenAddress);
    const deployId = await this.aggregator.getDeployId(debridgeId, name, symbol, decimal)
    await this.aggregator.mock_set_debridgeInfoHasVerrified(deployId, bob, true);
    await expectRevert(this.aggregator.confirmNewAsset(tokenAddress,chainId,name,symbol,decimal,{from:bob}),"SubmittedAlready");
  })


  it('should confirm new asset, oracle required true', async function() {
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const name = "Token";
    const symbol = "TKN";
    const decimal = 18;
    const debridgeId = await this.aggregator.getDebridgeId(chainId, tokenAddress);
    const deployId = await this.aggregator.getDeployId(debridgeId, name, symbol, decimal)
    await this.aggregator.mock_set_debridgeInfoHasVerrified(deployId, bob, false);
    await this.aggregator.mock_set_oracle_required(bob,true);
    const receipt = await this.aggregator.confirmNewAsset(
      tokenAddress,
      chainId,
      name,
      symbol,
      decimal,
      {
        from:bob
      });
    expectEvent(receipt,'DeployConfirmed',
    {
      deployId: deployId,
      operator: bob,
    })
    let deployInfo = await this.aggregator.getDeployInfo(deployId);
    expect(deployInfo.name).to.be.equal(name);
    expect(deployInfo.symbol).to.be.equal(symbol);
    expect(deployInfo.nativeAddress).to.be.equal(tokenAddress);
    expect(deployInfo.decimals.toNumber()).to.be.equal(decimal);
    expect(deployInfo.chainId.toNumber()).to.be.equal(chainId);

    let confirmedDeployInfo = await this.aggregator.confirmedDeployInfo(debridgeId);
    expect(confirmedDeployInfo).to.be.not.equal(deployId);
  })

  it('should confirm new asset, oracle required false and min confirmation 0', async function(){
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const name = "Token";
    const symbol = "TKN";
    const decimal = 18;
    const debridgeId = await this.aggregator.getDebridgeId(chainId, tokenAddress);
    const deployId = await this.aggregator.getDeployId(debridgeId, name, symbol, decimal)
    await this.aggregator.mock_set_minConfirmations(0);
    await this.aggregator.mock_set_debridgeInfoHasVerrified(deployId, bob, false);
    await this.aggregator.mock_set_oracle_required(bob,false);
    const receipt = await this.aggregator.confirmNewAsset(
      tokenAddress,
      chainId,
      name,
      symbol,
      decimal,
      {
        from:bob
      });
      expectEvent(receipt,'DeployConfirmed',
      {
        deployId: deployId,
        operator: bob,
      })
      let deployInfo = await this.aggregator.getDeployInfo(deployId);
      expect(deployInfo.name).to.be.equal(name);
      expect(deployInfo.symbol).to.be.equal(symbol);
      expect(deployInfo.nativeAddress).to.be.equal(tokenAddress);
      expect(deployInfo.decimals.toNumber()).to.be.equal(decimal);
      expect(deployInfo.chainId.toNumber()).to.be.equal(chainId);

      let confirmedDeployInfo = await this.aggregator.confirmedDeployInfo(debridgeId);
      expect(confirmedDeployInfo).to.be.equal(deployId);
  })

  it('should call internal submit function if path', async function(){
    const sender = alice;
    const confirmations = 100;
    const hasVerified = false;
    const isConfirmed = false;
    const requiredConfirmations = 3;
    await this.aggregator.mock_set_confirmationThreashold(100);
    await this.aggregator.mock_set_requiredOraclesCount(3);
    await this.aggregator.mock_set_submmisionInfo(MOCK_ADDRESS, sender, confirmations, hasVerified, isConfirmed,requiredConfirmations);
    let oldSubmissionsInBlock = await this.aggregator.submissionsInBlock();
    const receipt = await this.aggregator.call_internal_submit(MOCK_ADDRESS);

    expectEvent(receipt,'Confirmed',
    {
      submissionId: MOCK_ADDRESS.concat('000000000000000000000000'),
      operator: alice,
    })


    expectEvent(receipt,'SubmissionApproved',
    {
      submissionId: MOCK_ADDRESS.concat('000000000000000000000000'),
    })

    let submisionInfo = await this.aggregator.getSubmissionInfo(MOCK_ADDRESS);
    expect(submisionInfo.isConfirmed).to.be.equal(true);

    let submissionsInBlock = await this.aggregator.submissionsInBlock();
    expect(submissionsInBlock.toNumber()).to.be.above(oldSubmissionsInBlock.toNumber());
  })


  it('should update oracle, should fail, oracle not found', async function(){
    await expectRevert(this.aggregator.updateOracle(alice,true, true, {from:alice}),'OracleNotFound()')
  })

  it('should update oracle', async function(){
    await this.aggregator.updateOracle(bob, true, true, {from:alice});
    let result = await this.aggregator.getOracleInfo(bob);
    expect(result.required).to.be.equal(true);
    expect(result.isValid).to.be.equal(true);
  })

  it('should update oracle admin, fail only callable by admin', async function(){
    await expectRevert(this.aggregator.updateOracle(bob, true,true,{from:bob}),"AdminBadRole()");
  })

  it('should set min confirmations, fail should low min confirmations', async function(){
    await expectRevert(this.aggregator.setMinConfirmations(0,{from:alice}),"LowMinConfirmations()");
  });

  if('should update oracle, fail not exist', async function(){
    const randomOracle = '0x52cAd5af5E24Acf36dF3D8f327f28c0b0e212719';
    await expectRevert(this.aggregator.updateOracle(randomOracle, true,true),"Not exist");
  })

  it('should update oracle, fail wrong arguments', async function(){
    await expectRevert(this.aggregator.updateOracle(alice,false,true),"WrongArgument()");
  })


  it('should update oracle, should succeed, oracle required true and internal required false', async function(){
    await this.aggregator.mock_set_requiredOraclesCount(1);
    await this.aggregator.mock_set_oracle_exist(alice, true);
    await this.aggregator.mock_set_oracle_required(alice, true)
    await this.aggregator.updateOracle(alice, true,false);
    const oraclesCount = await this.aggregator.requiredOraclesCount();
    expect(oraclesCount.toNumber()).to.be.equal(0);
  })

  it('should update oracle, should succeed, oracle required false and internal required false', async function(){
    await this.aggregator.mock_set_requiredOraclesCount(1);
    await this.aggregator.mock_set_oracle_exist(alice, true);
    await this.aggregator.mock_set_oracle_required(alice, false)
    await this.aggregator.updateOracle(alice, true,false);
    const oraclesCount = await this.aggregator.requiredOraclesCount();
    expect(oraclesCount.toNumber()).to.be.equal(1);
  })

  it('should set confirmation threshold', async function(){
    await this.aggregator.setThreshold(1, {from:alice});
    let result = await this.aggregator.confirmationThreshold();
    expect(result.toNumber()).to.be.equal(1);
  })

  it('should set confirmation threshold, fail wrong arguments', async function(){
    await expectRevert(this.aggregator.setThreshold(0, {from:alice}),"WrongArgument()");

  })

  it('should set excess confirmations', async function(){
    await this.aggregator.setExcessConfirmations(255, {from:alice});
    let result = await this.aggregator.excessConfirmations();
    expect(result.toNumber()).to.be.equal(255);
  })

  it('should set excess confirmations, fail low min confirmations', async function(){
    await expectRevert(this.aggregator.setExcessConfirmations(
      0, {from:alice}
    ),"LowMinConfirmations()");
  })

  it('should call submit as not an oracle, fail bad role', async function(){
    await expectRevert(this.aggregator.submit(MOCK_ADDRESS, {from:devid}),"OracleBadRole()");
  })

  it('should call submit, as oracle, fail submited already', async function(){
    await this.aggregator.submit(MOCK_ADDRESS, {from:bob});
    await expectRevert(this.aggregator.submit(MOCK_ADDRESS, {from:bob}),"SubmittedAlready()")
  })

  it('should call submit, as oracle, required true, go inside block confirmations condition', async function(){
    await this.aggregator.mock_set_minConfirmations(0);
    await this.aggregator.mock_set_requiredOraclesCount('255')
    await this.aggregator.mock_set_oracle_required(bob, true)
    const currentBlock = await ethers.provider.getBlockNumber();
    await this.aggregator.mock_set_blockConfirmationsInfoIsConfirmed(MOCK_ADDRESS,currentBlock+3,false)
    const receipt = await this.aggregator.submit(MOCK_ADDRESS, {from:bob});

    expectEvent(receipt,'Confirmed',
    {
      submissionId: MOCK_ADDRESS.concat('000000000000000000000000'),
      operator: bob,
    })

    let submisionInfo = await this.aggregator.getSubmissionInfo(MOCK_ADDRESS);
    expect(submisionInfo.isConfirmed).to.be.equal(false);

    let submissionsInBlock = await this.aggregator.submissionsInBlock();
    expect(submissionsInBlock.toNumber()).to.be.equal(0);
  })


  it('should call submit, as oracle, required true, not go inside block confirmations condition', async function(){
    await this.aggregator.mock_set_minConfirmations(0);
    await this.aggregator.mock_set_requiredOraclesCount('255')
    await this.aggregator.mock_set_oracle_required(bob, true)
    const currentBlock = await ethers.provider.getBlockNumber();
    await this.aggregator.mock_set_blockConfirmationsInfoIsConfirmed(MOCK_ADDRESS,currentBlock+2,true)
    const receipt = await this.aggregator.submit(MOCK_ADDRESS, {from:bob});

    expectEvent(receipt,'Confirmed',
    {
      submissionId: MOCK_ADDRESS.concat('000000000000000000000000'),
      operator: bob,
    })

    expectEvent.notEmitted(receipt,'SubmissionApproved',
    {
      submissionId: MOCK_ADDRESS.concat('000000000000000000000000'),
    })

    let submisionInfo = await this.aggregator.getSubmissionInfo(MOCK_ADDRESS);
    expect(submisionInfo.isConfirmed).to.be.equal(false);

    let submissionsInBlock = await this.aggregator.submissionsInBlock();
    expect(submissionsInBlock.toNumber()).to.be.equal(0);
  })

  it('should call submit, as oracle, current block same value ', async function(){
    await this.aggregator.mock_set_minConfirmations(0);
    await this.aggregator.mock_set_requiredOraclesCount('255')
    await this.aggregator.mock_set_oracle_required(bob, true)
    const currentBlock = await ethers.provider.getBlockNumber();
    await this.aggregator.mock_set_currentBlock(currentBlock+2);
    const receipt = await this.aggregator.submit(MOCK_ADDRESS, {from:bob});

    expectEvent(receipt,'Confirmed',
    {
      submissionId: MOCK_ADDRESS.concat('000000000000000000000000'),
      operator: bob,
    })

    expectEvent.notEmitted(receipt,'SubmissionApproved',
    {
      submissionId: MOCK_ADDRESS.concat('000000000000000000000000'),
    })

    let submisionInfo = await this.aggregator.getSubmissionInfo(MOCK_ADDRESS);
    expect(submisionInfo.isConfirmed).to.be.equal(false);

    let submissionsInBlock = await this.aggregator.submissionsInBlock();
    expect(submissionsInBlock.toNumber()).to.be.equal(0);
  })


  it('should call submit, as oracle, fail submitted already', async function(){
    await this.aggregator.mock_set_minConfirmations(0);
    await this.aggregator.mock_set_requiredOraclesCount('255')
    await this.aggregator.mock_set_oracle_required(bob, true)
    const currentBlock = await ethers.provider.getBlockNumber();
    await this.aggregator.mock_set_blockConfirmationsInfoIsConfirmed(MOCK_ADDRESS,currentBlock+2,true)
    await this.aggregator.submit(MOCK_ADDRESS, {from:bob});

    await expectRevert(this.aggregator.submit(MOCK_ADDRESS, {from:bob}),"SubmittedAlready()");
  })

  it('should get submission confirmations', async function(){
   let result =  await this.aggregator.getSubmissionConfirmations(MOCK_ADDRESS);
   expect(result[0].toNumber()).to.be.equal(0);
   expect(result[1]).to.be.equal(false);
  })

  it('should call getConfirmedDeployId', async function(){
    await this.aggregator.mock_setConfirmedDeployInfo(MOCK_PERMIT, MOCK_PERMIT_2);
    let result = await this.aggregator.getConfirmedDeployId(MOCK_PERMIT);
    expect(result.toString()).to.be.equal(MOCK_PERMIT_2);
  })

  it('should call version', async function() {
    let result = await this.aggregator.version();
    expect(result.toNumber()).to.be.equal(101);
  })

  it('should add oracle, fail wrong arguments', async function(){
    await expectRevert(this.aggregator.addOracles([bob],[true,true,true]),"WrongArgument()");
  })

  it('should add oracle,  fail low min confirmations', async function(){
    await this.aggregator.mock_set_minConfirmations(0);
    await expectRevert(this.aggregator.addOracles([alice],[true]),"LowMinConfirmations()");
  })

  it('should add oracle, fail already exist', async function(){
    await this.aggregator.mock_set_minConfirmations(255);
    await expectRevert(this.aggregator.addOracles([bob],[true]),"OracleAlreadyExist()");
  })

  it('should add oracle, should work requried true ', async function(){
    await this.aggregator.mock_set_minConfirmations(255);
    const receipt = await this.aggregator.addOracles([alice],[true]);
    expectEvent(receipt, 'AddOracle',
    {
      oracle: alice,
      required: true,
    })

    let oracleInfo = await this.aggregator.getOracleInfo(alice);
    expect(oracleInfo.exist).to.be.equal(true);
    expect(oracleInfo.isValid).to.be.equal(true);
    expect(oracleInfo.required).to.be.equal(true);
  })

  it('should update oracle, oracle info is valid true and is valid local false, oracle on index', async function(){
    await this.aggregator.mock_set_oracle_exist(bob,true);
    await this.aggregator.mock_set_oracle_required(bob,false);
    await this.aggregator.mock_set_oracle_isValid(bob,true);
    const receipt = await this.aggregator.updateOracle(bob,false,false);
    expectEvent(receipt, 'UpdateOracle',
    {
      oracle: bob,
      required: false,
      isValid: false,
    })

    let oracleInfo = await this.aggregator.getOracleInfo(bob);
    expect(oracleInfo.exist).to.be.equal(true);
    expect(oracleInfo.isValid).to.be.equal(false);
    expect(oracleInfo.required).to.be.equal(false);
  })

  it('should update oracle, oracle info is valid true and is valid local false, oracle not on index', async function(){
    await this.aggregator.mock_set_oracle_exist(alice,true);
    await this.aggregator.mock_set_oracle_required(alice,false);
    await this.aggregator.mock_set_oracle_isValid(alice,true);
    const receipt = await this.aggregator.updateOracle(alice,false,false);

    expectEvent(receipt, 'UpdateOracle',
    {
      oracle: alice,
      required: false,
      isValid: false,
    })

    let oracleInfo = await this.aggregator.getOracleInfo(alice);
    expect(oracleInfo.exist).to.be.equal(true);
    expect(oracleInfo.isValid).to.be.equal(false);
    expect(oracleInfo.required).to.be.equal(false);
  })


  it('should update oracle, oracle info is valid false and is valid local true, fail min confirmations', async function(){
    await this.aggregator.mock_set_oracle_exist(alice,true);
    await this.aggregator.mock_set_oracle_required(alice,false);
    await this.aggregator.mock_set_oracle_isValid(alice,false);
    await this.aggregator.mock_set_minConfirmations(0);
    await expectRevert(this.aggregator.updateOracle(alice,true,false),"LowMinConfirmations()");
  })

  it('should initialize new aggregator, fail low min confirmations', async function(){
    const minConfirmations = 0;
    const excessConfirmations = 0;
    await expectRevert(this.aggregator.mock_call_internal_initialize_base(
      minConfirmations,
      excessConfirmations
    ),"LowMinConfirmations()");

  })

});
