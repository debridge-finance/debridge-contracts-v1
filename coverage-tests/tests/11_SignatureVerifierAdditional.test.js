const { waffle } = require("hardhat")
const { deployMockContract } = waffle
const { expectRevert } = require("@openzeppelin/test-helpers");
const SignatureVerifier = artifacts.require("MockSignatureVerifierForTesting");
const DebridgeGate = artifacts.require("../build/DeBridgeGate.json");
const WrappedAsset = artifacts.require("../build/WrappedAsset.json");
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

  it('should set wrapped asset admin', async()=>{
    await this.signatureVerifier.setWrappedAssetAdmin(bob,{from: alice});
    let result = await this.signatureVerifier.wrappedAssetAdmin();
    expect(result.toString()).to.be.equal(bob);
  });

  it('should deploy asset, fail bad role', async()=>{
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const debridgeId = await this.signatureVerifier.getDebridgeId(chainId, tokenAddress);
    await expectRevert(this.signatureVerifier.deployAsset(debridgeId, {from:alice}), "deployAsset: bad role");
  })

  it('should deplpy asset, fail not found deploy id', async()=>{
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const debridgeId = await this.signatureVerifier.getDebridgeId(chainId, tokenAddress);
    await expectRevert(this.signatureVerifier.deployAsset(debridgeId, {from:fei}), "deployAsset: not found deployId");
  })

  it('should deplpy asset, fail deployed already', async()=>{
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const debridgeId = await this.signatureVerifier.getDebridgeId(chainId, tokenAddress);
    await this.signatureVerifier.mock_set_deployInfo(debridgeId, '0x7465737400000000000000000000000000000000000000000000000000000000')
    await this.signatureVerifier.mock_set_wrappedAssetAddress(debridgeId, bob);
    await expectRevert(this.signatureVerifier.deployAsset(debridgeId, {from:fei}), "deployAsset: deployed already");
  })

  it('should deplpy asset, fail not confirmed', async()=>{
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const debridgeId = await this.signatureVerifier.getDebridgeId(chainId, tokenAddress);
    await this.signatureVerifier.mock_set_deployInfo(debridgeId, '0x7465737400000000000000000000000000000000000000000000000000000000')
    await this.signatureVerifier.mock_set_wrappedAssetAddress(debridgeId, ZERO_ADDRESS);
    await expectRevert(this.signatureVerifier.deployAsset(debridgeId, {from:fei}), "deployAsset: not confirmed");
  })

  it('should deplpy asset, confirmed', async()=>{
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const debridgeId = await this.signatureVerifier.getDebridgeId(chainId, tokenAddress);
    await this.signatureVerifier.mock_set_deployInfo(debridgeId, '0x7465737400000000000000000000000000000000000000000000000000000000')
    await this.signatureVerifier.mock_set_wrappedAssetAddress(debridgeId, ZERO_ADDRESS);
    await this.signatureVerifier.mock_set_min_confirmations(0);
    await this.signatureVerifier.deployAsset(debridgeId, {from:fei});
  })

  it('should confirm new asset, fail deployed already', async()=>{
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const name = "Token";
    const symbol = "TKN";
    const decimal = 18;
    const debridgeId = await this.signatureVerifier.getDebridgeId(chainId, tokenAddress);
    const deployId = await this.signatureVerifier.getDeployId(debridgeId, name, symbol, decimal)
    await this.signatureVerifier.mock_set_wrappedAssetAddress(debridgeId, tokenAddress);
    await this.signatureVerifier.mock_set_deployInfo(debridgeId, deployId);
    await expectRevert(this.signatureVerifier.confirmNewAsset(tokenAddress,chainId,name,symbol,decimal,[]),"deployAsset: deployed already");
  })

  it('should confirm new asset, fail not confirmed', async()=>{
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const name = "Token";
    const symbol = "TKN";
    const decimal = 18;
    const debridgeId = await this.signatureVerifier.getDebridgeId(chainId, tokenAddress);
    const deployId = await this.signatureVerifier.getDeployId(debridgeId, name, symbol, decimal)
    await this.signatureVerifier.mock_set_wrappedAssetAddress(debridgeId, ZERO_ADDRESS);
    await this.signatureVerifier.mock_set_deployInfo(debridgeId, deployId);
    await expectRevert(this.signatureVerifier.confirmNewAsset(tokenAddress,chainId,name,symbol,decimal,[MOCK_SIGNATURE]),"not confirmed");
  })

  it('should confirm new asset, fail submted already', async()=>{
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const name = "Token";
    const symbol = "TKN";
    const decimal = 18;
    const debridgeId = await this.signatureVerifier.getDebridgeId(chainId, tokenAddress);
    const deployId = await this.signatureVerifier.getDeployId(debridgeId, name, symbol, decimal)
    await this.signatureVerifier.mock_set_wrappedAssetAddress(debridgeId, ZERO_ADDRESS);
    await this.signatureVerifier.mock_set_deployInfo(debridgeId, deployId);
    await this.signatureVerifier.mock_set_oracle_valid(ZERO_ADDRESS, true);
    await this.signatureVerifier.mock_set_oracle_hasVerified(deployId, ZERO_ADDRESS, true);
    await expectRevert(this.signatureVerifier.confirmNewAsset(tokenAddress,chainId,name,symbol,decimal,[MOCK_SIGNATURE]),"deployAsset: submitted already");
  })


  it('should confirm new asset, oracle required true, fail not confirmed by required oracles', async()=>{
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const name = "Token";
    const symbol = "TKN";
    const decimal = 18;
    const debridgeId = await this.signatureVerifier.getDebridgeId(chainId, tokenAddress);
    const deployId = await this.signatureVerifier.getDeployId(debridgeId, name, symbol, decimal)
    await this.signatureVerifier.mock_set_wrappedAssetAddress(debridgeId, ZERO_ADDRESS);
    await this.signatureVerifier.mock_set_deployInfo(debridgeId, deployId);
    await this.signatureVerifier.mock_set_oracle_valid(ZERO_ADDRESS, true);
    await this.signatureVerifier.mock_set_oracle_hasVerified(deployId, ZERO_ADDRESS, false);
    await this.signatureVerifier.mock_set_oracle_requires(ZERO_ADDRESS, true);
    await this.signatureVerifier.mock_set_min_confirmations(0);
    await expectRevert(this.signatureVerifier.confirmNewAsset(tokenAddress,chainId,name,symbol,decimal,[MOCK_SIGNATURE]),"Not confirmed by required oracles");
  })

  it('should confirm new asset, oracle required false, confirmed by required oracles', async()=>{
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const name = "Token";
    const symbol = "TKN";
    const decimal = 18;
    const debridgeId = await this.signatureVerifier.getDebridgeId(chainId, tokenAddress);
    const deployId = await this.signatureVerifier.getDeployId(debridgeId, name, symbol, decimal)
    await this.signatureVerifier.mock_set_wrappedAssetAddress(debridgeId, ZERO_ADDRESS);
    await this.signatureVerifier.mock_set_deployInfo(debridgeId, deployId);
    await this.signatureVerifier.mock_set_oracle_valid(ZERO_ADDRESS, true);
    await this.signatureVerifier.mock_set_oracle_hasVerified(deployId, ZERO_ADDRESS, false);
    await this.signatureVerifier.mock_set_oracle_requires(ZERO_ADDRESS, false);
    await this.signatureVerifier.mock_set_min_confirmations(0);
    await this.signatureVerifier.mock_set_required_oracles_count(0);
    await this.signatureVerifier.confirmNewAsset(tokenAddress,chainId,name,symbol,decimal,[MOCK_SIGNATURE]);
  })


  it('should set debrdige address', async()=>{
    await this.signatureVerifier.setDebridgeAddress(MOCK_ADDRESS, {from:alice});
    let result = await this.signatureVerifier.debridgeAddress();
    expect(result).to.be.equal(MOCK_ADDRESS);
  })

  it('should call submit, oracle is valid true, submision has verified true', async()=>{
    const submissionId=MOCK_ADDRESS; 
    const oracle=ZERO_ADDRESS;
    const _block= 1; 
    const _confirmations=0; 
    const _hasVerified= true;
    await this.signatureVerifier.mock_set_oracle_valid(oracle,true);
    await this.signatureVerifier.mock_set_submissionInfo(submissionId, oracle, _block, _confirmations, _hasVerified);
    await expectRevert(this.signatureVerifier.submit(submissionId,[MOCK_SIGNATURE]),"submit: submitted already");
  })

  it('should call submit, oracle is valid true, submision has verified false', async()=>{
    const submissionId=MOCK_ADDRESS; 
    const oracle=ZERO_ADDRESS;
    const _block= 1; 
    const _confirmations=0; 
    const _hasVerified= false;
    await this.signatureVerifier.mock_set_oracle_valid(oracle,true);
    await this.signatureVerifier.mock_set_submissionInfo(submissionId, oracle, _block, _confirmations, _hasVerified);
    await this.signatureVerifier.mock_set_min_confirmations(0);
    await this.signatureVerifier.submit(submissionId,[MOCK_SIGNATURE]);
  })

  it('should call submit, oracle is valid false, submision has verified false', async()=>{
    const submissionId=MOCK_ADDRESS; 
    const oracle=ZERO_ADDRESS;
    const _block= 1; 
    const _confirmations=0; 
    const _hasVerified= false;
    await this.signatureVerifier.mock_set_oracle_valid(oracle,false);
    await this.signatureVerifier.mock_set_submissionInfo(submissionId, oracle, _block, _confirmations, _hasVerified);
    await this.signatureVerifier.mock_set_min_confirmations(0);
    await this.signatureVerifier.submit(submissionId,[MOCK_SIGNATURE]);
  })

  it('should call submit, oracle is valid true, not enough min confirmations', async()=>{
    const submissionId=MOCK_ADDRESS; 
    const oracle=ZERO_ADDRESS;
    const _block= 1; 
    const _confirmations=0; 
    const _hasVerified= false;
    await this.signatureVerifier.mock_set_oracle_valid(oracle,true);
    await this.signatureVerifier.mock_set_submissionInfo(submissionId, oracle, _block, _confirmations, _hasVerified);
    await this.signatureVerifier.mock_set_min_confirmations(1000000);
    await this.signatureVerifier.submit(submissionId,[MOCK_SIGNATURE]);
  })

  it('should call submit, oracle is valid true, block is confirmed', async()=>{
    const submissionId=MOCK_ADDRESS; 
    const oracle=ZERO_ADDRESS;
    const _block= 1; 
    const _confirmations=0; 
    const _hasVerified= false;
    await this.signatureVerifier.mock_set_oracle_valid(oracle,true);
    await this.signatureVerifier.mock_set_submissionInfo(submissionId, oracle, _block, _confirmations, _hasVerified);
    await this.signatureVerifier.mock_set_min_confirmations(0);
    const block = await ethers.provider.getBlockNumber();
    await this.signatureVerifier.mock_set_block_confirmations(submissionId, block+2, true);
    await this.signatureVerifier.submit(submissionId,[MOCK_SIGNATURE]);
  })


  it('should call submit, oracle is valid true, submision has verified false, oracle info  required, go in confirmations threshold block', async()=>{
    const submissionId=MOCK_ADDRESS; 
    const oracle=ZERO_ADDRESS;
    const _block= 1; 
    const _confirmations=0; 
    const _hasVerified= false;
    await this.signatureVerifier.mock_set_oracle_valid(oracle,true);
    await this.signatureVerifier.mock_set_submissionInfo(submissionId, oracle, _block, _confirmations, _hasVerified);
    await this.signatureVerifier.mock_set_min_confirmations(0);
    await this.signatureVerifier.mock_set_confirmation_threshold(0);
    await this.signatureVerifier.mock_set_oracle_requires(oracle,true);
    await expectRevert(this.signatureVerifier.submit(submissionId,[MOCK_SIGNATURE]),"Not confirmed by required oracles");
  })


  /*it('should call submit', async()=>{
    const submissionId = keccak256(
      defaultAbiCoder.encode(
        ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
        [
          bob,
          alice,
        ]
      ))
    
    this.signatureVerifier.submit(submissionId, [signature])
  })*/
});
