const { waffle, artifacts, expect } = require("hardhat")
const { expectRevert } = require("@openzeppelin/test-helpers");
const ConfirmationAggregator = artifacts.require("MockConfirmationAggregator");
const ConfirmationAggregatorABI = artifacts.require("../build/ConfirmationAggregator.json")
const MockLinkToken = artifacts.require("MockLinkToken");
const MockToken = artifacts.require("MockToken");
const WrappedAsset = artifacts.require("DeBridgeToken");
const FeeProxy = artifacts.require("FeeProxy");
const CallProxy = artifacts.require("CallProxy");
const MockCallProxy = artifacts.require("MockCallProxy");
const MockCallProxyEmpty = artifacts.require("MockCallProxyEmpty");
const MockCallProxyABI = artifacts.require("../build/CallProxy.json");
const IUniswapV2Pair = artifacts.require("IUniswapV2Pair");
const DefiController = artifacts.require("DefiController");
const FlashReceiver = artifacts.require("MockFlashReceiver");
const FlashReceiverBroken = artifacts.require("MockFlashReceiverBroken");
const SignatureVerifier = artifacts.require("SignatureVerifier");
const SignatureVerifierABI = artifacts.require("../build/SignatureVerifier.json");
const MockTokenABI = artifacts.require("../build/MockToken.json");
const MockDefiController = artifacts.require("MockDefiControllerOne");
const MockFeeProxy = artifacts.require("../build/FeeProxy.json");
const WrappedAssetABI = artifacts.require("../build/DeBridgeToken.json");
const DefiControllerABI = artifacts.require("../build/DefiController.json");
const MockWrappedAsset = artifacts.require("MockDeBridgeToken");
const MockDeBridgeTokenDeployer = artifacts.require("../build/IDeBridgeTokenDeployer.json");
//const MockWETHABI = artifacts.require("../build/WETH9.json");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const { toWei} = web3.utils;
const { BigNumber } = require("ethers")
const MOCK_ADDRESS   = '0x0000000000000000000000000000000000000001';
const ZERO_ADDRESS   = '0x0000000000000000000000000000000000000000';
const MOCK_PERMIT    = '0x73776076d1d562764a521239b8acdb6249d791f2a691a922e301474d90afb396'
const MOCK_SIGNATURE = '0xd3ee395e82769b9e8ec18d0567bdba83e982140787c805eecd7db200291c4071b10ee5df72b9da54450cf739c6a35aef12f7ccab78b3f27679c1b9694da8982ae4'
const MOCK_BYTES32   = '0X08e9f6e736749207285bb00559dd3ac2ab5e95dc6756e60733c13dbd110d9aec'


