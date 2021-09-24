const { waffle, artifacts } = require("hardhat")
const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS, permit } = require("./utils.spec");
const ConfirmationAggregator = artifacts.require("ConfirmationAggregator");
const ConfirmationAggregatorABI = artifacts.require("../build/ConfirmationAggregator.json")
const MockLinkToken = artifacts.require("MockLinkToken");
const MockToken = artifacts.require("MockToken");
const WrappedAsset = artifacts.require("WrappedAsset");
const FeeProxy = artifacts.require("FeeProxy");
const CallProxy = artifacts.require("CallProxy");
const MockCallProxyABI = artifacts.require("../build/CallProxy.json");
const IUniswapV2Pair = artifacts.require("IUniswapV2Pair");
const DefiController = artifacts.require("DefiController");
const FlashReceiver = artifacts.require("MockFlashReceiver");
const FlashReceiverBroken = artifacts.require("MockFlashReceiverBroken");
const SignatureVerifier = artifacts.require("SignatureVerifier");
const SignatureVerifierABI = artifacts.require("../build/SignatureVerifier.json");
const MockTokenABI = artifacts.require("../buil/MockToken.json");
const MockDefiController = artifacts.require("MockDefiController");
const MockFeeProxy = artifacts.require("../build/FeeProxy.json");
const WrappedAssetABI = artifacts.require("../build/WrappedAsset.json");
const DefiControllerABI = artifacts.require("../build/DefiController.json"); 
const MockAdminSetter = artifacts.require("MockAdminSetter");
//const MockWETHABI = artifacts.require("../build/WETH9.json");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const { toWei} = web3.utils;
const { BigNumber } = require("ethers")
const MOCK_ADDRESS = '0x0000000000000000000000000000000000000001';

const expectEvent = require("@openzeppelin/test-helpers/src/expectEvent");
const { deployMockContract } = waffle
const provider = waffle.provider;
const { DeBridgeGate } = require('../build/contracts/DeBridgeGate.json');
const { keccak256 } = require("@ethersproject/keccak256");
const { solidityPack } = require("ethers/lib/utils");
function toBN(number){
    return BigNumber.from(number.toString())
  }
  
const MAX = web3.utils.toTwosComplement(-1);
const bobPrivKey =
    "0x79b2a2a43a1e9f325920f99a720605c9c563c61fb5ae3ebe483f83f1230512d3";
const transferFeeBps = 50;
const minReservesBps = 3000;
const BPS = toBN(10000);

