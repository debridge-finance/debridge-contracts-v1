const { waffle, ethers } = require("hardhat")
const { expectRevert } = require("@openzeppelin/test-helpers");
const ConfirmationAggregator = artifacts.require("MockConfirmationAggregator");
const { toWei, fromWei, toBN } = web3.utils;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MOCK_ADDRESS = "0x0000000000000000000000000000000000000001";

contract("ConfirmationAggregator", function([alice, bob, carol, eve, devid]) {
  beforeEach(async function() {
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
      alice,
      devid,
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
    for (let oracle of this.initialOracles) {
      await this.aggregator.addOracle(oracle.address, oracle.admin, false, {
        from: alice,
      });
    }
  });
  it("should set wrapped asset admin by admin", async function(){
    await this.aggregator.setWrappedAssetAdmin('0x5B518A7ede2De53668496cb991542BF6a94051C1', {from:alice})
    let admin = await this.aggregator.wrappedAssetAdmin()
    expect(admin).to.equal('0x5B518A7ede2De53668496cb991542BF6a94051C1')
  })

  it('should submit many, by oracle, should succeed', async function(){
    const submissions = ['0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed',
     '0x2a16bc164de069184383a55bbddb893f418fd72781f5b2db1b68de1dc697ea44']
    await this.aggregator.submitMany(submissions,{from:bob})
    let submitInfo = await this.aggregator.getSubmissionInfo(submissions[0])
    expect(submitInfo.confirmations.toNumber()).to.equal(1)
    submitInfo = await this.aggregator.getSubmissionInfo(submissions[1])
    expect(submitInfo.confirmations.toNumber()).to.equal(1)
  })
  
  it("should deploy asset, should work", async function(){
    await this.aggregator.mock_set_minConfirmations(0);
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const debridgeId = await this.aggregator.getDebridgeId(chainId, tokenAddress);
    await this.aggregator.mock_setConfirmedDeployInfo(debridgeId, tokenAddress)
    await this.aggregator.deployAsset(debridgeId, {
        from: devid,
      })
  })


  it("should deploy asset, sanity checks, bad role, should fail", async function(){
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const debridgeId = await this.aggregator.getDebridgeId(chainId, tokenAddress);
    await expectRevert(
      this.aggregator.deployAsset(debridgeId, {
        from: alice,
      }),
      "deployAsset: bad role"
    );
  })

  it("should deploy asset, sanity checks, deployId not found, should fail", async function(){
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const debridgeId = await this.aggregator.getDebridgeId(chainId, tokenAddress);
    await expectRevert(
      this.aggregator.deployAsset(debridgeId, {
        from: devid,
      }),
      "deployAsset: not found deployId"
    );
  })

  it("should deploy asset, sanity checks, asset deployed already, should fail", async function(){
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const debridgeId = await this.aggregator.getDebridgeId(chainId, tokenAddress);
    await this.aggregator.mock_setConfirmedDeployInfo(debridgeId, "0x000000000000000000000000000000000000084")
    await this.aggregator.mock_setWrappedAssetAddress(debridgeId,MOCK_ADDRESS)
    await expectRevert(
      this.aggregator.deployAsset(debridgeId, {
        from: devid,
      }),
      "deployAsset: deployed already"
    );
  })

  it("should deploy asset, sanity checks, asset not confirmed, should fail", async function(){
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const debridgeId = await this.aggregator.getDebridgeId(chainId, tokenAddress);
    await this.aggregator.mock_setConfirmedDeployInfo(debridgeId, "0x000000000000000000000000000000000000084")
    await this.aggregator.mock_setWrappedAssetAddress(debridgeId,ZERO_ADDRESS)
    await expectRevert(
      this.aggregator.deployAsset(debridgeId, {
        from: devid,
      }),
      "deployAsset: not confirmed"
    );
  })

  it("should set min confirmations, as admin, should succeed", async function(){
 
    await this.aggregator.setMinConfirmations(5,{from:alice});

  })

  it('should set min confirmations, not as admin, should fail', async function(){
      await expectRevert(this.aggregator.setMinConfirmations(5, {from:bob}),"onlyAdmin: bad role");
  })


  it('shoud add new oracle, admin', async function(){

    await this.aggregator.addOracle(devid,alice,true);
  
  })

  it('should update oracle, fail not exist', async function(){
    await this.aggregator.mock_set_oracle_exist(alice, false);
    await expectRevert(this.aggregator.updateOracle(alice, true,true),"Not exist");
  })

  it('should confirm new asset, fail deployed already', async function(){
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const name = "Token";
    const symbol = "TKN";
    const decimal = 18;
    const debridgeId = await this.aggregator.getDebridgeId(chainId, tokenAddress);
    const deployId = await this.aggregator.getDeployId(debridgeId, name, symbol, decimal)
    await this.aggregator.mock_setWrappedAssetAddress(debridgeId, MOCK_ADDRESS);
    await this.aggregator.mock_set_debridgeInfoHasVerrified(deployId, alice, true);
    await expectRevert(this.aggregator.confirmNewAsset(tokenAddress,chainId,name,symbol,decimal),"deployAsset: deployed already");
  })

  it('should confirm new asset, fail submitted already', async function(){
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const name = "Token";
    const symbol = "TKN";
    const decimal = 18;
    const debridgeId = await this.aggregator.getDebridgeId(chainId, tokenAddress);
    const deployId = await this.aggregator.getDeployId(debridgeId, name, symbol, decimal)
    await this.aggregator.mock_setWrappedAssetAddress(debridgeId, ZERO_ADDRESS);
    await this.aggregator.mock_set_debridgeInfoHasVerrified(deployId, alice, true);
    await expectRevert(this.aggregator.confirmNewAsset(tokenAddress,chainId,name,symbol,decimal),"deployAsset: submitted already");
  })

  it('should confirm new asset, oracle required true', async function(){
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const name = "Token";
    const symbol = "TKN";
    const decimal = 18;
    const debridgeId = await this.aggregator.getDebridgeId(chainId, tokenAddress);
    const deployId = await this.aggregator.getDeployId(debridgeId, name, symbol, decimal)
    await this.aggregator.mock_setWrappedAssetAddress(debridgeId, ZERO_ADDRESS);
    await this.aggregator.mock_set_debridgeInfoHasVerrified(deployId, alice, false);
    await this.aggregator.mock_set_oracle_required(alice,true);
    this.aggregator.confirmNewAsset(tokenAddress,chainId,name,symbol,decimal);
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
    await this.aggregator.mock_setWrappedAssetAddress(debridgeId, ZERO_ADDRESS);
    await this.aggregator.mock_set_debridgeInfoHasVerrified(deployId, alice, false);
    await this.aggregator.mock_set_oracle_required(alice,false);
    this.aggregator.confirmNewAsset(tokenAddress,chainId,name,symbol,decimal);
  })

  it('should call internal submit function if path', async function(){
    const sender = alice; 
    const _block = 3;
    const confirmations = 100;
    const hasVerified = false; 
    const isConfirmed = true; 
    const requiredConfirmations = 3;
    await this.aggregator.mock_set_confirmationThreashold(0);
    await this.aggregator.mock_set_submmisionInfo(MOCK_ADDRESS, sender, _block, confirmations, hasVerified, isConfirmed,requiredConfirmations);
    await this.aggregator.call_internal_submit(MOCK_ADDRESS);
  })

  it('should call internal submit function else path', async function(){
    const sender = alice; 
    const _block = 1795;
    const confirmations = 100;
    const hasVerified = false; 
    const isConfirmed = true; 
    const requiredConfirmations = 3;
    await this.aggregator.mock_set_confirmationThreashold(0);
    await this.aggregator.mock_set_submmisionInfo(MOCK_ADDRESS, sender, _block, confirmations, hasVerified, isConfirmed,requiredConfirmations);
    await this.aggregator.mock_set_blockConfirmationsInfoIsConfirmed(MOCK_ADDRESS, _block, true);
    await this.aggregator.call_internal_submit(MOCK_ADDRESS);
  })


  it('should update oracle admin', async function(){
    await this.aggregator.updateOracleAdmin(alice,bob, {from:alice})
  })

  it('should update oracle', async function(){
    await this.aggregator.updateOracle(alice, true, true, {from:alice})
  })

  it('should update oracle admin, fail only callable by admin', async function(){
    await expectRevert(this.aggregator.updateOracleAdmin(eve, bob,{from:bob}),"only callable by admin");
  })

  it('should set min confirmations, fail should be greatern then zero', async function(){
    await expectRevert(this.aggregator.setMinConfirmations(0,{from:alice}),"Must be greater than zero");
  });

  it("should add oracle, fail already exist", async function(){
    await expectRevert(this.aggregator.addOracle(alice,alice,true, {from:alice}),"Already exist");
  })

  if('should update oracle, fail not exist', async function(){
    const randomOracle = '0x52cAd5af5E24Acf36dF3D8f327f28c0b0e212719';
    await expectRevert(this.aggregator.updateOracle(randomOracle, true,true),"Not exist");
  })

  it('should update oracle, fail need to disable require', async function(){
    await expectRevert(this.aggregator.updateOracle(alice,false,true),"Need to disable required");
  })

  it("update oracle, should succeed update require", async function(){
    await this.aggregator.updateOracle(alice,true,true);
  })

  it("should update oracle admin by owner, fail not exist", async function(){
    const randomOracle = '0x52cAd5af5E24Acf36dF3D8f327f28c0b0e212719';
    await expectRevert(this.aggregator.updateOracleAdminByOwner(randomOracle,alice),"Not exist");
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

  it('should update oracle admin by owner, should succeed, update oracle', async function(){
    await this.aggregator.mock_set_oracle_exist(alice, true);
    await this.aggregator.updateOracleAdminByOwner(alice, bob);
  })

  it('should set debridge address', async function(){
    await this.aggregator.setDebridgeAddress(MOCK_ADDRESS, {from:alice})
    let result = await this.aggregator.debridgeAddress();
    expect(result).to.be.equal(MOCK_ADDRESS);
  })

  it('should set confirmation threshold', async function(){
    await this.aggregator.setThreshold(0, {from:alice});
    let result = await this.aggregator.confirmationThreshold();
    expect(result.toNumber()).to.be.equal(0);
  })

  it('should set excess confirmations', async function(){
    await this.aggregator.setExcessConfirmations(0, {from:alice});
    let result = await this.aggregator.excessConfirmations();
    expect(result.toNumber()).to.be.equal(0);
  })

  it('should call submit as not an oracle, fail bad role', async function(){
    await expectRevert(this.aggregator.submit(MOCK_ADDRESS, {from:devid}),"onlyOracle: bad role");
  })

  it('should call submit, as oracle, fail submited already', async function(){
    await this.aggregator.submit(MOCK_ADDRESS, {from:alice});
    await expectRevert(this.aggregator.submit(MOCK_ADDRESS, {from:alice}),"submit: submitted already")
  })

  it('should call submit, as oracle, required true, go inside block confirmations condition', async function(){
    await this.aggregator.mock_set_minConfirmations(0);
    await this.aggregator.mock_set_requiredOraclesCount('1000000000000000000000000000')
    await this.aggregator.mock_set_oracle_required(alice, true)
    const currentBlock = await ethers.provider.getBlockNumber();
    await this.aggregator.mock_set_blockConfirmationsInfoIsConfirmed(MOCK_ADDRESS,currentBlock+3,false)
    await this.aggregator.submit(MOCK_ADDRESS, {from:alice});
  })

  it('should call submit, as oracle, required true, not go inside block confirmations condition', async function(){
    await this.aggregator.mock_set_minConfirmations(0);
    await this.aggregator.mock_set_requiredOraclesCount('1000000000000000000000000000')
    await this.aggregator.mock_set_oracle_required(alice, true)
    const currentBlock = await ethers.provider.getBlockNumber();
    await this.aggregator.mock_set_blockConfirmationsInfoIsConfirmed(MOCK_ADDRESS,currentBlock+2,true)
    await this.aggregator.submit(MOCK_ADDRESS, {from:alice});
  })

  it('should get submission confirmations', async function(){
   let result =  await this.aggregator.getSubmissionConfirmations(MOCK_ADDRESS);
   expect(result[0].toNumber()).to.be.equal(0);
   expect(result[1]).to.be.equal(false);
  })

});