const expectEvent = require("@openzeppelin/test-helpers/src/expectEvent");
const { deployMockContract } = waffle
const provider = waffle.provider;
//const { DeBridgeGate } = require('../build/contracts/DeBridgeGate.json');
const { defaultAbiCoder } = require("ethers/lib/utils");
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
        const DeBridgeGate = await ethers.getContractFactory("MockDeBridgeGateOne",alice);
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
            {
                from: alice,
            }
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
        await this.confirmationAggregator.addOracles(oracleAddresses, oracleRequired, {
            from: alice,
        });
        aliceAddress=[alice]
        aliceRequired=[true]
        //Alice is required oracle
        await this.confirmationAggregator.addOracles(aliceAddress, aliceRequired, {
            from: alice,
        });

        this.uniswapFactory = await UniswapV2Factory.deploy(carol);
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
        this.feeProxy = await MockFeeProxy.new(
            this.uniswapFactory.address,
            this.weth.address,
            this.linkToken.address,
            {
                from: alice,
            }
        );
        this.debridge = await upgrades.deployProxy(DeBridgeGate, [
            this.excessConfirmations,
            ZERO_ADDRESS,
            ZERO_ADDRESS,
            this.callProxy.address.toString(),
            this.weth.address,
            ZERO_ADDRESS,
            ZERO_ADDRESS,
            devid
          ], { unsafeAllow: ['delegatecall'] });
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
            let isBlocked = await this.debridge.isBlockedSubmission(element, {from:alice});
            expect(isBlocked).to.be.equal(true);
        }
    })

    it('should set CallProxy as admin, should succeed', async() => {
        await this.debridge.setCallProxy(1,'0x5B518A7ede2De53668496cb991542BF6a94051C1', {from:alice})
        let result = await this.debridge.callProxyAddresses(1);
        expect(result).to.equal('0x5B518A7ede2De53668496cb991542BF6a94051C1')

    })

    it('should call an functin that have onlyAdmin modifier, not as admin, should fail', async() => {
        await expectRevert(this.debridge.connect(bobAccount).setCallProxy(1,'0x5B518A7ede2De53668496cb991542BF6a94051C1'),"AdminBadRole()");
    })

    it('should call requestReservers as not defiController, should fail', async() => {
        await expectRevert(
            this.debridge.requestReserves('0x5B518A7ede2De53668496cb991542BF6a94051C1',0, {
              from: alice,
            }),
            "DefiControllerBadRole()"
          );
    })

    it('should pause deBridgeGate when not pause, then unpause, as admin, should succed', async()=>{
        await this.debridge.mock_set_gov_monitoring(alice);
        await this.debridge.pause({from:alice})

        const chainId = 56;
        const chainIdTo = 57;
        const useAssetFee = false;
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi);
        const referralCode = 0;
        const autoParamas = '0x00';
        await mockWrappedAsset.mock.permit.returns();
        await mockWrappedAsset.mock.balanceOf.returns(1000);
        await mockWrappedAsset.mock.transferFrom.returns(true);
        const tokenAddress = mockWrappedAsset.address;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await mockSignatureVerifier.mock.submit.returns();
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 10000,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,1,1)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo,1);

        await expectRevert(this.debridge.send(
            tokenAddress,
            bob,
            10000,
            chainIdTo,
            MOCK_PERMIT,
            useAssetFee,
            referralCode,
            autoParamas,
            {from:alice, value:toWei('1')}
            ),'Pausable: paused');

        await this.debridge.unpause({from:alice})

        await expect(this.debridge.send(
            tokenAddress,
            bob,
            10000,
            chainIdTo,
            MOCK_PERMIT,
            useAssetFee,
            referralCode,
            [],
            {from:alice, value:toWei('1')}
            )).to.emit(this.debridge,'Sent');
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
        const chainId = 1;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deFiController(alice)
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        let debridgeBefore = await this.debridge.getDebridge(debridgeId);
        await this.debridge.returnReserves(tokenAddress, 1, {from:alice})
        let debridgeAfter = await this.debridge.getDebridge(debridgeId);

        expect(debridgeBefore.lockedInStrategies.toNumber()).to.be.above(debridgeAfter.lockedInStrategies.toNumber())

    })

    it('should call return reserve as DefiController, should fail, debridge not found', async()=>{
        const tokenAddress = ZERO_ADDRESS;
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deFiController(alice)
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await expectRevert(this.debridge.returnReserves(tokenAddress, 100, {from:alice}),"DebridgeNotFound()");

    })

    it('should update asset fixed fees, as admin, should succeed', async()=>{
        const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const supportedChainIds=[54,55,chainId]
        const assetFees = [1,2,3]
        await this.debridge.updateAssetFixedFees(debridgeId,supportedChainIds,assetFees)
        for(let i=0;i<supportedChainIds.length;i++){
            let chainFee = await this.debridge.get_chain_fee_map(debridgeId, supportedChainIds[i])
            expect(chainFee).to.be.equal(assetFees[i])
        }

    })

    it('should update chain support, as admin, should succeed', async()=>{
        const supportedChainIds=[54,55,56]
        const chainSupport=[1,true,1]
        const chainSupportInfos=[chainSupport,chainSupport,chainSupport]
        await expect(this.debridge.updateChainSupport(
            supportedChainIds,
            chainSupportInfos,
            {
                from:alice
            }
        )).to.emit(this.debridge,"ChainsSupportUpdated").withArgs(supportedChainIds);
        for(let i=0;i<chainSupport.length;i++){
            let chSupport = await this.debridge.getChainSupport(supportedChainIds[i])
            expect(chSupport[0]).to.be.equal(chainSupportInfos[i][0]);
            expect(chSupport[1]).to.be.equal(chainSupportInfos[i][1]);
            expect(chSupport[2]).to.be.equal(chainSupportInfos[i][2]);
        }
    })

    it('should fo lash loan, should fail, debrdige not found', async()=>{
        const flashReceiver = await FlashReceiver.new(this.dbrToken.address,{from:alice});
        await this.dbrToken.mint(flashReceiver.address,'100000000000000000000');
        await this.dbrToken.mint(this.debridge.address,'100000000000000000000');
        await expectRevert(flashReceiver.doFlashLoan(this.debridge.address, '25000000000000000000', '0x00'),"DebridgeNotFound()");
    })

    it('should fo lash loan, should succeed', async()=>{
        const chainId = 1;
        const tokenAddress = this.dbrToken.address;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        const flashReceiver = await FlashReceiver.new(this.dbrToken.address,{from:alice});
        await this.dbrToken.mint(flashReceiver.address,'100000000000000000000');
        await this.dbrToken.mint(this.debridge.address,'100000000000000000000');
        await flashReceiver.doFlashLoan(
            this.debridge.address,
            '25000000000000000000',
            '0x00'
        );
    })

    it('should Do lash loan, fail not paid', async()=>{
        const chainId = 1;
        const tokenAddress = this.dbrToken.address;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        const flashReceiver = await FlashReceiverBroken.new(this.dbrToken.address,{from:alice});
        await this.dbrToken.mint(flashReceiver.address,'100000000000000000000');
        await this.dbrToken.mint(this.debridge.address,'100000000000000000000');
        await expectRevert(flashReceiver.doFlashLoan(this.debridge.address, '25000000000000000000', '0x00'),"FeeNotPaid()");
    })

    it('should call request reserve as DefiController, should fail, debridge not foud', async()=>{
        const tokenAddress = this.mockToken.address;
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.mockToken.mint(this.debridge.address,100, {from:alice});
        await this.debridge.mock_set_deFiController(alice)
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await expectRevert(this.debridge.requestReserves(tokenAddress, 100, {from:alice}), 'DebridgeNotFound()');
    })

    it('should call request reserve as DefiController, should fail not enough reserves', async()=>{
        const tokenAddress = this.mockToken.address;
        const chainId = 1;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.mockToken.mint(this.debridge.address,100, {from:alice});
        await this.debridge.mock_set_deFiController(alice)
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await expectRevert(this.debridge.requestReserves(tokenAddress, 110, {from:alice}), 'NotEnoughReserves()');
    })

    it('should call request reserve as DefiController, should work', async()=>{
        const tokenAddress = this.mockToken.address;
        const chainId = 1;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.mockToken.mint(this.debridge.address,'10', {from:alice});
        await this.debridge.mock_set_deFiController(alice)
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'255',1,true, {from:alice})
        let debridgeBefore = await this.debridge.getDebridge(debridgeId);
        await this.debridge.requestReserves(tokenAddress, '1', {from:alice});
        let debridgeAfter = await this.debridge.getDebridge(debridgeId);

        expect(debridgeAfter.lockedInStrategies.toNumber()).
        to.
        be.
        above(debridgeBefore.lockedInStrategies.toNumber())
    })


    it('should call send , as admin, use asset fee true should fail amount lower then transferFee amount not cover fes', async()=>{
        const chainId = 1;
        const chainIdTo = 57;
        const useAssetFee = true;
        const referralCode = 0;
        const autoParamas = '0x00';
        const mockWrappedAsset = await MockWrappedAsset.new('Mock','MCK',18,alice,[alice],{from:alice});
        await mockWrappedAsset.mint(alice,1000);
        await mockWrappedAsset.mint(this.debridge.address,1001);
        await mockWrappedAsset.approve(this.debridge.address, 1000, {from:alice});
        const tokenAddress = mockWrappedAsset.address;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await mockSignatureVerifier.mock.submit.returns();
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 10000,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,50000, 50000)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo,2000);
        await this.debridge.mock_set_disctounInfoFixBps(alice,10);
        await expectRevert(this.debridge.send(
                tokenAddress,
                bob,
                3,
                chainIdTo,
                MOCK_PERMIT,
                useAssetFee,
                referralCode,
                autoParamas
                ),"TransferAmountNotCoverFees()");

    });

    it('should call send , as admin, use asset fee true should fail not supported fixed fee', async()=>{
        const chainId = 1;
        const chainIdTo = 57;
        const useAssetFee = true;
        const referralCode = 0;
        const autoParamas = '0x00';
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi);
        await mockWrappedAsset.mock.permit.returns();
        await mockWrappedAsset.mock.balanceOf.returns(1000);
        await mockWrappedAsset.mock.transferFrom.returns(true);
        const tokenAddress = mockWrappedAsset.address;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await mockSignatureVerifier.mock.submit.returns();
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 10000,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,1,'255')
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo,0);
        await expectRevert(
            this.debridge.send(
                tokenAddress,
                bob,
                1,
                chainIdTo,
                MOCK_PERMIT,
                useAssetFee,
                referralCode,
                autoParamas
                ),
            "NotSupportedFixedFee()"
        );
    });

    it('should call send , as admin, use asset fee false should succeed', async()=>{
        const chainId = 56;
        const chainIdTo = 57;
        const useAssetFee = false;
        const mockWrappedAsset = await deployMockContract(aliceAccount, WrappedAssetABI.abi);
        const referralCode = 0;
        const autoParamas = '0x00';
        await mockWrappedAsset.mock.permit.returns();
        await mockWrappedAsset.mock.balanceOf.returns(1000);
        await mockWrappedAsset.mock.transferFrom.returns(true);
        const tokenAddress = mockWrappedAsset.address;
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await mockSignatureVerifier.mock.submit.returns();
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 10000,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.mock_set_amountThreshold(debridgeId,2);
        await this.debridge.mock_set_excessConfirmations(2)
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,1,1)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo,1);

        await expect(this.debridge.send(
            tokenAddress,
            bob,
            10000,
            chainIdTo,
            MOCK_PERMIT,
            useAssetFee,
            referralCode,
            [],
            {from:alice, value:toWei('1')}
            )).to.emit(this.debridge,'Sent');
    });

    it('should update excess confirmations, as admin, should succeed', async()=>{
        await this.debridge.updateExcessConfirmations(2, {from:alice});
    })

    it('should update excess confirmations, as admin, fail wrong arguments', async()=>{
        await expectRevert(this.debridge.updateExcessConfirmations(
            0,
            {
                from:alice
            }
        ),"WrongArgument()");
    })

    it('should update asset, as admin, should succeed', async()=>{
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.updateAsset(debridgeId, 1,1,1, {from:alice});
        let debridge = await this.debridge.getDebridge(debridgeId);
        expect(debridge.maxAmount.toNumber()).to.be.equal(1)
        expect(debridge.minReservesBps).to.be.equal(1);
        let amountThreshold = await this.debridge.getAmountThreshold(debridgeId);
        expect(amountThreshold).to.be.equal(1)
    })

    it('should update asset, as admin, should fail wrong arguments', async()=>{
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await expectRevert(this.debridge.updateAsset(
            debridgeId,
            1,
            65000,
            1,
            {
                from:alice
            }
        ),"WrongArgument()");
    })

    it('should withdraw fee, as admin, should work', async()=>{
        await this.mockToken.mint(this.debridge.address,10);
        const tokenAddress = this.mockToken.address;
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'255',1,true, {from:alice})
        await this.debridge.mock_set_collectedFeesForDebridge(debridgeId,10);
        await this.debridge.setFeeProxy(alice, {from:alice});
        let feeProxyBalanceBefore = await this.mockToken.balanceOf(alice);
        expect(await this.debridge.withdrawFee(debridgeId)).
            to.
            emit(this.debridge,'WithdrawnFee').
            withArgs(debridgeId,10);

        let feeProxyBalanceAfter = await this.mockToken.balanceOf(alice);
        expect(feeProxyBalanceAfter.toNumber()).to.be.above(feeProxyBalanceBefore.toNumber());

    })


    it('should withdraw fee, as admin, fail not enough fee', async()=>{
        await this.mockToken.mint(this.debridge.address,10);
        const tokenAddress = this.mockToken.address;
        const chainId = 56;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'255',1,true, {from:alice})
        await this.debridge.mock_set_collectedFeesForDebridge(debridgeId,10);
        await this.debridge.mock_set_withdrawFeeForDebridge(debridgeId,10);
        await this.debridge.setFeeProxy(alice, {from:alice});
        await expectRevert(this.debridge.withdrawFee(debridgeId),"NotEnoughReserves()");
    })

    it('should withdraw fee, as admin, should work, use native token, eth transfer failed', async()=>{
        await this.mockToken.mint(this.debridge.address,10);
        const tokenAddress = ZERO_ADDRESS;
        const chainId = 1;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'255',1,true, {from:alice})
        await this.debridge.mock_set_collectedFeesForDebridge(debridgeId,10);
        await this.debridge.setFeeProxy(alice, {from:alice});
        await expectRevert(this.debridge.withdrawFee(debridgeId, {from:alice}),'EthTransferFailed()');
    })



    it('should set aggregator', async()=>{
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        await this.debridge.setAggregator(mockSignatureVerifier.address);
        let aggregator = await this.debridge.confirmationAggregator();
        expect(aggregator).to.be.equal(mockSignatureVerifier.address);
    })


    it('should call claim function, data length bigger then zero, native token false, erc20 tokens', async()=>{
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        await mockSignatureVerifier.mock.submit.returns();
        const callProxy = await MockCallProxy.new({from:alice});
        await callProxy.mock_set_gate_role(this.debridge.address);
        const tokenAddress = this.mockToken.address;
        await this.mockToken.mint(this.debridge.address,1000);
        const chainId = 1;
        const chainIdTo= 57;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        const executionFee = 0;
        const flags = 0;
        const fallbackAddress = alice;
        const data='0x00';
        const nativeSender = '0x00';
        const autoParamsAsStruct={
            executionFee: executionFee,
            flags: flags,
            fallbackAddress: fallbackAddress,
            data: data,
            nativeSender: nativeSender
        };
        const hasAutoParams= false;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'255',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        await this.debridge.setCallProxy(0, callProxy.address);
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        const autoParamsAsBytes = '0x00';
        const submisionId = await this.debridge.getSubmissionIdFrom(
            debridgeId,
            chainId,
            amount,
            alice,
            1,
            autoParamsAsStruct,
            hasAutoParams);

        await expect(this.debridge.claim(
            debridgeId,
            chainId,
            bob,
            amount,
            1,
            MOCK_PERMIT,
            [],
            )
        ).to.emit(this.debridge,'Claimed');
    })

    it('should call claim function, params length bigger then zero, native token false, erc20 tokens', async()=>{
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        await mockSignatureVerifier.mock.submit.returns();
        const callProxy = await MockCallProxy.new({from:alice});
        await callProxy.mock_set_gate_role(this.debridge.address);
        const tokenAddress = this.mockToken.address;
        await this.mockToken.mint(this.debridge.address,1000);
        const chainId = 1;
        const chainIdTo= 57;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        const executionFee = 0;
        const flags = 0;
        const fallbackAddress = alice;
        const data='0x00';
        const nativeSender = '0x00';
        const autoParamsAsStruct={
            executionFee: executionFee,
            flags: flags,
            fallbackAddress: fallbackAddress,
            data: data,
            nativeSender: nativeSender
        };
        const hasAutoParams= false;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'255',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        await this.debridge.setCallProxy(0, callProxy.address);
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        const autoParamsAsBytes = '0x00';
        const submisionId = await this.debridge.getSubmissionIdFrom(
            debridgeId,
            chainId,
            amount,
            alice,
            1,
            autoParamsAsStruct,
            hasAutoParams);
        const autoParams = web3.eth.abi.encodeParameters(['uint256', 'uint256', 'bytes', 'bytes'],
            [executionFee, flags,fallbackAddress, data]);
        await expect(this.debridge.claim(
            debridgeId,
            chainId,
            bob,
            amount,
            1,
            MOCK_PERMIT,
            autoParams,
            )
        ).to.emit(this.debridge,'Claimed');
    })

    it('should call internal claim function, data length bigger then zero, native token false, erc20 tokens', async()=>{
        const callProxy = await MockCallProxy.new({from:alice});
        await callProxy.mock_set_gate_role(this.debridge.address);
        const tokenAddress = this.mockToken.address;
        await this.mockToken.mint(this.debridge.address,1000);
        const chainId = 56;
        const chainIdTo= 57;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        const executionFee = 0;
        const flags = 0;
        const fallbackAddress = alice;
        const data='0x00';
        const nativeSender = '0x00';
        const autoParamsAsStruct={
            executionFee: executionFee,
            flags: flags,
            fallbackAddress: fallbackAddress,
            data: data,
            nativeSender: nativeSender
        };
        const hasAutoParams= false;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'255',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        await this.debridge.setCallProxy(0, callProxy.address);
        const autoParamsAsBytes = '0x00';
        const submisionId = await this.debridge.getSubmissionIdFrom(
            debridgeId,
            chainId,
            amount,
            alice,
            1,
            autoParamsAsStruct,
            hasAutoParams);

        expect(await this.debridge.call_internal_claim(
            submisionId,
            debridgeId,
            alice,
            amount,
            autoParamsAsStruct,
            {from:alice})
        ).to.emit(this.debridge,'AutoRequestExecuted');
    })


    it('should call internal claim function, should fail subbmision id already use', async()=>{
        const executionFee = 0;
        const flags = 0;
        const fallbackAddress = alice;
        const data='0x00';
        const nativeSender = '0x00';
        const autoParamsAsStruct={
            executionFee: executionFee,
            flags: flags,
            fallbackAddress: fallbackAddress,
            data: data,
            nativeSender: nativeSender
        };

        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const chainId = 56;
        const chainIdTo= 57;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'255',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        const submisionId = await this.debridge.getSubmissionIdFrom(
            debridgeId,
            chainId,
            amount,
            bob,
            1,
            autoParamsAsStruct,
            false
        );
        await this.debridge.mock_set_is_submision_id_used(submisionId,true);
        await expectRevert(this.debridge.call_internal_claim(submisionId,debridgeId,bob, amount, autoParamsAsStruct),"SubmissionUsed()");
    })

    it('should call internal claim function, should fail debridge not found', async()=>{
        const executionFee = 0;
        const flags = 0;
        const fallbackAddress = alice;
        const data='0x00';
        const nativeSender = '0x00';
        const autoParamsAsStruct={
            executionFee: executionFee,
            flags: flags,
            fallbackAddress: fallbackAddress,
            data: data,
            nativeSender: nativeSender
        };

        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const chainId = 56;
        const chainIdTo= 57;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,'255',1,false, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        const submisionId = await this.debridge.getSubmissionIdFrom(
            debridgeId,
            chainId,
            amount,
            bob,
            1,
            autoParamsAsStruct,
            false
        );
        await this.debridge.mock_set_is_submision_id_used(submisionId,false);
        await expectRevert(this.debridge.call_internal_claim(submisionId,debridgeId,bob, amount, autoParamsAsStruct),"DebridgeNotFound()");
    })

    it('should call internal claim function, execution fee bigger then 0', async()=>{
        await this.debridge.receiveEther(
            {
                from:alice,
                value:ethers.utils.parseEther("1.0")
            }
        )
        const WETH9 = await deployments.getArtifact("WETH9");
        const mockCallProxy = await MockCallProxyEmpty.new();
        const executionFee = 1;
        const flags = 1;
        const fallbackAddress = alice;
        const data='0x00';
        const nativeSender = '0x00';
        const autoParamsAsStruct={
            executionFee: executionFee,
            flags: flags,
            fallbackAddress: fallbackAddress,
            data: data,
            nativeSender: nativeSender
        };
        const mockDeBrdigeToken = await deployMockContract(aliceAccount, WETH9.abi);
        await mockDeBrdigeToken.mock.transfer.returns(true);
        await mockDeBrdigeToken.mock.withdraw.returns();
        const tokenAddress = mockDeBrdigeToken.address;
        const chainId = 1;
        const chainIdTo= 57;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,5,1,'255',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        const submisionId = await this.debridge.getSubmissionIdFrom(
            debridgeId,
            chainId,
            amount,
            bob,
            1,
            autoParamsAsStruct,
            false
        );
        await this.debridge.mock_set_is_submision_id_used(submisionId,false);
        await this.debridge.mock_set_weth(tokenAddress);
        await this.debridge.setCallProxy(0,mockCallProxy.address);
        await expect(this.debridge.call_internal_claim(
            submisionId,
            debridgeId,
            bob,
            amount,
            autoParamsAsStruct
        ),"AutoRequestExecuted()");
    })

    it('should call internal claim function, execution fee bigger then 0, data length 0', async()=>{
        await this.debridge.receiveEther(
            {
                from:alice,
                value:ethers.utils.parseEther("1.0")
            }
        )
        const WETH9 = await deployments.getArtifact("WETH9");
        const mockCallProxy = await MockCallProxyEmpty.new();
        const executionFee = 1;
        const flags = 1;
        const fallbackAddress = alice;
        const data=[];
        const nativeSender = '0x00';
        const autoParamsAsStruct={
            executionFee: executionFee,
            flags: flags,
            fallbackAddress: fallbackAddress,
            data: data,
            nativeSender: nativeSender
        };
        const mockDeBrdigeToken = await deployMockContract(aliceAccount, WETH9.abi);
        await mockDeBrdigeToken.mock.transfer.returns(true);
        await mockDeBrdigeToken.mock.withdraw.returns();
        const tokenAddress = mockDeBrdigeToken.address;
        const chainId = 1;
        const chainIdTo= 57;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const amount = 1;
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,5,1,'255',1,true, {from:alice})
        await this.debridge.mock_set_chainSupportInfo(chainIdTo,true,0,1500)
        await this.debridge.mock_set_fixedFeeChainIdTo(debridgeId, chainIdTo, 1);
        const submisionId = await this.debridge.getSubmissionIdFrom(
            debridgeId,
            chainId,
            amount,
            bob,
            1,
            autoParamsAsStruct,
            false
        );
        await this.debridge.mock_set_is_submision_id_used(submisionId,false);
        await this.debridge.mock_set_weth(tokenAddress);
        await this.debridge.setCallProxy(0,mockCallProxy.address);
        await this.debridge.call_internal_claim(
            submisionId,
            debridgeId,
            bob,
            amount,
            autoParamsAsStruct
        );

    })

    it('should call internal send, permit length 0, is native false, fail wrong target chain',async()=>{
        const permit = [];
        const tokenAddress = ZERO_ADDRESS;
        const amount = 1;
        const chainIdTo = 56;
        const useAssetFee = false;
        await this.debridge.mock_set_native_info(ZERO_ADDRESS,ZERO_ADDRESS, 1)
        await expectRevert(this.debridge.call_internal_send(
            permit,
            tokenAddress,
            amount,
            chainIdTo,
            useAssetFee
        ),"WrongTargedChain()");
    })

    it('should call internal send, permit length 0, is native false, fail transfer amount mismatch',async()=>{
        const permit = [];
        const tokenAddress = ZERO_ADDRESS;
        const amount = 1;
        const chainIdTo = 56;
        const useAssetFee = false;
        await this.debridge.mock_set_native_info(ZERO_ADDRESS,ZERO_ADDRESS, 1)
        await this.debridge.mock_set_chainSupportInfoIsSupported(chainIdTo,true);
        const debridgeId = await this.debridge.getDebridgeId(chainIdTo, tokenAddress);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainIdTo, 0,1,5,1,'255',1,true, {from:alice})
        await expectRevert(this.debridge.call_internal_send(
            permit,
            tokenAddress,
            amount,
            chainIdTo,
            useAssetFee
        ),"AmountMismatch()");
    })

    it('should call internal send, permit length 0, is native false, fail amount mismatch',async()=>{
        const permit = [];
        const tokenAddress = ZERO_ADDRESS;
        const amount = 1;
        const chainIdTo = 56;
        const useAssetFee = false;
        await this.debridge.mock_set_native_info(ZERO_ADDRESS,ZERO_ADDRESS, 1)
        await this.debridge.mock_set_chainSupportInfoIsSupported(chainIdTo,true);
        await expectRevert(this.debridge.call_internal_send(
            permit,
            tokenAddress,
            amount,
            chainIdTo,
            useAssetFee
        ),"AmountMismatch()");
    })

    it('should call internal send, permit length 0, is native false, msg.value equal amount, fail not supported fix fee',async()=>{
        const permit = [];
        const tokenAddress = ZERO_ADDRESS;
        const amount = 1;
        const chainIdTo = 56;
        const useAssetFee = false;
        await this.debridge.mock_set_native_info(ZERO_ADDRESS,ZERO_ADDRESS, 1)
        await this.debridge.mock_set_chainSupportInfoIsSupported(chainIdTo,true);
        await expectRevert(this.debridge.call_internal_send(
            permit,
            tokenAddress,
            amount,
            chainIdTo,
            useAssetFee,
            {
                from:alice,
                value:1
            }
        ),'NotSupportedFixedFee()');
    })

    it('should call internal add asset, should fail zero address', async()=>{
        const chainId = 56;
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_amountThreshold(debridgeId, 1);
        await this.debridge.mock_set_debridge_maxAmount(debridgeId, 1);
        await expectRevert(this.debridge.call_internal_add_asset(debridgeId, tokenAddress, ZERO_ADDRESS, chainId),"ZeroAddress()");
    })

    it('should call internal add asset, should fail zero address', async()=>{
        const chainId = 1;
        const tokenAddress = '0x0000000000000000000000000000000000000000';
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 1,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_amountThreshold(debridgeId, 1);
        await this.debridge.mock_set_debridge_maxAmount(debridgeId, 1);
        await expectRevert(this.debridge.call_internal_add_asset(debridgeId, tokenAddress, ZERO_ADDRESS, chainId),"AssetAlreadyExist()");
    })

    it('should call internal add asset, should work', async()=>{
        const chainId = 1;
        const tokenAddress = MOCK_ADDRESS;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_amountThreshold(debridgeId, 1);
        await this.debridge.mock_set_debridge_maxAmount(debridgeId, 1);
        expect(this.debridge.call_internal_add_asset(
            debridgeId,
            tokenAddress,
            ZERO_ADDRESS,
            chainId),
        ).to.emit(this.debridge,"PairAdded");
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
        await expectRevert(this.debridge.call_internal_checkConfirmations(submisionId, debridgeId, amount, signatures),"SubmissionNotConfirmed()");
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
        await expectRevert(this.debridge.call_internal_checkConfirmations(submisionId, debridgeId, amount, signatures),"SubmissionAmountNotConfirmed()");
    })

    it('should call internal check confirmations, amount bigger or equal with amount threshold, submision blocked', async()=>{
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
        await this.debridge.mock_set_is_blocked_submission_value(submisionId,true);
        await expectRevert(this.debridge.call_internal_checkConfirmations(submisionId, debridgeId, amount, signatures),"SubmissionBlocked()");
    })


    it('should deploy new asset,signatures lenght bigger then 0, should work', async()=>{
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        await mockSignatureVerifier.mock.submit.returns();
        const mockDeBridgeTokenDeployer = await deployMockContract(aliceAccount, MockDeBridgeTokenDeployer.abi);
        await mockDeBridgeTokenDeployer.mock.deployAsset.returns(MOCK_ADDRESS);
        const nativeTokenAddress = MOCK_ADDRESS;
        const nativeChainId=1;
        const name='MOCKTOKEN';
        const symbol='MOCK';
        const decimals=18;
        const signatures='0x00';
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.setDeBridgeTokenDeployer(mockDeBridgeTokenDeployer.address);
        await expect(this.debridge.deployNewAsset(
            nativeTokenAddress,
            nativeChainId,
            name,
            symbol,
            decimals,
            signatures
        )).to.emit(this.debridge,'PairAdded');
    })

    it('should deploy new asset,signatures lenght bigger then 0, should fail, asset already exist', async()=>{
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        await mockSignatureVerifier.mock.submit.returns();
        const mockDeBridgeTokenDeployer = await deployMockContract(aliceAccount, MockDeBridgeTokenDeployer.abi);
        await mockDeBridgeTokenDeployer.mock.deployAsset.returns(MOCK_ADDRESS);
        const nativeTokenAddress = MOCK_ADDRESS;
        const nativeChainId=1;
        const name='MOCKTOKEN';
        const symbol='MOCK';
        const decimals=18;
        const signatures='0x00';
        const debridgeId = await this.debridge.getDebridgeId(nativeChainId, nativeTokenAddress);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, nativeTokenAddress, nativeChainId, 10000,1,1,1,1,1,true, {from:alice})
        await this.debridge.mock_set_signatureVerifier(mockSignatureVerifier.address);
        await this.debridge.setDeBridgeTokenDeployer(mockDeBridgeTokenDeployer.address);
        await expectRevert(this.debridge.deployNewAsset(
            nativeTokenAddress,
            nativeChainId,
            name,
            symbol,
            decimals,
            signatures
        ),"AssetAlreadyExist()");
    })

    it('should deploy new asset,signatures lenght bigger equal 0, should fail, asset not confirmed', async()=>{
        const mockConfirmationAggregator = await deployMockContract(aliceAccount, ConfirmationAggregatorABI.abi);
        await mockConfirmationAggregator.mock.getConfirmedDeployId.returns(MOCK_PERMIT);
        const mockDeBridgeTokenDeployer = await deployMockContract(aliceAccount, MockDeBridgeTokenDeployer.abi);
        await mockDeBridgeTokenDeployer.mock.deployAsset.returns(MOCK_ADDRESS);
        const nativeTokenAddress = MOCK_ADDRESS;
        const nativeChainId=1;
        const name='MOCKTOKEN';
        const symbol='MOCK';
        const decimals=18;
        const signatures=[];
        const debridgeId = await this.debridge.getDebridgeId(nativeChainId, nativeTokenAddress);
        await this.debridge.mock_set_confirmationAggregator(mockConfirmationAggregator.address);
        await this.debridge.setDeBridgeTokenDeployer(mockDeBridgeTokenDeployer.address);
        await expectRevert(this.debridge.deployNewAsset(
            nativeTokenAddress,
            nativeChainId,
            name,
            symbol,
            decimals,
            signatures
        ),"AssetNotConfirmed()");
    })


    it('should get defi available reserves',async()=>{
        const tokenAddress = MOCK_ADDRESS;
        const chainId = 1;
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        await this.debridge.mock_set_deBridgeInfo(debridgeId, tokenAddress, chainId, 10000,1,'100000000000000000000000',1,1,1,true, {from:alice})
        let result = await this.debridge.getDefiAvaliableReserves(MOCK_ADDRESS);
        expect(result.toString()).to.be.equal('99990000000000000000000');
    })

    it('should updateFeeDiscount, should fail, wrong arguments', async()=>{
        const addresss = ZERO_ADDRESS;
        const discountFixBps = 255;
        const discountTransferBps = 255;
        await expectRevert(this.debridge.updateFeeDiscount(
            addresss,
            discountFixBps,
            discountTransferBps),"WrongArgument()");
    })

    it('should updateFeeDiscount, should work', async()=>{
        const addresss = MOCK_ADDRESS;
        const discountFixBps = 255;
        const discountTransferBps = 255;
        await this.debridge.updateFeeDiscount(
            addresss,
            discountFixBps,
            discountTransferBps
        );
        let discountInfo = await this.debridge.feeDiscount(MOCK_ADDRESS);
        expect(discountInfo.discountFixBps).to.be.equal(discountFixBps);
        expect(discountInfo.discountTransferBps).to.be.equal(discountTransferBps);
    })

    it('should set chain support', async()=>{
        const chainId=1;
        const isSupported = true;
        await expect(this.debridge.setChainSupport(
            chainId,
            isSupported)
        ).to.emit(this.debridge, 'ChainSupportUpdated').withArgs(chainId,isSupported);
    })

    it('should call internal validate auto params',async()=>{
        const executionFee = 0;
        const flags = 0;
        const fallbackAddress = alice;
        const data='0x00';
        const nativeSender = '0x00';
        const autoParamsAsStruct={
            executionFee: executionFee,
            flags: flags,
            fallbackAddress: fallbackAddress,
            data: data,
            nativeSender: nativeSender
        };
        const autoParams = web3.eth.abi.encodeParameters(['uint256', 'uint256', 'bytes', 'bytes'],
        [executionFee, flags,fallbackAddress, data]);
        const amount = 0;
        await this.debridge.call_internal_validateAutoParams(autoParams, amount);
    })

    it('block submissions with false is blocked', async()=>{
        const isBlocked = false;
        await expect(this.debridge.blockSubmission(
            [MOCK_PERMIT],
            isBlocked)
        ).to.emit(this.debridge,'Unblocked')
    })

    it('update flash fee, should fail, wrong arguments', async()=>{
        const flashFeeBps = 10000000;
        await expectRevert(this.debridge.updateFlashFee(flashFeeBps),"WrongArgument()");
    })

    it('should set signature verifier', async()=>{
        const mockSignatureVerifier = await deployMockContract(aliceAccount, SignatureVerifierABI.abi);
        await this.debridge.setSignatureVerifier(mockSignatureVerifier.address);
        let result = await this.debridge.signatureVerifier();
        expect(result).to.be.equal(mockSignatureVerifier.address);
    })

    it('should set defi controller', async()=>{
        await this.debridge.setDefiController(MOCK_ADDRESS);
        let result = await this.debridge.defiController();
        expect(result).to.be.equal(MOCK_ADDRESS);
    })

    it('should get native token info',async()=>{
        const nativeAddress = MOCK_ADDRESS;
        const nativeChainId = 56;
        await this.debridge.mock_set_native_info(ZERO_ADDRESS, nativeAddress, nativeChainId)
        let result = await this.debridge.getNativeTokenInfo(ZERO_ADDRESS);
        expect(result[0].toNumber()).to.be.equal(nativeChainId);
        expect(result[1].toString()).to.be.equal(nativeAddress);
    })

    it('should get version', async()=>{
        let result = await this.debridge.version();
        expect(result.toString()).to.be.equal('103');
    })

    it('should revert call with fee proxy bad role',async()=>{
        await expectRevert(this.debridge.withdrawFee(
            MOCK_PERMIT,
            {
                from:alice
            }
        ),"FeeProxyBadRole()")
    })

    it('should revert call with gov monitoring bad role',async()=>{
        await expectRevert(this.debridge.pause(),"GovMonitoringBadRole()")
    })

})