describe('DeBridgeGate', () =>{
    beforeEach( async() => {
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

        const UniswapV2 = await deployments.getArtifact("UniswapV2Factory");
        const WETH9 = await deployments.getArtifact("WETH9");
        const DeBridgeGate = await ethers.getContractFactory("MockDeBridgeGate",alice);
        const UniswapV2Factory = await ethers.getContractFactory(UniswapV2.abi,UniswapV2.bytecode, alice );
        const WETH9Factory = await ethers.getContractFactory(WETH9.abi,WETH9.bytecode, alice );
        this.mockToken = await MockToken.new("Link Token", "dLINK", 18, {
        from: alice,
        });
        this.linkToken = await MockLinkToken.new("Link Token", "dLINK", 18, {
        from: alice,
        });
        this.dbrToken = await MockLinkToken.new("DBR", "DBR", 18, {
        from: alice,
        });
        this.amountThreshols = toWei("1000");
        this.minConfirmations = 2;
        this.confirmationThreshold = 5;
        this.excessConfirmations = 7; 

        this.confirmationAggregator = await ConfirmationAggregator.new(
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
                address: bob,
                admin: carol,
            },
            {
                address: carol,
                admin: eve,
            },
            {
                address: eve,
                admin: carol,
            },
            {
                address: fei,
                admin: eve,
            },
            {
                address: devid,
                admin: carol,
            },
        ];
        for (let oracle of this.initialOracles) {
        await this.confirmationAggregator.addOracle(oracle.address, oracle.admin, false, {
            from: alice,
        });
        }

        //Alice is the required oracle
        await this.confirmationAggregator.addOracle(alice, alice, true, {
        from: alice,
        });

        this.uniswapFactory = await UniswapV2Factory.deploy(carol);
        this.feeProxy = await FeeProxy.new(
        this.linkToken.address,
        this.uniswapFactory.address,
        {
            from: alice,
        }
        );
        this.callProxy = await CallProxy.new({
        from: alice,
        });
        this.defiController = await DefiController.new({
        from: alice,
        });
        const maxAmount = toWei("1000000");
        const fixedNativeFee = toWei("0.00001");
        const isSupported = true;
        const supportedChainIds = [42, 56];
        this.weth = await WETH9Factory.deploy();
        this.debridge = await upgrades.deployProxy(DeBridgeGate, [
            this.excessConfirmations,
            ZERO_ADDRESS,
            ZERO_ADDRESS,
            this.callProxy.address.toString(),
            supportedChainIds,
            [
              {
                transferFeeBps,
                fixedNativeFee,
                isSupported,
              },
              {
                transferFeeBps,
                fixedNativeFee,
                isSupported,
              },
            ],
            ZERO_ADDRESS,
            ZERO_ADDRESS,
            ZERO_ADDRESS,
            devid
          ], { unsafeAllow: ['delegatecall'] });
          await this.confirmationAggregator.setDebridgeAddress(this.debridge.address.toString());
          this.signatureVerifier = await SignatureVerifier.new(2,2,3,alice,this.debridge.address.toString());

    })

    it('should call block submission with true value', async()=>{
        const mock_1 = '0x7465737100000000000000000000000000000000000000000000000000000000';
        const mock_2 = '0x7465737200000000000000000000000000000000000000000000000000000000';
        const mock_3 = '0x7465737300000000000000000000000000000000000000000000000000000000';
        const submissions = [mock_1, mock_2, mock_3];
        await this.debridge.blockSubmission(submissions, true, {from:alice});
        for(let i=0;i<submissions.length;i++){
            element = submissions[i];
            let isBlocked = await this.debridge.isBlockedSubmission(element);
            expect(isBlocked).to.be.equal(true);
        }
    })

    it('should set CallProxy as admin, should succeed', async() => {
        await this.debridge.setCallProxy('0x5B518A7ede2De53668496cb991542BF6a94051C1', {from:alice})
        let result = await this.debridge.callProxy();
        expect(result).to.equal('0x5B518A7ede2De53668496cb991542BF6a94051C1')
       
    })

    it('should call an functin that have onlyAdmin modifier, not as admin, should succeed', async() => {
        await expectRevert(this.debridge.connect(bobAccount).setCallProxy('0x5B518A7ede2De53668496cb991542BF6a94051C1'),"onlyAdmin: bad role");
    })

    it('should call requestReservers as not defiController, should fail', async() => {
        await expectRevert(
            this.debridge.requestReserves('0x5B518A7ede2De53668496cb991542BF6a94051C1',0, {
              from: alice,
            }),
            "defiController: bad role"
          );
    })
    it('should pause deBridgeGate when not pause, then unpause, as admin, should succed', async()=>{
        await this.debridge.pause({from:alice})
      
        const chainId = 56;
        const chainIdTo = 57;
        const useAssetFee = false;
        const mockWrappedAsset = this.mockToken
        await mockWrappedAsset.mint(alice,10000);
        await mockWrappedAsset.approve(this.debridge.address, 10000);
        const tokenAddress = mockWrappedAsset.address;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await mockSignatureVerifier.mock.submit.returns(3,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 10000,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_chainId(chainId);
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,1,1)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo,1);

        await expectRevert(this.debridge.send(tokenAddress,bob, 10000, chainIdTo, useAssetFee, {from:alice, value:toWei('1')}),"Pausable: paused");

        await this.debridge.unpause({from:alice})

        await this.debridge.send(tokenAddress,bob, 10000, chainIdTo, useAssetFee, {from:alice, value:toWei('1')});
    })

    it('should update flash fee, as admin, should succeed', async()=>{
        await this.debridge.updateFlashFee(1,{from:alice})
        let result = await this.debridge.get_flashFeeBps();
        expect(result.toNumber()).to.equal(1)
    })

    it('should call return reserve as DefiController token address', async()=>{
        await this.mockToken.mint(this.debridge.address, 1000)
        await this.mockToken.mint(alice, 1000)
        await this.mockToken.approve(this.debridge.address,1000, {from:alice});
        const tokenAddress = this.mockToken.address;
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deFiController(alice)
        await this.debridge.mock_set_chainId(chainId, {from:alice})
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await this.debridge.returnReserves(tokenAddress, 100, {from:alice})
        
    })

    it('should call return reserve as DefiController native address', async()=>{
        const tokenAddress = ZERO_ADDRESS;
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deFiController(alice)
        await this.debridge.mock_set_chainId(chainId, {from:alice})
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await this.debridge.returnReserves(tokenAddress, 100, {from:alice})
        
    })

    it('should withdraw native fee, as admin, should succeed', async()=>{
        const transactionHash = await aliceAccount.sendTransaction({
            to: this.debridge.address,
            value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
          });
        await this.debridge.mock_set_collectedFees(5,{from:alice})
        await this.debridge.withdrawNativeFee(bob,1,{from:alice})
        
    })
    
    it('should withdraw native fee, as admin, fail not enough fee', async()=>{
        const transactionHash = await aliceAccount.sendTransaction({
            to: this.debridge.address,
            value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
          });
        await this.debridge.mock_set_collectedFees(5,{from:alice})
        await expectRevert(this.debridge.withdrawNativeFee(bob,10,{from:alice}),"withdrawNativeFee: not enough fee");
        
    })

    it('should set chain id support, as admin, to true', async()=>{
        const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.setChainIdSupport(debridgeId, chainId,true)
    })

    it('should set chain id support, as admin, to false', async()=>{
        const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.setChainIdSupport(debridgeId, chainId,false)
    })

    it('should update asset fixed fees, as admin, should succeed', async()=>{
        const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const supportedChainIds=[54,55,chainId]
        const assetFees = [1,2,3]
        await this.debridge.updateAssetFixedFees(debridgeId,supportedChainIds,assetFees)
    })

    it('should update chain support, as admin, should succeed', async()=>{
        const supportedChainIds=[54,55,56]
        const chainSupport=[true,1,1]
        const chainSupportInfos=[chainSupport,chainSupport,chainSupport]
        await this.debridge.updateChainSupport(supportedChainIds, chainSupportInfos, {from:alice})
    })

    it('should fo lash loan, should succeed', async()=>{
        const flashReceiver = await FlashReceiver.new(this.dbrToken.address,{from:alice});
        await this.dbrToken.mint(flashReceiver.address,'100000000000000000000');
        await this.dbrToken.mint(this.debridge.address,'100000000000000000000');
        await flashReceiver.doFlashLoan(this.debridge.address, '25000000000000000000', '0x00');
    })

    it('should Do lash loan, fail not paid', async()=>{
        const flashReceiver = await FlashReceiverBroken.new(this.dbrToken.address,{from:alice});
        await this.dbrToken.mint(flashReceiver.address,'100000000000000000000');
        await this.dbrToken.mint(this.debridge.address,'100000000000000000000');
        await expectRevert(flashReceiver.doFlashLoan(this.debridge.address, '25000000000000000000', '0x00'),"Not paid fee");
    })

    it('should call manage old aggregator with light aggregator, as admin, should succeed', async()=>{
        let aggregatorVersion = 1;
        const isLight = true;
        const isValid = true;
        await this.debridge.mock_set_aggregatorLightVersion(2);
        await this.debridge.manageOldAggregator(aggregatorVersion, isLight, isValid);
    })

    it('should call manage old aggregator without light aggregator, as admin, should succeed', async()=>{
        let aggregatorVersion = 1;
        const isLight = false;
        const isValid = true;
        await this.debridge.mock_set_aggregatorFullVersion(2);
        await this.debridge.manageOldAggregator(aggregatorVersion, isLight, isValid);
    })

    it('should call manage old aggregator with light aggregator, as admin, should fail lower version', async()=>{
        let aggregatorVersion = 1;
        const isLight = true;
        const isValid = true;
        await this.debridge.mock_set_aggregatorLightVersion(aggregatorVersion);
        await expectRevert(this.debridge.manageOldAggregator(aggregatorVersion, isLight, isValid), 
       'manageOldAggregator: version too high');
    })

    it('should call manage old aggregator without light aggregator, as admin, should fail lower version', async()=>{
        let aggregatorVersion = 1;
        const isLight = false;
        const isValid = true;
        await this.debridge.mock_set_aggregatorFullVersion(aggregatorVersion);
        await expectRevert(this.debridge.manageOldAggregator(aggregatorVersion, isLight, isValid), 
       'manageOldAggregator: version too high');
    })

    it('should call mint with old aggregator, as admin, should fail invalidAggregator', async()=>{
        const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await expectRevert(this.debridge.mintWithOldAggregator(debridgeId, chainId, bob,1,1,['0x00','0x00'],1),'invalidAggregator')
    })

    it('should call mint with old aggregator, as admin, should succeed', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
        await mockWrappedAsset.mock.mint.returns();
        await mockWrappedAsset.mock.balanceOf.returns(0)
        await mockWrappedAsset.mock.allowance.returns(0);
        await mockWrappedAsset.mock.transfer.returns(true);
        await mockWrappedAsset.mock.approve.returns(true);
        const tokenAddress = mockWrappedAsset.address;
        const chainId = 56;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        mockSignatureVerifier.mock.submit.returns(3,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_AggregatorInfoForOlgSinatureVerifier(1,mockSignatureVerifier.address,true);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mintWithOldAggregator(debridgeId, chainId, bob,1,1,['0x00','0x00'],1);
       
    })

    it('should call mint with old aggregator, as admin, should fail not confirmed', async()=>{
        const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
        const chainId = 56;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        mockSignatureVerifier.mock.submit.returns(3,false);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_AggregatorInfoForOlgSinatureVerifier(1,mockSignatureVerifier.address,true);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await expectRevert(this.debridge.mintWithOldAggregator(debridgeId, chainId, bob,1,1,['0x00','0x00'],1),'not confirmed')
    })

    it('should call mint with old aggregator, as admin, should fail amount not confirmed', async()=>{
        const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
        const chainId = 56;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        mockSignatureVerifier.mock.submit.returns(3,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_AggregatorInfoForOlgSinatureVerifier(1,mockSignatureVerifier.address,true);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(5)
        await expectRevert(this.debridge.mintWithOldAggregator(debridgeId, chainId, bob,5,1,['0x00','0x00'],1),'amount not confirmed')
    })

    it('should call mint , as admin, should succeed', async()=>{
        const chainId = 56;
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
        await mockWrappedAsset.mock.mint.returns();
        await mockWrappedAsset.mock.balanceOf.returns(0)
        await mockWrappedAsset.mock.allowance.returns(0);
        await mockWrappedAsset.mock.transfer.returns(true);
        await mockWrappedAsset.mock.approve.returns(true);
        const tokenAddress = mockWrappedAsset.address;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await mockSignatureVerifier.mock.submit.returns(3,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await this.debridge.mint(debridgeId, chainId, bob,5,1,['0x00','0x00']);
    });
    
    it('should call auto mint with old aggregator, as admin, should fail invalidAggregator', async()=>{
        const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await expectRevert(this.debridge.autoMintWithOldAggregator(debridgeId, chainId, bob,1,1,['0x00','0x00'],alice, 0, "0x00",1),'invalidAggregator')
    })

  
    it('should call auto mint with old aggregator, as admin, should fail not confirmed', async()=>{
        const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
        const chainId = 56;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        mockSignatureVerifier.mock.submit.returns(3,false);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_AggregatorInfoForOlgSinatureVerifier(1,mockSignatureVerifier.address,true);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await expectRevert(this.debridge.autoMintWithOldAggregator(debridgeId, chainId, bob,1,1,['0x00','0x00'],alice, 0, "0x00",1),'not confirmed')
    })

    it('should call auto mint with old aggregator, as admin, should fail amount not confirmed', async()=>{
        const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
        const chainId = 56;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        mockSignatureVerifier.mock.submit.returns(3,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_AggregatorInfoForOlgSinatureVerifier(1,mockSignatureVerifier.address,true);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(5)
        await expectRevert(this.debridge.autoMintWithOldAggregator(debridgeId, chainId, bob,5,1,['0x00','0x00'],alice, 0, "0x00",1),'amount not confirmed')
    });

    it('should call auto mint with old aggregator, as admin, should succeed', async()=>{
            const chainId = 56;
            const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
            await mockWrappedAsset.mock.mint.returns();
            await mockWrappedAsset.mock.balanceOf.returns(0)
            await mockWrappedAsset.mock.allowance.returns(0);
            await mockWrappedAsset.mock.transfer.returns(true);
            await mockWrappedAsset.mock.approve.returns(true);
            const tokenAddress = mockWrappedAsset.address;
            const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
            const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
            await mockSignatureVerifier.mock.submit.returns(3,true);
            await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
            await this.debridge.mock_set_AggregatorInfoForOlgSinatureVerifier(1,mockSignatureVerifier.address,true);
            await this.debridge.mock_set_amountThreshold(debridgeId,2);
            await this.debridge.mock_set_excessConfirmations(2)
            await this.debridge.autoMintWithOldAggregator(debridgeId, chainId, bob,5,1,['0x00','0x00'],alice, 0, "0x00",1);
    });

    it('should call auto mint with, as admin, should succeed', async()=>{
        const chainId = 56;
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
        await mockWrappedAsset.mock.mint.returns();
        await mockWrappedAsset.mock.balanceOf.returns(0)
        await mockWrappedAsset.mock.allowance.returns(0);
        await mockWrappedAsset.mock.transfer.returns(true);
        await mockWrappedAsset.mock.approve.returns(true);
        const tokenAddress = mockWrappedAsset.address;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await mockSignatureVerifier.mock.submit.returns(3,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await this.debridge.autoMint(debridgeId, chainId, bob,5,1,['0x00','0x00'],alice, 0, "0x00");
});


    it('should call claim with olg aggregator, as admin, should fail', async()=>{
        const chainId = 56;
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
        mockWrappedAsset.mock.mint.returns();
        const tokenAddress = mockWrappedAsset.address;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        mockSignatureVerifier.mock.submit.returns(3,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_AggregatorInfoForOlgSinatureVerifier(1,mockSignatureVerifier.address,true);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await expectRevert(this.debridge.claimWithOldAggregator(debridgeId, chainId, bob,5,1,['0x00','0x00'],1),'claim: wrong target chain');
    });

    it('should call claim with old aggregator, as admin, should fail arithemtic operation', async()=>{
        const chainId = 56;
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
        mockWrappedAsset.mock.mint.returns();
        const tokenAddress = mockWrappedAsset.address;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_chainId(chainId)
        mockSignatureVerifier.mock.submit.returns(3,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_AggregatorInfoForOlgSinatureVerifier(1,mockSignatureVerifier.address,true);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await expectRevert(this.debridge.claimWithOldAggregator(debridgeId, chainId, bob,5,1,['0x00','0x00'],1),"panic code 0x11");

    })

    it('should call auto claim with old aggregator, as admin, should fail arithemtic error', async()=>{
            const chainId = 56;
            const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
            mockWrappedAsset.mock.mint.returns();
            const tokenAddress = mockWrappedAsset.address;
            const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
            const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
            await this.debridge.mock_set_chainId(chainId)
            mockSignatureVerifier.mock.submit.returns(3,true);
            await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
            await this.debridge.mock_set_AggregatorInfoForOlgSinatureVerifier(1,mockSignatureVerifier.address,true);
            await this.debridge.mock_set_amountThreshold(debridgeId,2);
            await this.debridge.mock_set_excessConfirmations(2)
            await expectRevert(this.debridge.autoClaimWithOldAggregator(debridgeId, chainId, bob,5,1,['0x00','0x00'], alice, 0, "0x00",1),"panic code 0x11");
 
    })

    it('should call request reserve as DefiController, should fail not enough reserves', async()=>{
        const tokenAddress = this.mockToken.address;
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.mockToken.mint(this.debridge.address,100, {from:alice});
        await this.debridge.mock_set_deFiController(alice)
        await this.debridge.mock_set_chainId(chainId, {from:alice})
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await expectRevert(this.debridge.requestReserves(tokenAddress, 100, {from:alice}), 'requestReserves: not enough reserves');
    })

    it('should call request reserve as DefiController, send tokens', async()=>{
        const tokenAddress = this.mockToken.address;
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.mockToken.mint(this.debridge.address,'1', {from:alice});
        await this.debridge.mock_set_deFiController(alice)
        await this.debridge.mock_set_chainId(chainId, {from:alice})
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.requestReserves(tokenAddress, '1', {from:alice});
    })

    it('should call request reserve as DefiController, send ether', async()=>{
        const transactionHash = await aliceAccount.sendTransaction({
            to: this.debridge.address,
            value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
          });
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.mockToken.mint(this.debridge.address,ethers.utils.parseEther('1.0'), {from:alice});
        await this.debridge.mock_set_deFiController(alice)
        await this.debridge.mock_set_chainId(chainId, {from:alice})
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.requestReserves(tokenAddress, ethers.utils.parseEther('1.0'), {from:alice});
    })

    it('should call send , as admin, use asset fee true should succeed', async()=>{
        const chainId = 56;
        const chainIdTo = 57;
        const useAssetFee = false;
        const mockWrappedAsset = this.mockToken
        await mockWrappedAsset.mint(alice,10000);
        await mockWrappedAsset.approve(this.debridge.address, 10000);
        const tokenAddress = mockWrappedAsset.address;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await mockSignatureVerifier.mock.submit.returns(3,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 10000,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_chainId(chainId);
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,1,1)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo,1);
        await this.debridge.send(tokenAddress,bob, 10000, chainIdTo, useAssetFee, {from:alice, value:toWei('1')});
    });

    it('should call send , as admin, use asset fee true should fail no msg.value given amount not cover fes', async()=>{
        const chainId = 56;
        const chainIdTo = 57;
        const useAssetFee = false;
        const mockWrappedAsset = this.mockToken
        await mockWrappedAsset.mint(alice,10000);
        await mockWrappedAsset.approve(this.debridge.address, 10000);
        const tokenAddress = mockWrappedAsset.address;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await mockSignatureVerifier.mock.submit.returns(3,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 10000,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_chainId(chainId);
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,1,1)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo,1);
        await expectRevert(this.debridge.send(tokenAddress,bob, 10000, chainIdTo, useAssetFee),"send: amount not cover fees");
    });


    it('should call send , as admin, use asset fee true should fail amount lower then transferFee amount not cover fes', async()=>{
        const chainId = 56;
        const chainIdTo = 57;
        const useAssetFee = false;
        const mockWrappedAsset = this.mockToken
        await mockWrappedAsset.mint(alice,10000);
        await mockWrappedAsset.approve(this.debridge.address, 10000);
        const tokenAddress = mockWrappedAsset.address;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await mockSignatureVerifier.mock.submit.returns(3,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 10000,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_chainId(chainId);
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,1,'150000000000000000000')
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo,1);
        await expectRevert(this.debridge.send(tokenAddress,bob, 10000, chainIdTo, useAssetFee),"send: amount not cover fees");
    });

    it('should call send , as admin, use asset fee false should succeed', async()=>{
        const chainId = 56;
        const chainIdTo = 57;
        const useAssetFee = true;
        const mockWrappedAsset = this.mockToken
        await mockWrappedAsset.mint(alice,10000);
        await mockWrappedAsset.approve(this.debridge.address, 10000);
        const tokenAddress = mockWrappedAsset.address;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await mockSignatureVerifier.mock.submit.returns(3,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 10000,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_chainId(chainId);
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,1,1)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo,1);
        await this.debridge.send(tokenAddress,bob, 10000, chainIdTo, useAssetFee);
    });

    it('should call auto send , as admin, should succeed', async()=>{
        const chainId = 56;
        const chainIdTo = 57;
        const useAssetFee = true;
        const mockWrappedAsset = this.mockToken
        await mockWrappedAsset.mint(alice,10000);
        await mockWrappedAsset.approve(this.debridge.address, 10000);
        const tokenAddress = mockWrappedAsset.address;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await mockSignatureVerifier.mock.submit.returns(3,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 10000,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_chainId(chainId);
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,1,1)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo,1);
        await this.debridge.autoSend(tokenAddress,bob, 10000, chainIdTo, alice, 0, [], useAssetFee);
    });

    it('should call burn , as admin, should succeed', async()=>{
        const chainId = 56;
        const chainIdTo = 57;
        const deadline = 0;
        const useAssetFee = true;
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
        await mockWrappedAsset.mock.mint.returns();
        await mockWrappedAsset.mock.balanceOf.returns(0)
        await mockWrappedAsset.mock.allowance.returns(0);
        await mockWrappedAsset.mock.transferFrom.returns(true);
        await mockWrappedAsset.mock.transfer.returns(true);
        await mockWrappedAsset.mock.approve.returns(true);
        await mockWrappedAsset.mock.burn.returns();
        const tokenAddress = mockWrappedAsset.address;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await mockSignatureVerifier.mock.submit.returns(3,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 10000,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,1,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo,1);
        await this.debridge.burn(debridgeId,bob,10000,chainIdTo, deadline,[], useAssetFee);
    });

    it('should call burn , as admin, should fail, amount not cover fees', async()=>{
        const chainId = 56;
        const chainIdTo = 57;
        const deadline = 0;
        const useAssetFee = false;
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
        await mockWrappedAsset.mock.mint.returns();
        await mockWrappedAsset.mock.balanceOf.returns(0)
        await mockWrappedAsset.mock.allowance.returns(0);
        await mockWrappedAsset.mock.transferFrom.returns(true);
        await mockWrappedAsset.mock.transfer.returns(true);
        await mockWrappedAsset.mock.approve.returns(true);
        await mockWrappedAsset.mock.burn.returns();
        const tokenAddress = mockWrappedAsset.address;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await mockSignatureVerifier.mock.submit.returns(3,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 10000,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,1,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo,1);
        await expectRevert(this.debridge.burn(debridgeId,bob,10000,chainIdTo, deadline,[], useAssetFee, {from:alice, value:0}),"send: amount not cover fees");
    });

    it('should call burn , as admin, should succeed with signatures', async()=>{
        const chainId = 56;
        const chainIdTo = 57;
        const deadline = 0;
        const useAssetFee = true;
        const signature = '0xd3ee395e82769b9e8ec18d0567bdba83e982140787c805eecd7db200291c4071b10ee5df72b9da54450cf739c6a35aef12f7ccab78b3f27679c1b9694da8982ae4'
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
        await mockWrappedAsset.mock.mint.returns();
        await mockWrappedAsset.mock.balanceOf.returns(0)
        await mockWrappedAsset.mock.allowance.returns(0);
        await mockWrappedAsset.mock.transferFrom.returns(true);
        await mockWrappedAsset.mock.transfer.returns(true);
        await mockWrappedAsset.mock.approve.returns(true);
        await mockWrappedAsset.mock.burn.returns();
        await mockWrappedAsset.mock.permit.returns();
        const tokenAddress = mockWrappedAsset.address;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await mockSignatureVerifier.mock.submit.returns(3,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 10000,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,1,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo,1);
        await this.debridge.burn(debridgeId,bob,10000,chainIdTo, deadline, signature, useAssetFee);
    });

   
    it('should call internal burn function, should fail native asset', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
        mockWrappedAsset.mock.transferFrom.returns(true);
        mockWrappedAsset.mock.burn.returns();
        const tokenAddress = mockWrappedAsset.address;
        const chainId = 56;
        const chainIdTo= 57;
        const deadline = 0;
        const useAssetFee=true;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,1,1500)
        await this.debridge.mock_set_chainId(chainId);
        await  expectRevert(this.debridge.call_internal_burn(debridgeId, amount, chainId, deadline,[],useAssetFee),'burn: native asset');
    })

    it('should call internal burn function, should fail fixed fee not supported', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
        mockWrappedAsset.mock.transferFrom.returns(true);
        mockWrappedAsset.mock.burn.returns();
        const tokenAddress = mockWrappedAsset.address;
        const chainId = 56;
        const chainIdTo= 57;
        const deadline = 0;
        const useAssetFee=true;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,1,1500)
        await  expectRevert(this.debridge.call_internal_burn(debridgeId, amount, chainIdTo, deadline,[],useAssetFee),'send: fixed fee for asset is not supported');
    })

    it('should call internal burn function, use native fee true', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
        mockWrappedAsset.mock.transferFrom.returns(true);
        mockWrappedAsset.mock.burn.returns();
        const tokenAddress = mockWrappedAsset.address;
        const chainId = 56;
        const chainIdTo= 57;
        const deadline = 0;
        const useAssetFee=true;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        await this.debridge.call_internal_burn(debridgeId, amount, chainIdTo, deadline,[],useAssetFee);
    })

    it('should call internal burn function, use native fee false', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
        mockWrappedAsset.mock.transferFrom.returns(true);
        mockWrappedAsset.mock.burn.returns();
        const tokenAddress = mockWrappedAsset.address;
        const chainId = 56;
        const chainIdTo= 57;
        const deadline = 0;
        const useAssetFee=false;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        await this.debridge.call_internal_burn(debridgeId, amount, chainIdTo, deadline,[],useAssetFee);
    })

    it('should call internal burn function, fail wrong target chain', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
        mockWrappedAsset.mock.transferFrom.returns(true);
        mockWrappedAsset.mock.burn.returns();
        const tokenAddress = mockWrappedAsset.address;
        const chainId = 56;
        const chainIdTo= 57;
        const deadline = 0;
        const useAssetFee=true;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,false,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        await expectRevert(this.debridge.call_internal_burn(debridgeId, amount, chainIdTo, deadline,[],useAssetFee),"burn: wrong targed chain");
    })

    it('should call internal burn function, fail amount to high', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
        mockWrappedAsset.mock.transferFrom.returns(true);
        mockWrappedAsset.mock.burn.returns();
        const tokenAddress = mockWrappedAsset.address;
        const chainId = 56;
        const chainIdTo= 57;
        const deadline = 0;
        const useAssetFee=true;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 10000;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        await expectRevert(this.debridge.call_internal_burn(debridgeId, amount, chainIdTo, deadline,[],useAssetFee),"burn: amount too high");
    })

    it('should call internal burn function, use asset fee true, fail amount not cover fee', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
        mockWrappedAsset.mock.transferFrom.returns(true);
        mockWrappedAsset.mock.burn.returns();
        const tokenAddress = mockWrappedAsset.address;
        const chainId = 56;
        const chainIdTo= 57;
        const deadline = 0;
        const useAssetFee=true;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,'150000')
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, '10000000000000000000000');
        await expectRevert(this.debridge.call_internal_burn(debridgeId, amount, chainIdTo, deadline,[],useAssetFee),"send: amount not cover fees");
    })

    it('should call internal burn function, use asset fee false, fail amount not cover fee', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
        mockWrappedAsset.mock.transferFrom.returns(true);
        mockWrappedAsset.mock.burn.returns();
        const tokenAddress = mockWrappedAsset.address;
        const chainId = 56;
        const chainIdTo= 57;
        const deadline = 0;
        const useAssetFee=false;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,'150000')
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, '10000000000000000000000');
        await expectRevert(this.debridge.call_internal_burn(debridgeId, amount, chainIdTo, deadline,[],useAssetFee),"send: amount not cover fees");
    })

    it('should update excess confirmations, as admin, should succeed', async()=>{
        await this.debridge.updateExcessConfirmations(2, {from:alice});
    })

    it('should update asset, as admin, should succeed', async()=>{
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.updateAsset(debridgeId, 1,1,1, {from:alice});
    })

    it('should withdraw fee, as admin, should work', async()=>{
        await this.mockToken.mint(this.debridge.address,10);
        await this.debridge.mock_set_chainId(1);
        const tokenAddress = this.mockToken.address;
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_collectedFeesForDebridge(debridgeId,10);
        await this.debridge.withdrawFee(debridgeId, alice, 1);

    })


    it('should withdraw fee, as admin, fail not enough fee', async()=>{
        await this.mockToken.mint(this.debridge.address,10);
        await this.debridge.mock_set_chainId(1);
        const tokenAddress = this.mockToken.address;
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_collectedFeesForDebridge(debridgeId,10);
        await expectRevert(this.debridge.withdrawFee(debridgeId, alice, '10000000000000000000000000'),"withdrawFee: not enough fee");
    })

    it('should withdraw fee, as admin, should work, use native token', async()=>{
        const transactionHash = await aliceAccount.sendTransaction({
            to: this.debridge.address,
            value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
        });
        await this.mockToken.mint(this.debridge.address,10);
        await this.debridge.mock_set_chainId(1);
        const tokenAddress = ZERO_ADDRESS;
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_chainId(chainId);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_collectedFeesForDebridge(debridgeId,10);
        await this.debridge.withdrawFee(debridgeId, alice, 1);

    })

    it('should fund treasury, as admin, should succeed', async()=>{
        const mockFeeProxy = await deployMockContract(aliceAccount, MockFeeProxy.abi);
        await mockFeeProxy.mock.swapToLink.returns()
        await this.mockToken.mint(this.debridge.address,10);
        await this.mockToken.mint(mockFeeProxy.address,100);
        await this.debridge.mock_set_chainId(1);
        const tokenAddress = this.mockToken.address;
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_collectedFeesForDebridge(debridgeId,10);
        await this.debridge.setFeeProxy(mockFeeProxy.address, {from:alice});
        await this.debridge.fundTreasury(debridgeId, 1, {from:alice});
    })

    it('should fund treasury, as admin, should fail not enough fee', async()=>{
        const mockFeeProxy = await deployMockContract(aliceAccount, MockFeeProxy.abi);
        await mockFeeProxy.mock.swapToLink.returns()
        await this.mockToken.mint(this.debridge.address,10);
        await this.mockToken.mint(mockFeeProxy.address,100);
        await this.debridge.mock_set_chainId(1);
        const tokenAddress = this.mockToken.address;
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_collectedFeesForDebridge(debridgeId,10);
        await this.debridge.setFeeProxy(mockFeeProxy.address, {from:alice});
        await expectRevert(this.debridge.fundTreasury(debridgeId, '100000000000000000000000000000', {from:alice}), "fundTreasury: not enough fee");
    })

    it('should fund treasury, as admin, should succeed, use native tokens weth', async()=>{
        const transactionHash = await aliceAccount.sendTransaction({
            to: this.debridge.address,
            value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
          });
        const WETH9 = await deployments.getArtifact("WETH9");
        const mockWETH = await deployMockContract(aliceAccount, WETH9.abi);
        await mockWETH.mock.balanceOf.returns(1);
        await mockWETH.mock.deposit.returns();
        await mockWETH.mock.transfer.returns(true);
        const mockFeeProxy = await deployMockContract(aliceAccount, MockFeeProxy.abi);
        await mockFeeProxy.mock.swapToLink.returns()
        await this.mockToken.mint(this.debridge.address,10);
        await this.mockToken.mint(mockFeeProxy.address,100);
        await this.debridge.mock_set_chainId(1);
        const tokenAddress = ZERO_ADDRESS;
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_collectedFeesForDebridge(debridgeId,10);
        await this.debridge.mock_set_weth(mockWETH.address);
        await this.debridge.setFeeProxy(mockFeeProxy.address, {from:alice});
        await this.debridge.fundTreasury(debridgeId, 1, {from:alice});
    })

    it('should set aggregator, ligt true', async()=>{
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        await this.debridge.setAggregator(mockSignatureVerifier.address, true);
    })

    it('should set aggregator, ligt false', async()=>{
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        await this.debridge.setAggregator(mockSignatureVerifier.address, false);
    })

    it('should call auto burn function, use native fee true', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi)
        mockWrappedAsset.mock.transferFrom.returns(true);
        mockWrappedAsset.mock.burn.returns();
        const tokenAddress = mockWrappedAsset.address;
        const chainId = 56;
        const chainIdTo= 57;
        const deadline = 0;
        const useAssetFee=true;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        await this.debridge.autoBurn(debridgeId,bob, amount, chainIdTo,alice,0,"0x00", deadline,[],useAssetFee);
    })

    it('should call internal claim function, data length bigger then zero, erc20 tokens', async()=>{
        const tokenAddress = this.mockToken.address;
        await this.mockToken.mint(this.debridge.address,1000);
        const chainId = 56;
        const chainIdTo= 57;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        await this.debridge.mock_set_chainId(chainId);
        const submisionId = await this.debridge.getSubmisionId( debridgeId,
            chainId,
            chainId,
            amount,
            alice,
            1);
        await this.debridge.call_internal_claim(submisionId,debridgeId,bob, amount, alice,0,"0x00");
    })

    it('should call internal claim function, data length equal with zero', async()=>{
        const tokenAddress = this.mockToken.address;
        await this.mockToken.mint(this.debridge.address,1000);
        const chainId = 56;
        const chainIdTo= 57;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        await this.debridge.mock_set_chainId(chainId);
        const submisionId = await this.debridge.getSubmisionId( debridgeId,
            chainId,
            chainId,
            amount,
            alice,
            1);
        await this.debridge.call_internal_claim(submisionId,debridgeId,bob, amount, alice,0,[]);
    })

    it('should call internal claim function, executon fee bigger then zero', async()=>{
        const tokenAddress = this.mockToken.address;
        await this.mockToken.mint(this.debridge.address,1000);
        const chainId = 56;
        const chainIdTo= 57;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        await this.debridge.mock_set_chainId(chainId);
        const submisionId = await this.debridge.getSubmisionId( debridgeId,
            chainId,
            chainId,
            amount,
            alice,
            1);
        await this.debridge.call_internal_claim(submisionId,debridgeId,bob, amount, alice,1,[]);
    })

    it('should call internal claim function, using native token, data length equal with zero', async()=>{
        const transactionHash = await aliceAccount.sendTransaction({
            to: this.debridge.address,
            value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
          });
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const chainId = 56;
        const chainIdTo= 57;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        await this.debridge.mock_set_chainId(chainId);
        const submisionId = await this.debridge.getSubmisionId( debridgeId,
            chainId,
            chainId,
            amount,
            alice,
            1);
        await this.debridge.call_internal_claim(submisionId,debridgeId,bob, amount, alice,0,[]);
    })

    it('should call internal claim function, using native token, execution fee bigger then 0', async()=>{
        const transactionHash = await aliceAccount.sendTransaction({
            to: this.debridge.address,
            value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
          });
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const chainId = 56;
        const chainIdTo= 57;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        await this.debridge.mock_set_chainId(chainId);
        const submisionId = await this.debridge.getSubmisionId( debridgeId,
            chainId,
            chainId,
            amount,
            alice,
            1);
        await this.debridge.call_internal_claim(submisionId,debridgeId,bob, amount, alice,1,[]);
    })

    it('should call internal claim function, using native token, data length bigger then zero', async()=>{
        const transactionHash = await aliceAccount.sendTransaction({
            to: this.debridge.address,
            value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
          });
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const chainId = 56;
        const chainIdTo= 57;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        await this.debridge.mock_set_chainId(chainId);
        const submisionId = await this.debridge.getSubmisionId( debridgeId,
            chainId,
            chainId,
            amount,
            alice,
            1);
        await this.debridge.call_internal_claim(submisionId,debridgeId,bob, amount, alice,0,"0x00");
    })

    it('should call internal claim function, using native token, should fail subbmision id already use', async()=>{
        const transactionHash = await aliceAccount.sendTransaction({
            to: this.debridge.address,
            value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
          });
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const chainId = 56;
        const chainIdTo= 57;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        await this.debridge.mock_set_chainId(chainId);
        const submisionId = await this.debridge.getSubmisionId( debridgeId,
            chainId,
            chainId,
            amount,
            alice,
            1);
        await this.debridge.mock_set_is_submision_id_used(submisionId,true);
        await expectRevert(this.debridge.call_internal_claim(submisionId,debridgeId,bob, amount, alice,0,"0x00"),"claim: already used");
    })

    it('should call internal claim function, using native token, should fail block submission', async()=>{
        const transactionHash = await aliceAccount.sendTransaction({
            to: this.debridge.address,
            value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
          });
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const chainId = 56;
        const chainIdTo= 57;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'10000000000000000000',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        await this.debridge.mock_set_chainId(chainId);
        const submisionId = await this.debridge.getSubmisionId( debridgeId,
            chainId,
            chainId,
            amount,
            alice,
            1);
        await this.debridge.mock_set_is_blocked_submission_value(submisionId,true);
        await expectRevert(this.debridge.call_internal_claim(submisionId,debridgeId,bob, amount, alice,0,"0x00"),"claim: blocked submission");
    })

    it('should call claim, as admin', async()=>{
        const chainId = 56;
        this.mockToken.mint(this.debridge.address,1000);
        const tokenAddress = this.mockToken.address;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const amount=5;
        await mockSignatureVerifier.mock.submit.returns(2,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,6,1,1,1,true, {from:alice})
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await this.debridge.mock_set_chainId(chainId);
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.mock_set_amountThreshold(debridgeId,amount);
        await this.debridge.claim(debridgeId, chainId, bob,amount,1,["0x00","0x00"]);
    });

    it('should call auto claim, as admin', async()=>{
        const chainId = 56;
        const chainIdTo = 57;
        this.mockToken.mint(this.debridge.address,1000);
        const tokenAddress = this.mockToken.address;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const amount=5;
        await mockSignatureVerifier.mock.submit.returns(2,true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,6,1,1,1,true, {from:alice})
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await this.debridge.mock_set_chainId(chainId);
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.mock_set_amountThreshold(debridgeId,amount);
        await this.debridge.autoClaim(debridgeId, chainId, bob,amount,1,["0x00","0x00"], alice,0,"0x00");
    });

    it('should call internal send function with non existent debridge infos, fail wrong target chain', async()=>{
        const chainId = 56;
        const chainIdTo =57;
        const amount=1;
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const useAssetFee = false;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await expectRevert(this.debridge.call_internal_send(tokenAddress, debridgeId, amount, chainIdTo, useAssetFee),"'send: wrong targed chain");
    })

    it('should call internal send function, should fail amount mismatch', async()=>{
        const chainId = 56;
        const chainIdTo =57;
        const amount=1;
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const useAssetFee = false;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_chainSupportInfoIsSupported(chainIdTo, true);
        await expectRevert(this.debridge.call_internal_send(tokenAddress, debridgeId, amount, chainIdTo, useAssetFee),"send: amount mismatch");
    })

    it('should call internal send function, should fail not native chain', async()=>{
        const chainId = 56;
        const chainIdTo =57;
        const amount=2;
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const useAssetFee = false;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_chainSupportInfoIsSupported(chainIdTo, true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainIdTo, 1,1,1,1,1,1,true, {from:alice})
        await expectRevert(this.debridge.call_internal_send(tokenAddress, debridgeId, amount, chainIdTo, useAssetFee),"send: not native chain");
    })

    it('should call internal send function, should fail amount to high', async()=>{
        const chainId = 56;
        const chainIdTo =57;
        const amount=2;
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const useAssetFee = false;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_chainSupportInfoIsSupported(chainIdTo, true);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_chainId(chainId);
        await expectRevert(this.debridge.call_internal_send(tokenAddress, debridgeId, amount, chainIdTo, useAssetFee),"send: amount too high");
    })

    it('should call internal check and deploy asset, should fail asset not exist', async()=>{
        const mockAggregator = await deployMockContract(aliceAccount, ConfirmationAggregatorABI.abi);
        mockAggregator.mock.deployAsset.returns(ZERO_ADDRESS, 56)
        const chainId = 56;
        const tokenAddress = ZERO_ADDRESS;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await expectRevert(this.debridge.call_internal_checkAndDeployAsset(debridgeId, mockAggregator.address),"mint: wrapped asset not exist");
    })

    it('should call internal check and deploy asset, should add asset', async()=>{
        const mockAggregator = await deployMockContract(aliceAccount, ConfirmationAggregatorABI.abi);
        mockAggregator.mock.deployAsset.returns(MOCK_ADDRESS, 56)
        const chainId = 56;
        const tokenAddress = ZERO_ADDRESS;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.call_internal_checkAndDeployAsset(debridgeId, mockAggregator.address);;
    })

    it('should call internal add asset', async()=>{
        const chainId = 56;
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_amountThreshold(debridgeId, 1);
        await this.debridge.mock_set_debridge_maxAmount(debridgeId, 1);
        await this.debridge.call_internal_add_asset(debridgeId, tokenAddress, chainId)
    })

    
    it('should call internal check confirmations, fail not confirmed', async()=>{
        const mockConfirmationAggregator = await deployMockContract(aliceAccount, ConfirmationAggregatorABI.abi);
        await mockConfirmationAggregator.mock.getSubmissionConfirmations.returns(0,false);
        const chainId = 56;
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const submisionId= '0x83dc77819c8b6a091858247572dc6b849bab82a3e5b28d64ea6d8e1665f9ca5f';
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 0;
        const signatures = [];
        await this.debridge.mock_set_confirmationAggregator(mockConfirmationAggregator.address);
        await expectRevert(this.debridge.call_internal_checkConfirmations(submisionId, debridgeId, amount, signatures),"not confirmed");
    })

    it('should call internal check confirmations, amount smaller then amount threshold', async()=>{
        const mockConfirmationAggregator = await deployMockContract(aliceAccount, ConfirmationAggregatorABI.abi);
        await mockConfirmationAggregator.mock.getSubmissionConfirmations.returns(0,true);
        const chainId = 56;
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const submisionId= '0x83dc77819c8b6a091858247572dc6b849bab82a3e5b28d64ea6d8e1665f9ca5f';
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 0;
        const signatures = [];
        await this.debridge.mock_set_amountThreshold(debridgeId,1000)
        await this.debridge.mock_set_confirmationAggregator(mockConfirmationAggregator.address);
        await this.debridge.call_internal_checkConfirmations(submisionId, debridgeId, amount, signatures);
    })

    it('should call internal check confirmations, amount bigger or equal with amount threshold, fail not confirmed', async()=>{
        const mockConfirmationAggregator = await deployMockContract(aliceAccount, ConfirmationAggregatorABI.abi);
        await mockConfirmationAggregator.mock.getSubmissionConfirmations.returns(0,true);
        const chainId = 56;
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const submisionId= '0x83dc77819c8b6a091858247572dc6b849bab82a3e5b28d64ea6d8e1665f9ca5f';
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 0;
        const signatures = [];
        await this.debridge.mock_set_amountThreshold(debridgeId,0)
        await this.debridge.mock_set_confirmationAggregator(mockConfirmationAggregator.address);
        await expectRevert(this.debridge.call_internal_checkConfirmations(submisionId, debridgeId, amount, signatures),"amount not confirmed");
    })

    it('should call internal mint, should fail already used', async()=>{
        const maxAmount = 10;
        const collectedFees = 1;
        const balance = 5;
        const lookedInStragegis = 1;
        const minReserveBps = 1;
        const chainFee = 0;
        const exist = false;
        const chainId = 56;
        const chainIdTo =57;
        const amount=2;
        const nonce = 1;
        const token = this.mockToken.address;
        const executionFee = 0;
        const data = '0x00';
        const debridgeId = await this.debridge.getDebridgeId(chainId, token);
        const submissionId = await this.debridge.getSubmisionId(
            debridgeId,
            chainId,
            chainIdTo,
            amount,
            bob,
            nonce
        );
        await this.debridge.mock_set_is_submision_id_used(submissionId,false);
        await this.debridge.mock_set_is_blocked_submission_value(submissionId,false);

        await this.debridge.mock_set_deBridgeInfo(
            debridgeId, 
            token, 
            chainId, 
            maxAmount, 
            collectedFees, 
            balance,
            lookedInStragegis,
            minReserveBps,
            chainFee,
            exist
        );
       await this.debridge.mock_set_is_submision_id_used(submissionId, true); 
       await expectRevert(this.debridge.call_internal_mint(submissionId, debridgeId, bob, amount, alice, executionFee,data),"mint: already used");
    })

    it('should call internal mint, should fail blocked submission', async()=>{
        const maxAmount = 10;
        const collectedFees = 1;
        const balance = 5;
        const lookedInStragegis = 1;
        const minReserveBps = 1;
        const chainFee = 0;
        const exist = false;
        const chainId = 56;
        const chainIdTo =57;
        const amount=2;
        const nonce = 1;
        const token = this.mockToken.address;
        const executionFee = 0;
        const data = '0x00';
        const debridgeId = await this.debridge.getDebridgeId(chainId, token);
        const submissionId = await this.debridge.getSubmisionId(
            debridgeId,
            chainId,
            chainIdTo,
            amount,
            bob,
            nonce
        );
        await this.debridge.mock_set_is_submision_id_used(submissionId,false);
        await this.debridge.mock_set_is_blocked_submission_value(submissionId,false);

        await this.debridge.mock_set_deBridgeInfo(
            debridgeId, 
            token, 
            chainId, 
            maxAmount, 
            collectedFees, 
            balance,
            lookedInStragegis,
            minReserveBps,
            chainFee,
            exist
        );
       await this.debridge.mock_set_is_blocked_submission_value(submissionId, true); 
       await expectRevert(this.debridge.call_internal_mint(submissionId, debridgeId, bob, amount, alice, executionFee,data),"mint: blocked submission");
    })

    it('should call internal mint, should fail not exist', async()=>{
        const maxAmount = 10;
        const collectedFees = 1;
        const balance = 5;
        const lookedInStragegis = 1;
        const minReserveBps = 1;
        const chainFee = 0;
        const exist = false;
        const chainId = 56;
        const chainIdTo =57;
        const amount=2;
        const nonce = 1;
        const token = this.mockToken.address;
        const executionFee = 0;
        const data = '0x00';
        const debridgeId = await this.debridge.getDebridgeId(chainId, token);
        const submissionId = await this.debridge.getSubmisionId(
            debridgeId,
            chainId,
            chainIdTo,
            amount,
            bob,
            nonce
        );
        await this.debridge.mock_set_is_submision_id_used(submissionId,false);
        await this.debridge.mock_set_is_blocked_submission_value(submissionId,false);

        await this.debridge.mock_set_deBridgeInfo(
            debridgeId, 
            token, 
            chainId, 
            maxAmount, 
            collectedFees, 
            balance,
            lookedInStragegis,
            minReserveBps,
            chainFee,
            exist
        );
        
       await expectRevert(this.debridge.call_internal_mint(submissionId, debridgeId, bob, amount, alice, executionFee,data),"mint: debridge not exist");
    })

    it('should call internal mint, should  fail native chain', async()=>{
        const maxAmount = 10;
        const collectedFees = 1;
        const balance = 5;
        const lookedInStragegis = 1;
        const minReserveBps = 1;
        const chainFee = 0;
        const exist = true;
        const chainId = 56;
        const chainIdTo =57;
        const amount=2;
        const nonce = 1;
        const token = this.mockToken.address;
        const executionFee = 0;
        const data = '0x00';
        const debridgeId = await this.debridge.getDebridgeId(chainId, token);
        const submissionId = await this.debridge.getSubmisionId(
            debridgeId,
            chainId,
            chainIdTo,
            amount,
            bob,
            nonce
        );
        await this.debridge.mock_set_is_submision_id_used(submissionId,false);
        await this.debridge.mock_set_is_blocked_submission_value(submissionId,false);

        await this.debridge.mock_set_deBridgeInfo(
            debridgeId, 
            token, 
            chainId, 
            maxAmount, 
            collectedFees, 
            balance,
            lookedInStragegis,
            minReserveBps,
            chainFee,
            exist
        );

       await this.debridge.mock_set_chainId(chainId); 
        
       await expectRevert(this.debridge.call_internal_mint(submissionId, debridgeId, bob, amount, alice, executionFee,data),"mint: is native chain");
    })

    it('should call internal mint, execution fee bigger then 0', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi);
        await mockWrappedAsset.mock.mint.returns();
        const maxAmount = 10;
        const collectedFees = 1;
        const balance = 5;
        const lookedInStragegis = 1;
        const minReserveBps = 1;
        const chainFee = 0;
        const exist = true;
        const chainId = 56;
        const chainIdTo =57;
        const amount=2;
        const nonce = 1;
        const token = mockWrappedAsset.address;
        const executionFee = 1;
        const data = [];
        const debridgeId = await this.debridge.getDebridgeId(chainId, token);
        const submissionId = await this.debridge.getSubmisionId(
            debridgeId,
            chainId,
            chainIdTo,
            amount,
            bob,
            nonce
        );
        await this.debridge.mock_set_is_submision_id_used(submissionId,false);
        await this.debridge.mock_set_is_blocked_submission_value(submissionId,false);

        await this.debridge.mock_set_deBridgeInfo(
            debridgeId, 
            token, 
            chainId, 
            maxAmount, 
            collectedFees, 
            balance,
            lookedInStragegis,
            minReserveBps,
            chainFee,
            exist
        );

       await this.debridge.mock_set_chainId(1); 
        
       await this.debridge.call_internal_mint(submissionId, debridgeId, bob, amount, alice, executionFee,data);
    })

    it('should call internal mint, data length bigger then 0', async()=>{
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi);
        await mockWrappedAsset.mock.mint.returns();
        await mockWrappedAsset.mock.balanceOf.returns(0)
        await mockWrappedAsset.mock.allowance.returns(0);
        await mockWrappedAsset.mock.transfer.returns(true);
        await mockWrappedAsset.mock.approve.returns(true);
        let encodedFunctionSignature = web3.eth.abi.encodeFunctionSignature('mint()');
        const maxAmount = 10;
        const collectedFees = 1;
        const balance = 5;
        const lookedInStragegis = 1;
        const minReserveBps = 1;
        const chainFee = 0;
        const exist = true;
        const chainId = 56;
        const chainIdTo =57;
        const amount=2;
        const nonce = 1;
        const token = mockWrappedAsset.address;
        const executionFee = 0;
        const data = encodedFunctionSignature;
        const debridgeId = await this.debridge.getDebridgeId(chainId, token);
        const submissionId = await this.debridge.getSubmisionId(
            debridgeId,
            chainId,
            chainIdTo,
            amount,
            bob,
            nonce
        );
        await this.debridge.mock_set_is_submision_id_used(submissionId,false);
        await this.debridge.mock_set_is_blocked_submission_value(submissionId,false);

        await this.debridge.mock_set_deBridgeInfo(
            debridgeId, 
            token, 
            chainId, 
            maxAmount, 
            collectedFees, 
            balance,
            lookedInStragegis,
            minReserveBps,
            chainFee,
            exist
        );

       await this.debridge.mock_set_chainId(1); 
       await this.debridge.call_internal_mint(submissionId, debridgeId, mockWrappedAsset.address, amount, alice, executionFee,data);
    })

    it('should call internal ensure reserve, as success', async()=>{
        const mockDefiController = await MockDefiController.new({from:alice});
        const maxAmount = 10;
        const collectedFees = 1;
        const balance = '5000000000000000000';
        const lookedInStragegis = 1;
        const minReserveBps = '1000000000000000000';
        const chainFee = 0;
        const exist = true;
        const chainId = 56;
        const chainIdTo =57;
        const amount=2;
        const nonce = 1;
        const token = this.mockToken.address;
        const executionFee = 0;
        const debridgeId = await this.debridge.getDebridgeId(chainId, token);
        await this.debridge.mock_set_deBridgeInfo(
            debridgeId, 
            token, 
            chainId, 
            maxAmount, 
            collectedFees, 
            balance,
            lookedInStragegis,
            minReserveBps,
            chainFee,
            exist
        );
        await this.mockToken.mint(this.debridge.address,'5000000000000000000')
        await this.debridge.mock_set_deFiController(mockDefiController.address);
        const amountEnsureReserves = 1;
        await this.debridge.call_internal_ensureReserve(debridgeId, amountEnsureReserves);
    })

    it('should call set weth with new weth', async()=>{
        const adminSetter = await MockAdminSetter.new({from:alice});
        const WETH9 = await deployments.getArtifact("WETH9");
        const WETH9Factory = await ethers.getContractFactory(WETH9.abi,WETH9.bytecode, alice );
        const newWeth = await WETH9Factory.deploy();
        await this.debridge.mock_set_admin_role(adminSetter.address, {from:alice});
        await adminSetter.set_weth_to_debridge(this.debridge.address, newWeth.address, {from:alice});
        
    })

    it('should call set defi controller with new defi controller', async()=>{
        const adminSetter = await MockAdminSetter.new({from:alice});
        const newDefiController = await DefiController.new({
            from: alice,
        });
        await this.debridge.mock_set_admin_role(adminSetter.address, {from:alice});
        await adminSetter.set_defi_controller_to_debridge(this.debridge.address, newDefiController.address, {from:alice});
    })

})