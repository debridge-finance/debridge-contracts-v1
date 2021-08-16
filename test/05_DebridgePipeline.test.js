const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS, permit } = require("./utils.spec");
const MockLinkToken = artifacts.require("MockLinkToken");
const MockToken = artifacts.require("MockToken");
const WrappedAsset = artifacts.require("WrappedAsset");
const MockFeeProxy = artifacts.require("MockFeeProxy");
const CallProxy = artifacts.require("CallProxy");
const IUniswapV2Pair = artifacts.require("IUniswapV2Pair");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const { toWei} = web3.utils;
const { BigNumber } = require("ethers")

const bscWeb3 = new Web3(process.env.TEST_BSC_PROVIDER);
const oracleKeys = JSON.parse(process.env.TEST_ORACLE_KEYS);

function toBN(number){
  return BigNumber.from(number.toString())
}

const MAX = web3.utils.toTwosComplement(-1);
const bobPrivKey =
  "0x79b2a2a43a1e9f325920f99a720605c9c563c61fb5ae3ebe483f83f1230512d3";

const transferFeeBps = 50;
const minReservesBps = 3000;
const BPS = toBN(10000);

const fixedNativeFeeETH = toWei("0.001");
const fixedNativeFeeBNB = toWei("0.05");
const fixedNativeFeeHT = toWei("1");
const isSupported = true;

const ethChainId = 1;
const bscChainId = 56;
const hecoChainId = 256;
let sentEvents = [];
let mintEvents = [];

let burnEvents = [];
let claimEvents = [];

const nativeBSCDebridgeId = '0x8ca679b0f7e259a80b1066b4253c3fdc0d9bdbb15c926fd2a5eab0335bf1f745';
const nativeETHDebridgeId = '0x6ac1b981b4452354ad8bd156fe151bcb91252dea9ed7232af4d0e64b50c09dcf';

contract("DeBridgeGate real pipeline mode",  function() {

  before(async function() {
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
    treasury = devid;
    worker = alice;
    workerAccount = aliceAccount;

    const WETH9 = await deployments.getArtifact("WETH9");
    const WETH9Factory = await ethers.getContractFactory(WETH9.abi,WETH9.bytecode, alice);
    const UniswapV2 = await deployments.getArtifact("UniswapV2Factory");
    const UniswapV2Factory = await ethers.getContractFactory(UniswapV2.abi,UniswapV2.bytecode, alice);

    const ConfirmationAggregatorFactory = await ethers.getContractFactory("ConfirmationAggregator", alice);
    const DeBridgeGateFactory = await ethers.getContractFactory("MockDeBridgeGate", alice);
    const SignatureVerifierFactory = await ethers.getContractFactory("SignatureVerifier",alice);
    const DefiControllerFactory = await ethers.getContractFactory("DefiController", alice);

    this.amountThreshols = toWei("1000");
    this.minConfirmations = 5;
    this.confirmationThreshold = 5; //Confirmations per block before extra check enabled.
    this.excessConfirmations = 7; //Confirmations count in case of excess activity.

    this.initialOracles = [];

    for(let i=1; i<this.signers.length; i++){
      this.initialOracles.push({
          account: this.signers[i],
          address: this.signers[i].address,
          admin: alice
      })
    }

    //-------Deploy mock tokens contracts
    this.cakeToken = await MockToken.new("PancakeSwap Token", "Cake", 18, {
      from: alice,
    });
    this.linkToken = await MockLinkToken.new("ChainLink Token", "LINK", 18, {
      from: alice,
    });
    this.dbrToken = await MockLinkToken.new("DBR", "DBR", 18, {
      from: alice,
    });

    //-------Deploy weth contracts
    this.wethETH = await WETH9Factory.deploy();
    this.wethBSC = await WETH9Factory.deploy();
    this.wethHECO = await WETH9Factory.deploy();

    //-------Deploy uniswap contracts
    this.uniswapFactoryETH = await UniswapV2Factory.deploy(carol);
    this.uniswapFactoryBSC = await UniswapV2Factory.deploy(carol);
    this.uniswapFactoryHECO = await UniswapV2Factory.deploy(carol);

    //-------Deploy FeeProxy contracts
    this.feeProxyETH = await MockFeeProxy.new(
      // this.linkToken.address,
      this.uniswapFactoryETH.address,
      this.wethETH.address,
      {
        from: alice,
      }
    );

    this.feeProxyBSC = await MockFeeProxy.new(
      // this.linkToken.address,
      this.uniswapFactoryBSC.address,
      this.wethBSC.address,
      {
        from: alice,
      }
    );

    this.feeProxyHECO = await MockFeeProxy.new(
      // this.linkToken.address,
      this.uniswapFactoryHECO.address,
      this.wethHECO.address,
      {
        from: alice,
      }
    );

    //Hack override contract chain Id
    await this.feeProxyBSC.overrideChainId(bscChainId);
    await this.feeProxyHECO.overrideChainId(hecoChainId);

    // console.log(`feeProxyETH: ${this.feeProxyETH.address.toString()}`);
    // console.log(`feeProxyBSC: ${this.feeProxyBSC.address.toString()}`);
    // console.log(`feeProxyHECO: ${this.feeProxyHECO.address.toString()}`);

    //-------Deploy callProxy contracts
    this.callProxy = await CallProxy.new({
      from: alice,
    });
    //-------Deploy defiController contracts
    this.defiControllerETH = await upgrades.deployProxy(DefiControllerFactory, []);

    //-------Deploy confirmation aggregator contracts
    //   function initialize(
    //     uint256 _minConfirmations,
    //     uint256 _confirmationThreshold,
    //     uint256 _excessConfirmations,
    //     address _wrappedAssetAdmin,
    //     address _debridgeAddress
    // )
    this.confirmationAggregatorBSC = await upgrades.deployProxy(ConfirmationAggregatorFactory, [
      this.minConfirmations,
      this.confirmationThreshold,
      this.excessConfirmations,
      alice,
      ZERO_ADDRESS
    ]);

    await this.confirmationAggregatorBSC.deployed();

    this.confirmationAggregatorHECO = await upgrades.deployProxy(ConfirmationAggregatorFactory, [
      this.minConfirmations,
      this.confirmationThreshold,
      this.excessConfirmations,
      alice,
      ZERO_ADDRESS
    ]);

    await this.confirmationAggregatorHECO.deployed();

    this.signatureVerifierETH = await upgrades.deployProxy(SignatureVerifierFactory, [
      this.minConfirmations,
      this.confirmationThreshold,
      this.excessConfirmations,
      alice,
      ZERO_ADDRESS
    ]);
    await this.signatureVerifierETH.deployed();

    //-------Deploy DebridgeGate contracts
    //   function initialize(
    //     uint256 _excessConfirmations,
    //     address _signatureVerifier,
    //     address _confirmationAggregator,
    //     address _callProxy,
    //     uint256[] memory _supportedChainIds,
    //     ChainSupportInfo[] memory _chainSupportInfo,
    //     IWETH _weth,
    //     IFeeProxy _feeProxy,
    //     IDefiController _defiController,
    //     address _treasury
    // )
    this.debridgeETH = await upgrades.deployProxy(DeBridgeGateFactory,
      [
        this.excessConfirmations,
        this.signatureVerifierETH.address,
        ZERO_ADDRESS,
        this.callProxy.address.toString(),
        [bscChainId, hecoChainId],
        [
            {
                transferFeeBps,
                fixedNativeFee: fixedNativeFeeETH,
                isSupported,
            },
            {
                transferFeeBps,
                fixedNativeFee: fixedNativeFeeETH,
                isSupported,
            },
        ],
        this.wethETH.address,
        this.feeProxyETH.address,
        this.defiControllerETH.address,
        treasury,
        ethChainId //overrideChainId
      ],
      {
        initializer: 'initializeMock',
        kind: 'transparent',
      }
    );

    this.debridgeBSC = await upgrades.deployProxy(DeBridgeGateFactory,
      [
        this.excessConfirmations,
        ZERO_ADDRESS,
        this.confirmationAggregatorBSC.address,
        this.callProxy.address.toString(),
        [ethChainId, hecoChainId], //supportedChainIds,
        [
          {
            transferFeeBps,
            fixedNativeFee: fixedNativeFeeBNB,
            isSupported,
          },
          {
            transferFeeBps,
            fixedNativeFee: fixedNativeFeeBNB,
            isSupported,
          },
        ],
        this.wethBSC.address,
        this.feeProxyBSC.address,
        ZERO_ADDRESS,
        treasury,
        bscChainId //overrideChainId
      ],
      {
        initializer: 'initializeMock',
        kind: 'transparent',
      }
    );

    this.debridgeHECO = await upgrades.deployProxy(DeBridgeGateFactory,
      [
        this.excessConfirmations,
        ZERO_ADDRESS,
        this.confirmationAggregatorHECO.address,
        this.callProxy.address.toString(),
        [ethChainId, bscChainId], //supportedChainIds,
        [
          {
            transferFeeBps,
            fixedNativeFee: fixedNativeFeeHT,
            isSupported,
          },
          {
            transferFeeBps,
            fixedNativeFee: fixedNativeFeeHT,
            isSupported,
          },
        ],
        this.wethHECO.address,
        this.feeProxyHECO.address,
        ZERO_ADDRESS,
        treasury,
        hecoChainId //overrideChainId
      ],
      {
        initializer: 'initializeMock',
        kind: 'transparent',
      }
    );

    await this.signatureVerifierETH.setDebridgeAddress(this.debridgeETH.address);

    this.linkDebridgeId = await this.debridgeETH.getDebridgeId(ethChainId, this.linkToken.address);
    this.cakeDebridgeId = await this.debridgeETH.getDebridgeId(bscChainId, this.cakeToken.address);

    this.nativeDebridgeIdETH = await this.debridgeETH.nativeDebridgeId();
    this.nativeDebridgeIdBSC = await this.debridgeBSC.nativeDebridgeId();
    this.nativeDebridgeIdHECO = await this.debridgeHECO.nativeDebridgeId();
  });
  context("Configure contracts", () => {
    it("Check init contract params", async function() {
      //TODO: check that correct binding in constructor
      assert.equal(this.uniswapFactoryETH.address.toString(), await this.feeProxyETH.uniswapFactory());
      assert.equal(this.uniswapFactoryBSC.address.toString(), await this.feeProxyBSC.uniswapFactory());
      assert.equal(this.uniswapFactoryHECO.address.toString(), await this.feeProxyHECO.uniswapFactory());

      assert.equal(ZERO_ADDRESS, await this.debridgeETH.confirmationAggregator());
      assert.equal(this.confirmationAggregatorBSC.address, await this.debridgeBSC.confirmationAggregator());
      assert.equal(this.confirmationAggregatorHECO.address, await this.debridgeHECO.confirmationAggregator());

      // assert.equal(ZERO_ADDRESS, await this.confirmationAggregatorETH.debridgeAddress());
      assert.equal(ZERO_ADDRESS, await this.confirmationAggregatorBSC.debridgeAddress());
      assert.equal(ZERO_ADDRESS, await this.confirmationAggregatorHECO.debridgeAddress());

      assert.equal(ZERO_ADDRESS, await this.feeProxyETH.debridgeGate());
      assert.equal(ZERO_ADDRESS, await this.feeProxyBSC.debridgeGate());
      assert.equal(ZERO_ADDRESS,await this.feeProxyHECO.debridgeGate());

      assert.equal(this.feeProxyETH.address, await this.debridgeETH.feeProxy());
      assert.equal(this.feeProxyBSC.address, await this.debridgeBSC.feeProxy());
      assert.equal(this.feeProxyHECO.address, await this.debridgeHECO.feeProxy());


      assert.equal(treasury, await this.debridgeETH.treasury());
      assert.equal(treasury, await this.debridgeBSC.treasury());
      assert.equal(treasury, await this.debridgeHECO.treasury());


      assert.equal(this.defiControllerETH.address, await this.debridgeETH.defiController());
      assert.equal(ZERO_ADDRESS, await this.debridgeBSC.defiController());
      assert.equal(ZERO_ADDRESS, await this.debridgeHECO.defiController());

      assert.equal(this.wethETH.address, await this.debridgeETH.weth());
      assert.equal(this.wethBSC.address, await this.debridgeBSC.weth());
      assert.equal(this.wethHECO.address, await this.debridgeHECO.weth());
    });
    it("Initialize oracles", async function() {
      for (let oracle of this.initialOracles) {
        await this.confirmationAggregatorBSC.addOracle(oracle.address, oracle.admin, false, {
          from: alice,
        });
        await this.confirmationAggregatorHECO.addOracle(oracle.address, oracle.admin, false, {
          from: alice,
        });
      }
      //Alice is required oracle
      await this.confirmationAggregatorBSC.addOracle(alice, alice, true, {
        from: alice,
      });
      await this.confirmationAggregatorHECO.addOracle(alice, alice, true, {
        from: alice,
      });


      for (let oracle of this.initialOracles) {
        await this.signatureVerifierETH.addOracle(oracle.address, oracle.address, false, {
          from: alice,
        });
      }

      //Alice is required oracle
      await this.signatureVerifierETH.addOracle(alice, alice, true, {
        from: alice,
      });

      //TODO: check that we added oracles
    });
  });

  context("Test setting configurations by different users", () => {
    it("should set aggregator if called by the admin", async function() {
      let testAddress = "0x765bDC94443b2D87543ee6BdDEE2208343C8C07A";
      await this.debridgeETH.setAggregator(testAddress);
      assert.equal(testAddress, await this.debridgeETH.confirmationAggregator());
      //Return to ZERO_ADDRESS
      await this.debridgeETH.setAggregator(ZERO_ADDRESS);
      assert.equal(ZERO_ADDRESS, await this.debridgeETH.confirmationAggregator());
    });

    it("should set debridgeGate to confirmationAggregator if called by the admin", async function() {
      await this.confirmationAggregatorBSC.setDebridgeAddress(this.debridgeBSC.address.toString());
      assert.equal(this.debridgeBSC.address.toString(), await this.confirmationAggregatorBSC.debridgeAddress());

      await this.confirmationAggregatorHECO.setDebridgeAddress(this.debridgeHECO.address.toString());
      assert.equal(this.debridgeHECO.address.toString(), await this.confirmationAggregatorHECO.debridgeAddress());
    });

    it("should set debridgeGate to fee proxy if called by the admin", async function() {
      await this.feeProxyETH.setDebridgeGate(this.debridgeETH.address.toString())
      await this.feeProxyBSC.setDebridgeGate(this.debridgeBSC.address.toString())
      await this.feeProxyHECO.setDebridgeGate(this.debridgeHECO.address.toString())
      assert.equal(this.debridgeETH.address.toString(), await this.feeProxyETH.debridgeGate());
      assert.equal(this.debridgeBSC.address.toString(), await this.feeProxyBSC.debridgeGate());
      assert.equal(this.debridgeHECO.address.toString(), await this.feeProxyHECO.debridgeGate());
    });
    it("should set fee proxy if called by the admin", async function() {
      let testAddress = "0x765bDC94443b2D87543ee6BdDEE2208343C8C07A";
      await this.debridgeETH.setFeeProxy(testAddress);
      assert.equal(testAddress, await this.debridgeETH.feeProxy());
      //restore back
      await this.debridgeETH.setFeeProxy(this.feeProxyETH.address);
      assert.equal(this.feeProxyETH.address, await this.debridgeETH.feeProxy());
    });

    it("should set defi controller if called by the admin", async function() {
      let testAddress = "0x765bDC94443b2D87543ee6BdDEE2208343C8C07A";
      await this.debridgeBSC.setDefiController(testAddress);
      assert.equal(testAddress, await this.debridgeBSC.defiController());
      //restore back
      await this.debridgeBSC.setDefiController(ZERO_ADDRESS);
      assert.equal(ZERO_ADDRESS, await this.debridgeBSC.defiController());
    });

    // setWeth removed from contract
    // it("should set weth if called by the admin", async function() {
    //   let testAddress = "0x765bDC94443b2D87543ee6BdDEE2208343C8C07A";
    //   await this.debridgeETH.setWeth(testAddress);
    //   assert.equal(testAddress, await this.debridgeETH.weth());
    //   //restore back
    //   await this.debridgeETH.setWeth(this.wethETH.address);
    //   assert.equal(this.wethETH.address, await this.debridgeETH.weth());
    // });

    it("should reject setting aggregator if called by the non-admin", async function() {
      await expectRevert(
        this.debridgeETH.connect(bobAccount).setAggregator(ZERO_ADDRESS),
        "bad role"
      );
    });

    it("should reject setting fee proxy if called by the non-admin", async function() {
      await expectRevert(
        this.debridgeETH.connect(bobAccount).setFeeProxy(ZERO_ADDRESS),
        "bad role"
      );
    });

    it("should reject setting defi controller if called by the non-admin", async function() {
      await expectRevert(
        this.debridgeETH.connect(bobAccount).setDefiController(ZERO_ADDRESS),
        "bad role"
      );
    });

    // setWeth removed from contract
    // it("should reject setting weth if called by the non-admin", async function() {
    //   await expectRevert(
    //     this.debridgeETH.connect(bobAccount).setWeth(ZERO_ADDRESS),
    //     "onlyAdmin: bad role"
    //   );
    // });
  });

  context("Test managing assets", () => {
    before(async function() {
      currentChainId = await this.debridgeETH.chainId();
      const newSupply = toWei("100");
      await this.linkToken.mint(alice, newSupply, {
        from: alice,
      });
      await this.dbrToken.mint(alice, newSupply, {
        from: alice,
      });
    });

    it("should confirm new asset if called by the oracles", async function() {
      const tokenAddress = this.linkToken.address;
      const chainId = ethChainId;
      const maxAmount = toWei("1000000");
      const amountThreshold = toWei("10");
      const name =  await this.linkToken.name();
      const symbol =  await this.linkToken.symbol();
      const decimals = (await this.linkToken.decimals()).toString();
      const debridgeId = await this.confirmationAggregatorBSC.getDebridgeId(
        chainId,
        tokenAddress
      );
      for (let oracle of this.initialOracles) {
        await this.confirmationAggregatorBSC.connect(oracle.account).confirmNewAsset(tokenAddress, chainId, name, symbol, decimals);
      }

      const deployId  =  await this.confirmationAggregatorBSC.getDeployId(debridgeId, name, symbol, decimals);
      //Check that new assets is confirmed
      assert.equal(deployId, await this.confirmationAggregatorBSC.confirmedDeployInfo(debridgeId));
      await this.debridgeBSC.updateAsset(debridgeId, maxAmount, minReservesBps, amountThreshold);
      const debridge = await this.debridgeBSC.getDebridge(debridgeId);
      assert.equal(debridge.maxAmount.toString(), maxAmount);
      assert.equal(debridge.collectedFees.toString(), "0");
      assert.equal(debridge.balance.toString(), "0");
      assert.equal(debridge.minReservesBps.toString(), minReservesBps);

      assert.equal(await this.debridgeBSC.getAmountThreshold(debridgeId), amountThreshold);


      for (let oracle of this.initialOracles) {
        await this.confirmationAggregatorBSC.connect(oracle.account)
          .confirmNewAsset(ZERO_ADDRESS, ethChainId, "Wrapped ETH", "deETH", 18);
        await this.confirmationAggregatorHECO.connect(oracle.account)
          .confirmNewAsset(ZERO_ADDRESS, ethChainId, "Wrapped ETH", "deETH", 18);
        await this.confirmationAggregatorBSC.connect(oracle.account)
          .confirmNewAsset(ZERO_ADDRESS, hecoChainId, "Wrapped HT", "deHT", 18);
        await this.confirmationAggregatorHECO.connect(oracle.account)
          .confirmNewAsset(this.cakeToken.address, bscChainId, "PancakeSwap Token", "Cake", 18);
        await this.confirmationAggregatorHECO.connect(oracle.account)
          .confirmNewAsset(ZERO_ADDRESS, bscChainId, "Wrapped BNB", "deBNB", 18);
      }
    });
  });

  //TODO: ADDDDD
  //it("should reject add external asset without DSRM confirmation", async function() {
  //  const tokenAddress = "0x5A0b54D5dc17e0AadC383d2db43B0a0D3E029c4c";
  //  const chainId = 56;
  //  const name = "SPARK";
  //  const symbol = "SPARK Dollar";
  //  const decimals = 18;

  //  //start from 1 (skipped alice)
  //  for (let i = 1; i < this.initialOracles.length; i++) {
  //    this.confirmationAggregator.confirmNewAsset(tokenAddress, chainId, name, symbol, decimals, {
  //      from: this.initialOracles[i],
  //    })
  //  }

  //  //TODO: need to deploy assets by debridge gate
  //  await expectRevert(
  //      this.confirmationAggregator.confirmNewAsset(tokenAddress, chainId, name, symbol, decimals, signatures, {
  //      from: alice,
  //    }),
  //    "Not confirmed by required oracles"
  //  );
  //});

  //it("should reject add external asset without -1 confirmation", async function() {
  //  const tokenAddress = "0x5A0b54D5dc17e0AadC383d2db43B0a0D3E029c4c";
  //  const chainId = 56;
  //  const name = "MUSD";
  //  const symbol = "Magic Dollar";
  //  const decimals = 18;

  //  for (let i = 1; i < this.initialOracles.length; i++) {
  //    this.confirmationAggregator.confirmNewAsset(tokenAddress, chainId, name, symbol, decimals, {
  //      from: this.initialOracles[i],
  //    })
  //  }

  //  //TODO: need to deploy assets by debridge gate
  //  await expectRevert(
  //      this.signatureVerifier.confirmNewAsset(tokenAddress, chainId, name, symbol, decimals, signatures, {
  //      from: alice,
  //    }),
  //    "not confirmed"
  //  );
  //});

  // it("should update excessConfirmations if called by the admin", async function() {
  //   let newExcessConfirmations = 9;
  //   await this.debridgeETH.updateExcessConfirmations(
  //     newExcessConfirmations,
  //     {
  //       from: alice,
  //     }
  //   );
  //   assert.equal(await this.debridgeETH.excessConfirmations(), newExcessConfirmations);
  // });

  for (let i = 0; i <= 2; i++) {
    let discount = 0;
    switch (i) {
      case 0:
        discount=0;
        break;
      case 1:
        discount=5000; //50%
        break;
      case 2:
        discount=10000; //100%
        break;
      default:
        discount=0;
    }
    context(`Test send method from ETH to BSC. discount: ${discount*100/BPS}%`, () => {
      it(`set discount ${discount*100/BPS}% fee for customer alice`, async function() {
        await this.debridgeETH.updateFeeDiscount(alice, discount, discount);
        const discountFromContract =  await this.debridgeETH.feeDiscount(alice);
        expect(discount).to.equal(discountFromContract.discountTransferBps);
        expect(discount).to.equal(discountFromContract.discountFixBps);
      });

      it("should send native tokens", async function() {
        const tokenAddress = ZERO_ADDRESS;
        const chainId = await this.debridgeETH.chainId();
        const receiver = bob;
        const amount = toBN(toWei("10"));
        const chainIdTo = bscChainId;
        const debridgeId = await this.debridgeETH.getDebridgeId(
          chainId,
          tokenAddress
        );
        const balance = toBN(await web3.eth.getBalance(this.debridgeETH.address));
        const debridge = await this.debridgeETH.getDebridge(debridgeId);
        const supportedChainInfo = await this.debridgeETH.getChainSupport(chainIdTo);
        let feesWithFix = toBN(supportedChainInfo.transferFeeBps)
          .mul(amount)
          .div(BPS)
          .add(toBN(supportedChainInfo.fixedNativeFee));
        feesWithFix = toBN(feesWithFix).sub(toBN(feesWithFix).mul(discount).div(BPS));

        let sendTx = await this.debridgeETH.send(
          tokenAddress,
          receiver,
          amount,
          chainIdTo,
          false,
          {
            value: amount,
            from: alice,
          }
        );

        let receipt = await sendTx.wait();
        let sentEvent = receipt.events?.find((x) => {return x.event == "Sent"});
        sentEvents.push(sentEvent);

        const newBalance = toBN(await web3.eth.getBalance(this.debridgeETH.address));
        const newDebridgeInfo = await this.debridgeETH.getDebridge(debridgeId);
        assert.equal(balance.add(amount).toString(), newBalance.toString());
        assert.equal(
          debridge.collectedFees
            .add(feesWithFix)
            .toString(),
            newDebridgeInfo.collectedFees.toString()
        );
      });

      it("should send ERC20 tokens", async function() {
        const tokenAddress = this.linkToken.address;
        const chainId = await this.debridgeETH.chainId();
        const receiver = bob;
        const amount = toBN(toWei("100"));
        const chainIdTo = bscChainId;
        await this.linkToken.mint(alice, amount, {
          from: alice,
        });
        await this.linkToken.approve(this.debridgeETH.address, amount, {
          from: alice,
        });
        const debridgeId = await this.debridgeETH.getDebridgeId(
          chainId,
          tokenAddress
        );

        const balance = toBN(
          await this.linkToken.balanceOf(this.debridgeETH.address)
        );
        const debridgeInfo = await this.debridgeETH.getDebridge(debridgeId);
        const supportedChainInfo = await this.debridgeETH.getChainSupport(chainIdTo);
        const nativeDebridgeInfo = await this.debridgeETH.getDebridge(this.nativeDebridgeIdETH);
        let fees = toBN(supportedChainInfo.transferFeeBps)
          .mul(amount)
          .div(BPS);
        fees = toBN(fees).sub(toBN(fees).mul(discount).div(BPS));
        let sendTx = await this.debridgeETH.send(
          tokenAddress,
          receiver,
          amount,
          chainIdTo,
          false,
          {
            value: supportedChainInfo.fixedNativeFee,
            from: alice,
          }
        );

        let receipt = await sendTx.wait();
        let sentEvent = receipt.events?.find((x) => {return x.event == "Sent"});
        sentEvents.push(sentEvent);

        const newNativeDebridgeInfo = await this.debridgeETH.getDebridge(this.nativeDebridgeIdETH);
        const newBalance = toBN(
          await this.linkToken.balanceOf(this.debridgeETH.address)
        );
        const newDebridge = await this.debridgeETH.getDebridge(debridgeId);
        assert.equal(balance.add(amount).toString(), newBalance.toString());
        assert.equal(
          debridgeInfo.collectedFees.add(fees).toString(),
          newDebridge.collectedFees.toString()
        );
        assert.equal(
          nativeDebridgeInfo.collectedFees
            .add(toBN(supportedChainInfo.fixedNativeFee))
            .toString(),
            newNativeDebridgeInfo.collectedFees.toString()
        );
      });

      it("should reject sending too mismatched amount of native tokens", async function() {
        const tokenAddress = ZERO_ADDRESS;
        const receiver = bob;
        const amount = toBN(toWei("1"));
        const chainIdTo = bscChainId;
        await expectRevert(
          this.debridgeETH.send(tokenAddress, receiver, amount, chainIdTo, false, {
            value: toWei("0.1"),
            from: alice,
          }),
          "send: amount mismatch"
        );
      });

      it("should reject sending tokens to unsupported chain", async function() {
        const tokenAddress = ZERO_ADDRESS;
        const receiver = bob;
        const amount = toBN(toWei("1"));
        const chainIdTo = 9999;
        await expectRevert(
          this.debridgeETH.send(tokenAddress, receiver, amount, chainIdTo, false, {
            value: amount,
            from: alice,
          }),
          "wrong targed chain"
        );
      });
    });
  }



  context("Test mint method (BSC network)", () => {
    before(async function() {
        this.nativeSubmission = sentEvents.find((x) => {return x.args.debridgeId == nativeETHDebridgeId});
        this.nativeSubmissionId = this.nativeSubmission.args.submissionId;

        this.linkSubmission = sentEvents.find((x) => {return x.args.debridgeId == this.linkDebridgeId});
        this.linkSubmissionId = this.linkSubmission.args.submissionId;
    });
    it("Oracles confirm transfers (without required oracle)", async function() {
      for (let sentEvent of sentEvents) {
        for (let oracle of this.initialOracles) {
          await this.confirmationAggregatorBSC.connect(oracle.account).submit(sentEvent.args.submissionId);
        }
      }
    });
    it("check confirmation without required oracle", async function() {
      let submissionInfo = await this.confirmationAggregatorBSC.getSubmissionInfo(this.nativeSubmissionId);
      let submissionConfirmations = await this.confirmationAggregatorBSC.getSubmissionConfirmations(this.nativeSubmissionId);

      assert.equal(submissionInfo.confirmations, this.initialOracles.length);
      assert.equal(submissionInfo.requiredConfirmations, 0);
      assert.equal(submissionInfo.isConfirmed, false);

      assert.equal(this.initialOracles.length, submissionConfirmations[0]);
      assert.equal(false, submissionConfirmations[1]);
    });

    it("should reject native token without confirmation from required oracle", async function() {
      await expectRevert(
        this.debridgeBSC.mint(
          nativeETHDebridgeId,
          ethChainId,
          this.nativeSubmission.args.receiver,
          this.nativeSubmission.args.amount,
          this.nativeSubmission.args.nonce,
          [],
          {
            from: alice,
          }
        ),
        "not confirmed"
      );
    });

    it("confirm by required oracle", async function() {
      await this.confirmationAggregatorBSC.submit(this.nativeSubmissionId, {
        from: alice,
      });

      await this.confirmationAggregatorBSC.submit(this.linkSubmissionId, {
        from: alice,
      });
    });

    it("check confirmations", async function() {
      const submissionInfo = await this.confirmationAggregatorBSC.getSubmissionInfo(
        this.nativeSubmissionId
      );
      // struct SubmissionInfo {
      //   uint256 block; // confirmation block
      //   uint256 confirmations; // received confirmations count
      //   uint256 requiredConfirmations; // required oracles (DSRM) received confirmations count
      //   bool isConfirmed; // is confirmed submission (user can claim)
      //   mapping(address => bool) hasVerified; // verifier => has already voted
      // }
      assert.equal(submissionInfo.confirmations, this.initialOracles.length+1);
      assert.equal(submissionInfo.requiredConfirmations, 1);
      assert.equal(submissionInfo.isConfirmed, true);
    });

    //TODO: should reject exceed amount
    // it("should reject exceed amount", async function() {

    //   const debridgeId = await this.debridgeETH.getDebridgeId(
    //     chainId,
    //     tokenAddress
    //   );
    //   await expectRevert(
    //     this.debridgeETH.mint(
    //       debridgeId,
    //       chainId,
    //       receiver,
    //       amount,
    //       nonce,
    //       [],
    //       {
    //         from: alice,
    //       }
    //     ),
    //     "amount not confirmed"
    //   );
    // });

    it("update reduce ExcessConfirmations if called by the admin", async function() {
      let newExcessConfirmations = 3;
      await this.debridgeBSC.updateExcessConfirmations(
        newExcessConfirmations,
        {
          from: alice,
        }
      );
      assert.equal(await this.debridgeBSC.excessConfirmations(), newExcessConfirmations);
    });

    it("should reject when the submission is blocked", async function() {
      await this.debridgeBSC.blockSubmission([this.nativeSubmissionId], true, {
        from: alice,
      });
      assert.equal(
        await this.debridgeBSC.isBlockedSubmission(this.nativeSubmissionId),
        true
      );
      await expectRevert(
        this.debridgeBSC.mint(
          nativeETHDebridgeId,
          ethChainId,
          this.nativeSubmission.args.receiver,
          this.nativeSubmission.args.amount,
          this.nativeSubmission.args.nonce,
          [],
          {
            from: alice,
          }
        ),
        "blocked submission"
      );
    });

    it("should unblock the submission by admin", async function() {
      await this.debridgeBSC.blockSubmission([this.nativeSubmissionId], false, {
        from: alice,
      });
      assert.equal(
        await this.debridgeBSC.isBlockedSubmission(this.nativeSubmissionId),
        false
      );
    })

    it("should mint (deETH) when the submission is approved", async function() {
      const balance = toBN("0");

      //   function mint(
      //     address _tokenAddress,
      //     uint256 _chainId,
      //     uint256 _chainIdFrom,
      //     address _receiver,
      //     uint256 _amount,
      //     uint256 _nonce,
      //     bytes[] calldata _signatures
      // )


      // console.log("nativeDebridgeId: "+await this.debridgeBSC.nativeDebridgeId());
      // console.log("getDebridgeId(ethChainId, ZERO_ADDRESS): "+await this.debridgeBSC.getDebridgeId(ethChainId, ZERO_ADDRESS));
      // console.log("this.nativeETHDebridgeId: "+ nativeETHDebridgeId);
      // console.log(await this.debridgeBSC.getDebridge(nativeETHDebridgeId));

      await this.debridgeBSC.mint(
        nativeETHDebridgeId,
        ethChainId,
        this.nativeSubmission.args.receiver,
        this.nativeSubmission.args.amount,
        this.nativeSubmission.args.nonce,
        [],
        {
          from: alice,
        }
      );
      const debridgeInfo = await this.debridgeBSC.getDebridge(nativeETHDebridgeId);
      const wrappedAsset = await WrappedAsset.at(debridgeInfo.tokenAddress);
      const newBalance = toBN(await wrappedAsset.balanceOf(this.nativeSubmission.args.receiver));

      const submissionId = await this.debridgeBSC.getSubmisionId(
        nativeETHDebridgeId,
        ethChainId,
        bscChainId,
        this.nativeSubmission.args.amount,
        this.nativeSubmission.args.receiver,
        this.nativeSubmission.args.nonce,
      );
      const isSubmissionUsed = await this.debridgeBSC.isSubmissionUsed(
        submissionId
      );
      assert.equal(balance.add(this.nativeSubmission.args.amount).toString(), newBalance.toString());
      assert.ok(isSubmissionUsed);

      const nativeTokenInfo = await this.debridgeBSC.getNativeInfo(debridgeInfo.tokenAddress);
      assert.equal(ethChainId.toString(), nativeTokenInfo.chainId.toString());
      assert.equal(ZERO_ADDRESS, nativeTokenInfo.nativeAddress.toString());
    });

    it("should mint (deLink) when the submission is approved ", async function() {
      const balance = toBN("0");

      //   function mint(
      //     address _tokenAddress,
      //     uint256 _chainId,
      //     uint256 _chainIdFrom,
      //     address _receiver,
      //     uint256 _amount,
      //     uint256 _nonce,
      //     bytes[] calldata _signatures
      // )

      await this.debridgeBSC.mint(
        this.linkDebridgeId,
        ethChainId,
        this.linkSubmission.args.receiver,
        this.linkSubmission.args.amount,
        this.linkSubmission.args.nonce,
        [],
        {
          from: alice,
        }
      );
      const debridgeInfo = await this.debridgeBSC.getDebridge(this.linkDebridgeId);
      const wrappedAsset = await WrappedAsset.at(debridgeInfo.tokenAddress);
      const newBalance = toBN(await wrappedAsset.balanceOf(this.linkSubmission.args.receiver));
      const submissionId = await this.debridgeBSC.getSubmisionId(
        this.linkDebridgeId,
        ethChainId,
        bscChainId,
        this.linkSubmission.args.amount,
        this.linkSubmission.args.receiver,
        this.linkSubmission.args.nonce,
      );
      const isSubmissionUsed = await this.debridgeBSC.isSubmissionUsed(
        submissionId
      );
      assert.equal(balance.add(this.linkSubmission.args.amount).toString(), newBalance.toString());
      assert.ok(isSubmissionUsed);

      const nativeTokenInfo = await this.debridgeBSC.getNativeInfo(debridgeInfo.tokenAddress);
      assert.equal(ethChainId.toString(), nativeTokenInfo.chainId.toString());
      assert.equal(this.linkToken.address.toLowerCase(), nativeTokenInfo.nativeAddress.toString());
    });

    it("should reject minting with unconfirmed submission", async function() {
      const wrongNonce = 4;
      await expectRevert(
        this.debridgeBSC.mint(
          nativeETHDebridgeId,
          ethChainId,
          this.nativeSubmission.args.receiver,
          this.nativeSubmission.args.amount,
          wrongNonce,
          [],
          {
            from: alice,
          }
        ),
        "not confirmed"
      );
    });

    it("should reject minting twice", async function() {
      await expectRevert(
        this.debridgeBSC.mint(
          nativeETHDebridgeId,
          ethChainId,
          this.nativeSubmission.args.receiver,
          this.nativeSubmission.args.amount,
          this.nativeSubmission.args.nonce,
          [],
          {
            from: alice,
          }
        ),
        "submission already used"
      );
    });
  });

for (let i = 0; i <= 2; i++) {
  let discount = 0;
  switch (i) {
    case 0:
      discount=0;
      break;
    case 1:
      discount=5000; //50%
      break;
    case 2:
      discount=10000; //100%
      break;
    default:
      discount=0;
  }
  context(`Test burn method (BSC network) discount: ${discount*100/BPS}%`, () => {
    before(async function() {
    });

    it(`set discount ${discount*100/BPS}% fee for customer bob`, async function() {
      await this.debridgeBSC.updateFeeDiscount(bob, discount, discount);
      const discountFromContract =  await this.debridgeBSC.feeDiscount(bob);
      expect(discount).to.equal(discountFromContract.discountTransferBps);
      expect(discount).to.equal(discountFromContract.discountFixBps);
    });

    it("should burning (deETH, deLink) when the amount is suficient", async function() {
      let debridgeIds = [nativeETHDebridgeId, this.linkDebridgeId];
      for (let debridgeId of debridgeIds) {
        const chainIdTo = ethChainId;
        const receiver = bob;
        const amount = toBN(toWei("1"));
        const debridgeInfo = await this.debridgeBSC.getDebridge(debridgeId);
        const wrappedAsset = await WrappedAsset.at(debridgeInfo.tokenAddress);
        const balance = toBN(await wrappedAsset.balanceOf(bob));
        const deadline = toBN(MAX_UINT256);
        const supportedChainInfo = await this.debridgeBSC.getChainSupport(chainIdTo);
        const signature = await permit(
          wrappedAsset,
          bob,
          this.debridgeBSC.address,
          amount,
          deadline,
          bobPrivKey
        );
        const nativeDebridgeInfo = await this.debridgeBSC.getDebridge(nativeBSCDebridgeId);
        let fixedNativeFeeWithDiscount = supportedChainInfo.fixedNativeFee;
        fixedNativeFeeWithDiscount = toBN(fixedNativeFeeWithDiscount).sub(toBN(fixedNativeFeeWithDiscount).mul(discount).div(BPS));
        let burnTx = await this.debridgeBSC.connect(bobAccount).burn(
          debridgeId,
          receiver,
          amount,
          chainIdTo,
          deadline,
          signature,
          false,
          {
            value: fixedNativeFeeWithDiscount,
          }
        );

        let receipt = await burnTx.wait();
        let burnEvent = receipt.events?.find((x) => {return x.event == "Burnt"});
        burnEvents.push(burnEvent);

        const newNativeDebridgeInfo = await this.debridgeBSC.getDebridge(nativeBSCDebridgeId);
        const newBalance = toBN(await wrappedAsset.balanceOf(bob));
        assert.equal(balance.sub(amount).toString(), newBalance.toString());
        const newDebridgeInfo = await this.debridgeBSC.getDebridge(debridgeId);
        let fees = toBN(supportedChainInfo.transferFeeBps)
          .mul(amount)
          .div(BPS);
        fees = toBN(fees).sub(toBN(fees).mul(discount).div(BPS));

        assert.equal(
          debridgeInfo.collectedFees.add(fees).toString(),
          newDebridgeInfo.collectedFees.toString()
        );
        assert.equal(
          nativeDebridgeInfo.collectedFees
            .add(fixedNativeFeeWithDiscount)
            .toString(),
            newNativeDebridgeInfo.collectedFees.toString()
        );
      }
    });

    it("should reject burning from current chain", async function() {
      const receiver = bob;
      const amount = toBN(toWei("1"));
      const deadline = 0;
      const signature = "0x";
      await expectRevert(
        this.debridgeETH.burn(
          nativeETHDebridgeId,
          receiver,
          amount,
          ethChainId,
          deadline,
          signature,
          false,
          {
            from: alice,
          }
        ),
        "wrong chain"
      );
    });
  });
  }

  context("Test claim method (ETH network)", () => {
    before(async function() {
      this.nativeSubmission = burnEvents.find((x) => {return x.args.debridgeId == nativeETHDebridgeId});
      this.nativeSubmissionId = this.nativeSubmission.args.submissionId;

      this.linkSubmission = burnEvents.find((x) => {return x.args.debridgeId == this.linkDebridgeId});
      this.linkSubmissionId = this.linkSubmission.args.submissionId;

      this.nativeSignatures = "0x";
      for (let oracleKey of oracleKeys) {
        let currentSignature = (await bscWeb3.eth.accounts.sign(this.nativeSubmissionId, oracleKey)).signature;
        //HACK remove first 0x
        this.nativeSignatures += currentSignature.substring(2, currentSignature.length);
      }

      this.linkSignatures = "0x";
      for (let oracleKey of oracleKeys) {
        let currentSignature = (await bscWeb3.eth.accounts.sign(this.linkSubmissionId, oracleKey)).signature;
        this.linkSignatures += currentSignature.substring(2, currentSignature.length);
      }
    });

    it("check view method is valid signature", async function() {
      assert.equal(
        await this.signatureVerifierETH.isValidSignature(this.nativeSubmissionId,
          (await bscWeb3.eth.accounts.sign(this.nativeSubmissionId, oracleKeys[0])).signature),
        true
      );
      assert.equal(
        await this.signatureVerifierETH.isValidSignature(this.linkSubmissionId,
          (await bscWeb3.eth.accounts.sign(this.nativeSubmissionId, oracleKeys[0])).signature),
        false
      );
    });

    it("should reject when the submission is blocked", async function() {
      await this.debridgeETH.blockSubmission([this.nativeSubmissionId], true, {
        from: alice,
      });

      assert.equal(
        await this.debridgeETH.isBlockedSubmission(this.nativeSubmissionId),
        true
      );

      await expectRevert(
        this.debridgeETH.claim(
          nativeETHDebridgeId,
          bscChainId,
          this.nativeSubmission.args.receiver,
          this.nativeSubmission.args.amount,
          this.nativeSubmission.args.nonce,
          this.nativeSignatures, {
          from: alice,
        }),
        "blocked submission"
      );
    });

    it("should unblock the submission by admin", async function() {
      await this.debridgeETH.blockSubmission([this.nativeSubmissionId], false, {
        from: alice,
      });
      assert.equal(
        await this.debridgeETH.isBlockedSubmission(this.nativeSubmissionId),
        false
      );
    })

    it("should reject when exist dublicate signatures", async function() {
      const debridgeId = nativeETHDebridgeId;
      const receiver = this.nativeSubmission.args.receiver;
      const amount = this.nativeSubmission.args.amount;
      const nonce = this.nativeSubmission.args.nonce;
      //Add duplicate signatures
      let signaturesWithDublicate =  "0x"
              + this.nativeSignatures.substring(132, 262)
              + this.nativeSignatures.substring(2, this.nativeSignatures.length);

      //console.log("signatures count: " + signaturesWithDublicate.length);

      await expectRevert(this.debridgeETH.claim(
        debridgeId,
        bscChainId,
        receiver,
        amount,
        nonce,
        signaturesWithDublicate,
        {
          from: alice,
        }
      ),
      "duplicate signatures");
    });


    it("should claim native token when the submission is approved", async function() {
      const debridgeId = nativeETHDebridgeId;
      const debridgeInfo = await this.debridgeETH.getDebridge(debridgeId);
      const receiver = this.nativeSubmission.args.receiver;
      const balance = toBN(await web3.eth.getBalance(receiver));
      const amount = this.nativeSubmission.args.amount;
      const nonce = this.nativeSubmission.args.nonce;
      //console.log("signatures count: " + this.nativeSignatures.length);
      await this.debridgeETH.claim(
        debridgeId,
        bscChainId,
        receiver,
        amount,
        nonce,
        this.nativeSignatures,
        {
          from: alice,
        }
      );
      const newBalance = toBN(await web3.eth.getBalance(receiver));
      const isSubmissionUsed = await this.debridgeETH.isSubmissionUsed(this.nativeSubmissionId);
      const newDebridgeInfo = await this.debridgeETH.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridgeInfo.collectedFees.toString(),
        newDebridgeInfo.collectedFees.toString()
      );
      assert.ok(isSubmissionUsed);
    });

    it("should claim ERC20 when the submission is approved", async function() {
      const debridgeId = this.linkDebridgeId;
      const debridgeInfo = await this.debridgeETH.getDebridge(debridgeId);
      const receiver = this.linkSubmission.args.receiver;
      const balance = toBN(await this.linkToken.balanceOf(receiver));
      const amount = this.linkSubmission.args.amount;
      const nonce = this.linkSubmission.args.nonce;
      await this.debridgeETH.claim(
        debridgeId,
        bscChainId,
        receiver,
        amount,
        nonce,
        this.linkSignatures,
        {
          from: alice,
        }
      );
      const newBalance = toBN(await this.linkToken.balanceOf(receiver));
      const isSubmissionUsed = await this.debridgeETH.isSubmissionUsed(this.linkSubmissionId);
      const newDebridgeInfo = await this.debridgeETH.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridgeInfo.collectedFees.toString(),
        newDebridgeInfo.collectedFees.toString()
      );
      assert.ok(isSubmissionUsed);
    });

    it("should reject claiming with unconfirmed submission", async function() {
      const debridgeId = this.linkDebridgeId;
      const receiver = this.linkSubmission.args.receiver;
      const amount = this.linkSubmission.args.amount;
      const wrongNonce = 999;
      await expectRevert(
        this.debridgeETH.claim(debridgeId, bscChainId, receiver, amount, wrongNonce, this.linkSignatures, { from: alice, }),
        "not confirmed by req oracles"
      );
    });

    it("should reject claiming twice", async function() {
      const debridgeId = this.linkDebridgeId;
      const receiver = this.linkSubmission.args.receiver;
      const amount = this.linkSubmission.args.amount;
      const nonce = this.linkSubmission.args.nonce;

      await expectRevert(
        this.debridgeETH.claim(debridgeId, bscChainId, receiver, amount, nonce, this.linkSignatures, { from: alice, }),
        "submission already used"
      );
    });
  });







  context(`Test transfer between BSC to HECO.`, () => {
    before(async function() {
      this.sentEventsBSC = [];
    });
    it("should send native tokens (from BSC to HECO)", async function() {
      const tokenAddress = ZERO_ADDRESS;
      const chainId = await this.debridgeBSC.chainId();
      const receiver = bob;
      const amount = toBN(toWei("10"));
      const chainIdTo = hecoChainId;
      const debridgeId = await this.debridgeBSC.getDebridgeId(
        chainId,
        tokenAddress
      );
      const balance = toBN(await web3.eth.getBalance(this.debridgeBSC.address));
      const debridge = await this.debridgeBSC.getDebridge(debridgeId);
      const supportedChainInfo = await this.debridgeBSC.getChainSupport(chainIdTo);
      let feesWithFix = toBN(supportedChainInfo.transferFeeBps)
        .mul(amount)
        .div(BPS)
        .add(toBN(supportedChainInfo.fixedNativeFee));

      let sendTx = await this.debridgeBSC.send(
        tokenAddress,
        receiver,
        amount,
        chainIdTo,
        false,
        {
          value: amount,
          from: alice,
        }
      );

      let receipt = await sendTx.wait();
      let sentEvent = receipt.events?.find((x) => {return x.event == "Sent"});
      this.nativeSubmission = sentEvent;
      this.sentEventsBSC.push(sentEvent);

      const newBalance = toBN(await web3.eth.getBalance(this.debridgeBSC.address));
      const newDebridgeInfo = await this.debridgeBSC.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridge.collectedFees
          .add(feesWithFix)
          .toString(),
          newDebridgeInfo.collectedFees.toString()
      );
    });

    it("should send ERC20 (Cake) tokens (from BSC to HECO)", async function() {
      const tokenAddress = this.cakeToken.address;
      const chainId = await this.debridgeBSC.chainId();
      const receiver = bob;
      const amount = toBN(toWei("100"));
      const chainIdTo = hecoChainId;
      await this.cakeToken.mint(alice, amount, {
        from: alice,
      });
      await this.cakeToken.approve(this.debridgeBSC.address, amount, {
        from: alice,
      });
      const debridgeId = await this.debridgeBSC.getDebridgeId(
        chainId,
        tokenAddress
      );

      this.cakeDebridgeId = debridgeId;
      const balance = toBN(
        await this.cakeToken.balanceOf(this.debridgeBSC.address)
      );
      const debridgeInfo = await this.debridgeBSC.getDebridge(debridgeId);
      const supportedChainInfo = await this.debridgeBSC.getChainSupport(chainIdTo);
      const nativeDebridgeInfo = await this.debridgeBSC.getDebridge(this.nativeDebridgeIdBSC);
      let fees = toBN(supportedChainInfo.transferFeeBps)
        .mul(amount)
        .div(BPS);
      let sendTx = await this.debridgeBSC.send(
        tokenAddress,
        receiver,
        amount,
        chainIdTo,
        false,
        {
          value: supportedChainInfo.fixedNativeFee,
          from: alice,
        }
      );

      let receipt = await sendTx.wait();
      let sentEvent = receipt.events?.find((x) => {return x.event == "Sent"});
      this.cakeSubmission = sentEvent;
      this.sentEventsBSC.push(sentEvent);

      const newNativeDebridgeInfo = await this.debridgeBSC.getDebridge(this.nativeDebridgeIdBSC);
      const newBalance = toBN(
        await this.cakeToken.balanceOf(this.debridgeBSC.address)
      );
      const newDebridge = await this.debridgeBSC.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridgeInfo.collectedFees.add(fees).toString(),
        newDebridge.collectedFees.toString()
      );

      assert.equal(
        nativeDebridgeInfo.collectedFees
          .add(toBN(supportedChainInfo.fixedNativeFee))
          .toString(),
          newNativeDebridgeInfo.collectedFees.toString()
      );
    });

    it("Oracles confirm transfers", async function() {
      for (let sentEvent of this.sentEventsBSC) {
        for (let oracle of this.initialOracles) {
          await this.confirmationAggregatorHECO.connect(oracle.account).submit(sentEvent.args.submissionId);
        }
        await this.confirmationAggregatorHECO.submit(sentEvent.args.submissionId, {
          from: alice,
        });
      }
    });

    it("should mint (deBSC) when the submission is approved", async function() {
      const balance = toBN("0");

      await this.debridgeHECO.mint(
        nativeBSCDebridgeId,
        bscChainId,
        this.nativeSubmission.args.receiver,
        this.nativeSubmission.args.amount,
        this.nativeSubmission.args.nonce,
        [],
        {
          from: alice,
        }
      );

      assert.equal(this.confirmationAggregatorHECO.address,  await this.debridgeHECO.confirmationAggregator());
      const debridgeInfo = await this.debridgeHECO.getDebridge(nativeBSCDebridgeId);
      const wrappedAsset = await WrappedAsset.at(debridgeInfo.tokenAddress);
      const newBalance = toBN(await wrappedAsset.balanceOf(this.nativeSubmission.args.receiver));

      const submissionId = await this.debridgeHECO.getSubmisionId(
        nativeBSCDebridgeId,
        bscChainId,
        hecoChainId,
        this.nativeSubmission.args.amount,
        this.nativeSubmission.args.receiver,
        this.nativeSubmission.args.nonce,
      );
      const isSubmissionUsed = await this.debridgeHECO.isSubmissionUsed(
        submissionId
      );
      assert.equal(balance.add(this.nativeSubmission.args.amount).toString(), newBalance.toString());
      assert.ok(isSubmissionUsed);
    });

    it("should mint (deCake) when the submission is approved ", async function() {
      const balance = toBN("0");

      //   function mint(
      //     address _tokenAddress,
      //     uint256 _chainId,
      //     uint256 _chainIdFrom,
      //     address _receiver,
      //     uint256 _amount,
      //     uint256 _nonce,
      //     bytes[] calldata _signatures
      // )

      let mintTx =  await this.debridgeHECO.mint(
        this.cakeDebridgeId,
        bscChainId,
        this.cakeSubmission.args.receiver,
        this.cakeSubmission.args.amount,
        this.cakeSubmission.args.nonce,
        [],
        {
          from: alice,
        }
      );
      let receipt = await mintTx.wait();

      const debridgeInfo = await this.debridgeHECO.getDebridge(this.cakeDebridgeId);
      const wrappedAsset = await WrappedAsset.at(debridgeInfo.tokenAddress);
      const newBalance = toBN(await wrappedAsset.balanceOf(this.cakeSubmission.args.receiver));
      const submissionId = await this.debridgeHECO.getSubmisionId(
        this.cakeDebridgeId,
        bscChainId,
        hecoChainId,
        this.cakeSubmission.args.amount,
        this.cakeSubmission.args.receiver,
        this.cakeSubmission.args.nonce,
      );
      const isSubmissionUsed = await this.debridgeHECO.isSubmissionUsed(
        submissionId
      );
      assert.equal(balance.add(this.cakeSubmission.args.amount).toString(), newBalance.toString());
      assert.ok(isSubmissionUsed);
    });


    it("should burn (deCake in HECO network)", async function() {
      const debridgeId = this.cakeDebridgeId;
      const chainIdTo = ethChainId;
      const receiver = bob;
      const amount = toBN(toWei("1"));
      const debridgeInfo = await this.debridgeHECO.getDebridge(debridgeId);
      const wrappedAsset = await WrappedAsset.at(debridgeInfo.tokenAddress);
      const balance = toBN(await wrappedAsset.balanceOf(bob));
      const deadline = toBN(MAX_UINT256);
      const supportedChainInfo = await this.debridgeHECO.getChainSupport(chainIdTo);
      const signature = await permit(
        wrappedAsset,
        bob,
        this.debridgeHECO.address,
        amount,
        deadline,
        bobPrivKey
      );
      const nativeDebridgeInfo = await this.debridgeHECO.getDebridge(nativeBSCDebridgeId);
      let fixedNativeFeeWithDiscount = supportedChainInfo.fixedNativeFee;
      // fixedNativeFeeWithDiscount = toBN(fixedNativeFeeWithDiscount).sub(toBN(fixedNativeFeeWithDiscount).mul(discount).div(BPS));
      let burnTx = await this.debridgeHECO.connect(bobAccount).burn(
        debridgeId,
        receiver,
        amount,
        chainIdTo,
        deadline,
        signature,
        false,
        {
          value: fixedNativeFeeWithDiscount,
        }
      );
    });
  });



  context("Collect fee management", () => {

    before(async function() {

      const debridgeInfoDeETH = await this.debridgeBSC.getDebridge(nativeETHDebridgeId);
      const debridgeInfoDeLink = await this.debridgeBSC.getDebridge(this.linkDebridgeId);
      //BSC network: create pair deETH/BNB
      await this.uniswapFactoryBSC.connect(aliceAccount).createPair(
        debridgeInfoDeETH.tokenAddress,
        this.wethBSC.address,
      );

      //BSC network: create pair deLINK/BNB
      await this.uniswapFactoryBSC.connect(aliceAccount).createPair(
        debridgeInfoDeLink.tokenAddress,
        this.wethBSC.address,
      );

      const debridgeInfoLink = await this.debridgeETH.getDebridge(this.linkDebridgeId);
      //ETH network: create pari LINK/ETH

      // console.log("feeProxyETH.address " + await this.feeProxyETH.address);
      // console.log("feeProxyETH.uniswapFactory " + await this.feeProxyETH.uniswapFactory());
      // console.log("this.uniswapFactoryETH " + this.uniswapFactoryETH.address);
      // console.log("feeProxyETH.weth " + await this.feeProxyETH.weth());
      // console.log("this.wethETH.address " + this.wethETH.address);
      // console.log("debridgeInfoLink.tokenAddress " + debridgeInfoLink.tokenAddress);
      // console.log("this.linkDebridgeId " + this.linkDebridgeId);

      await this.uniswapFactoryETH.connect(aliceAccount).createPair(
        debridgeInfoLink.tokenAddress,
        this.wethETH.address,
      );

      const BSCPoolAddres_DeETH_BNB = await this.uniswapFactoryBSC.getPair(
        debridgeInfoDeETH.tokenAddress,
        this.wethBSC.address,
      );
      const BSCPoolAddres_DeLINK_BNB = await this.uniswapFactoryBSC.getPair(
        debridgeInfoDeLink.tokenAddress,
        this.wethBSC.address,
      );

      const ETHPoolAddres_LINK_ETH = await this.uniswapFactoryETH.getPair(
        debridgeInfoLink.tokenAddress,
        this.wethETH.address,
      );

      console.log("ETHPoolAddres_LINK_ETH "+ ETHPoolAddres_LINK_ETH);

      const BSCPool_DeETH_BNB = await IUniswapV2Pair.at(BSCPoolAddres_DeETH_BNB);
      const BSCPool_DeLINK_BNB = await IUniswapV2Pair.at(BSCPoolAddres_DeLINK_BNB);
      const ETHPool_LINK_ETH = await IUniswapV2Pair.at(ETHPoolAddres_LINK_ETH);

      this.deLinkToken = await WrappedAsset.at(debridgeInfoDeLink.tokenAddress);
      this.deETHToken = await WrappedAsset.at(debridgeInfoDeETH.tokenAddress);

      //Ethereum network
      await this.deETHToken.grantRole(await this.deETHToken.MINTER_ROLE(), alice, {
        from: alice,
      });
      await this.deLinkToken.grantRole(await this.deETHToken.MINTER_ROLE(), alice, {
        from: alice,
      });

      //BSC network
      await this.wethBSC.connect(aliceAccount).deposit({
        value: toWei("30"),
      });

      await this.deETHToken.mint(BSCPoolAddres_DeETH_BNB, toWei("100.01"), {
        from: alice,
      });
      await this.wethBSC.connect(aliceAccount).transfer(BSCPoolAddres_DeETH_BNB, toWei("10.01"));

      await this.deLinkToken.mint(BSCPoolAddres_DeLINK_BNB, toWei("100.02"), {
        from: alice,
      });
      await this.wethBSC.connect(aliceAccount).transfer(BSCPoolAddres_DeLINK_BNB, toWei("10.02"));

      //Ethereum network
      await this.wethETH.connect(aliceAccount).deposit({
        value: toWei("10.03"),
      });
      await this.linkToken.mint(ETHPoolAddres_LINK_ETH, toWei("1000.03"), {
        from: alice,
      });
      await this.wethETH.connect(aliceAccount).transfer(ETHPoolAddres_LINK_ETH, toWei("10.03"));

      //sync
      await BSCPool_DeETH_BNB.sync();
      await BSCPool_DeLINK_BNB.sync();
      await ETHPool_LINK_ETH.sync();


      let reserve1 = await BSCPool_DeETH_BNB.getReserves();
      let reserve2 = await BSCPool_DeLINK_BNB.getReserves();
      let reserve3 = await ETHPool_LINK_ETH.getReserves();

      // console.log(reserve1[0].toString(), reserve1[1].toString());
      // console.log(reserve2[0].toString(), reserve2[1].toString());
      // console.log(reserve3[0].toString(), reserve3[1].toString());

      const WORKER_ROLE = await this.debridgeETH.WORKER_ROLE();
      await this.debridgeETH.grantRole(WORKER_ROLE, worker);
      await this.debridgeBSC.grantRole(WORKER_ROLE, worker);
      await this.debridgeHECO.grantRole(WORKER_ROLE, worker);

    });

    it("FeeProxy should set DebridgeGateAddresses it is called by the admin", async function() {
      assert.equal(null, await this.feeProxyETH.debridgeGateAddresses(bscChainId));
      assert.equal(null, await this.feeProxyBSC.debridgeGateAddresses(ethChainId));

      await this.feeProxyETH.setDebridgeGateAddresses(bscChainId, this.debridgeBSC.address.toString());
      await this.feeProxyETH.setDebridgeGateAddresses(ethChainId, this.debridgeETH.address.toString());
      await this.feeProxyETH.setTreasury(ethChainId, treasury);
      await this.feeProxyETH.setTreasury(bscChainId, treasury);
      await this.feeProxyETH.setTreasury(hecoChainId, treasury);
      assert.equal(this.debridgeBSC.address.toLowerCase(), await this.feeProxyETH.debridgeGateAddresses(bscChainId));
      assert.equal(treasury.toLowerCase(), await this.feeProxyETH.treasuryAddresses(ethChainId));
      assert.equal(treasury.toLowerCase(), await this.feeProxyETH.treasuryAddresses(bscChainId));
      assert.equal(treasury.toLowerCase(), await this.feeProxyETH.treasuryAddresses(hecoChainId));

      await this.feeProxyBSC.setDebridgeGateAddresses(ethChainId, this.debridgeETH.address.toString());
      await this.feeProxyBSC.setTreasury(ethChainId, treasury);
      await this.feeProxyBSC.setTreasury(bscChainId, treasury);
      await this.feeProxyBSC.setTreasury(hecoChainId, treasury);
      assert.equal(this.debridgeETH.address.toLowerCase(), await this.feeProxyBSC.debridgeGateAddresses(ethChainId));



      await this.feeProxyHECO.setDebridgeGateAddresses(bscChainId, this.debridgeBSC.address.toString());
      assert.equal( this.debridgeBSC.address.toLowerCase(), await this.feeProxyHECO.debridgeGateAddresses(bscChainId));
      await this.feeProxyHECO.setDebridgeGateAddresses(ethChainId, this.debridgeETH.address.toString());
      await this.feeProxyHECO.setTreasury(ethChainId, treasury);
      await this.feeProxyHECO.setTreasury(bscChainId, treasury);
      await this.feeProxyHECO.setTreasury(hecoChainId, treasury);
      assert.equal(this.debridgeETH.address.toLowerCase(), await this.feeProxyHECO.debridgeGateAddresses(ethChainId));

    });

    // it("should withdraw fee of native token if it is called by the worker", async function() {
    //   const debridgeInfo = await this.debridgeETH.getDebridge(this.nativeDebridgeId);
    //   const balance = toBN(await web3.eth.getBalance(this.debridgeETH.address));
    //   const balanceTreasury = toBN(await web3.eth.getBalance(treasury));
    //   //TODO: set chainIdTo;
    //   let chainIdTo = chainId;
    //   const supportedChainInfo = await this.debridgeETH.getChainSupport(chainIdTo);
    //   const fixedFee = supportedChainInfo.fixedNativeFee;
    //   console.log(`chainIdTo: ${chainIdTo}`);

    //   console.log(`feeProxy: ${await this.debridgeETH.feeProxy()}`);
    //   console.log(`fixedFee: ${fixedFee.toString()}`);
    //   console.log(`debridgeInfo.collectedFees: ${debridgeInfo.collectedFees.toString()}`);

    //   await this.debridgeETH.connect(workerAccount).withdrawFee(this.nativeDebridgeId,
    //     {
    //       value: fixedFee
    //     });
    //   const newBalance = toBN(await web3.eth.getBalance(this.debridgeETH.address));
    //   const diffBalance = balance.sub(newBalance);
    //   const newDebridgeInfo = await this.debridgeETH.getDebridge(this.nativeDebridgeId);
    //   const balanceTreasuryAfter = toBN(await web3.eth.getBalance(treasury));
    //   const diffBalanceTreasury = balanceTreasuryAfter.sub(balanceTreasury);

    //   assert.equal(diffBalance, debridgeInfo.collectedFees.sub(debridgeInfo.withdrawnFees).toString());
    //   assert.equal(0, newDebridgeInfo.collectedFees.sub(newDebridgeInfo.withdrawnFees).toString());
    //   assert.equal(debridgeInfo.collectedFees.toString(), newDebridgeInfo.withdrawnFees.toString());

    //   console.log(`diffBalance: ${diffBalance.toString()}`);
    //   console.log(`diffBalanceTreasury: ${diffBalanceTreasury.toString()}`);
    //   assert.equal(diffBalance.toString(), diffBalanceTreasury.toString());
    // });

    it("should withdraw fee of ERC20 token (BSC network, deLink) if it is called by the worker", async function() {
      await this.debridgeBSC.updateFeeDiscount(this.feeProxyBSC.address, 10000, 10000);

      const debridgeInfo = await this.debridgeBSC.getDebridge(this.linkDebridgeId);
      const balance = toBN(await this.deLinkToken.balanceOf(this.debridgeBSC.address));

      const supportedChainInfo = await this.debridgeBSC.getChainSupport(ethChainId);
      const fixedFee = supportedChainInfo.fixedNativeFee;
      // console.log(`fixedFee: ${fixedFee.toString()}`);
      // console.log(`debridgeInfo.collectedFees: ${debridgeInfo.collectedFees.toString()}`);

      let sendTx =  await this.debridgeBSC.connect(workerAccount).withdrawFee(this.linkDebridgeId, {
        value: fixedFee
      });

      let receipt = await sendTx.wait();
      this.burnEventDeLink = receipt.events?.find((x) => {return x.event == "AutoBurnt"});
      // console.log(this.burnEventDeLink);

      const newBalance = toBN(await this.deLinkToken.balanceOf(this.debridgeBSC.address));
      const diffBalance = balance.sub(newBalance);
      const newDebridgeInfo = await this.debridgeBSC.getDebridge(this.linkDebridgeId);
      // console.log("diffBalance.toString() ",diffBalance.toString());
      // console.log("debridgeInfo.collectedFees ",debridgeInfo.collectedFees.toString());
      // console.log("debridgeInfo.withdrawnFees ",debridgeInfo.withdrawnFees.toString());
      // console.log("newDebridgeInfo.collectedFees ",newDebridgeInfo.collectedFees.toString());
      // console.log("newDebridgeInfo.withdrawnFees ",newDebridgeInfo.withdrawnFees.toString());
      assert.equal(diffBalance.toString(), debridgeInfo.collectedFees.toString());
      assert.equal(0, debridgeInfo.withdrawnFees.toString());
      assert.equal(0, newDebridgeInfo.collectedFees.sub(newDebridgeInfo.withdrawnFees).toString());
      assert.equal(diffBalance.toString(), newDebridgeInfo.withdrawnFees.toString());
      assert.equal(0, newBalance.toString());
    });

    it("should auto claim fee transaction (burn event deLink from BSC to ETH)", async function() {
      let signatures = "0x";
      let currentBurnEvent = this.burnEventDeLink;
      let chainFrom = bscChainId;

      for (let oracleKey of oracleKeys) {
        let currentSignature = (await bscWeb3.eth.accounts.sign(currentBurnEvent.args.submissionId, oracleKey)).signature;
         //HACK remove first 0x
        signatures +=currentSignature.substring(2, currentSignature.length);
      }

      let sendTx = await this.debridgeETH.autoClaim(
        currentBurnEvent.args.debridgeId,
        chainFrom,
        currentBurnEvent.args.receiver,
        currentBurnEvent.args.amount,
        currentBurnEvent.args.nonce,
        signatures,
        currentBurnEvent.args.fallbackAddress,
        currentBurnEvent.args.claimFee,
        currentBurnEvent.args.data,
        {
          from: alice,
        }
      );

      let receipt = await sendTx.wait();

      let ReceivedTransferFee = receipt.events?.find((x) => {return x.event == "ReceivedTransferFee"});
      // console.log(ReceivedTransferFee);
      // console.log("amount " + ReceivedTransferFee.args.amount.toString());

    });

    it("should withdraw fee of ERC20 token (HECO network, deCake) if it is called by the worker", async function() {
      await this.debridgeHECO.updateFeeDiscount(this.feeProxyHECO.address, 10000, 10000);

      const debridgeInfo = await this.debridgeHECO.getDebridge(this.cakeDebridgeId);

      const supportedChainInfo = await this.debridgeHECO.getChainSupport(ethChainId);
      const fixedFee = supportedChainInfo.fixedNativeFee;
      // console.log(`fixedFee: ${fixedFee.toString()}`);
      // console.log(`debridgeInfo.collectedFees: ${debridgeInfo.collectedFees.toString()}`);

      let sendTx =  await this.debridgeHECO.connect(workerAccount).withdrawFee(this.cakeDebridgeId, {
        value: fixedFee
      });

      let receipt = await sendTx.wait();
      this.burnEventDeCake =receipt.events?.find((x) => {return x.event == "AutoBurnt"});
      // console.log(this.burnEventDeCake);
      const newDebridgeInfo = await this.debridgeHECO.getDebridge(this.cakeDebridgeId);
      // console.log("diffBalance.toString() ",diffBalance.toString());
      // console.log("debridgeInfo.collectedFees ",debridgeInfo.collectedFees.toString());
      // console.log("debridgeInfo.withdrawnFees ",debridgeInfo.withdrawnFees.toString());
      // console.log("newDebridgeInfo.collectedFees ",newDebridgeInfo.collectedFees.toString());
      // console.log("newDebridgeInfo.withdrawnFees ",newDebridgeInfo.withdrawnFees.toString());

      assert.equal(0, debridgeInfo.withdrawnFees.toString());
      assert.equal(0, newDebridgeInfo.collectedFees.sub(newDebridgeInfo.withdrawnFees).toString());
    });

    it("should auto claim fee transaction (burn event deCake from HECO to BSC)", async function() {
      let signatures = [];
      let currentBurnEvent = this.burnEventDeCake;
      let debridgeId = currentBurnEvent.args.debridgeId;
      let chainFrom = hecoChainId;
      for (let oracle of this.initialOracles) {
        await this.confirmationAggregatorBSC.connect(oracle.account).submit(currentBurnEvent.args.submissionId);
      }
      await this.confirmationAggregatorBSC.connect(aliceAccount).submit(currentBurnEvent.args.submissionId);

      const debridgeInfo = await this.debridgeBSC.getDebridge(debridgeId);
      const balance = toBN(await this.cakeToken.balanceOf(this.debridgeBSC.address));

      let sendTx = await this.debridgeBSC.autoClaim(
        debridgeId,
        chainFrom,
        currentBurnEvent.args.receiver,
        currentBurnEvent.args.amount,
        currentBurnEvent.args.nonce,
        [],
        currentBurnEvent.args.fallbackAddress,
        currentBurnEvent.args.claimFee,
        currentBurnEvent.args.data,
        {
          from: alice,
        }
      );

      let receipt = await sendTx.wait();

      let ReceivedTransferFee = receipt.events?.find((x) => {return x.event == "ReceivedTransferFee"});
      //TODO: need to fix gate balance the same
      // console.log(receipt.events);
      // console.log(ReceivedTransferFee);
      // console.log("amount " + ReceivedTransferFee.args.amount.toString());

      const newDebridgeInfo = await this.debridgeBSC.getDebridge(debridgeId);
      const newBalance = toBN(await this.cakeToken.balanceOf(this.debridgeBSC.address));

      // console.log("cakeToken "+ this.cakeToken.address);
      // console.log("this.debridgeBSC "+ this.debridgeBSC.address);
      // console.log("balance"+balance.toString());
      // console.log("+amount "+ currentBurnEvent.args.amount.toString());
      // console.log("newBalance.toString() "+newBalance.toString());

      // console.log("Proxy balance  "+(await this.cakeToken.balanceOf(this.callProxy.address)).toString());
      // console.log("Proxy fee balance  "+(await this.cakeToken.balanceOf(this.feeProxyBSC.address)).toString());
      assert.equal(
        balance.add(currentBurnEvent.args.amount).toString(),
        newBalance.toString());

      assert.equal(
        debridgeInfo.collectedFees.add(currentBurnEvent.args.amount).toString(),
        newDebridgeInfo.collectedFees.toString());
    });


    it("should withdraw fee of ERC20 token (ETH network, Link) if it is called by the worker", async function() {
      await this.debridgeETH.updateFeeDiscount(this.feeProxyETH.address, 10000, 10000);

      const debridgeInfo = await this.debridgeETH.getDebridge(this.linkDebridgeId);
      const balance = toBN(await this.linkToken.balanceOf(this.debridgeETH.address));

      const supportedChainInfo = await this.debridgeETH.getChainSupport(ethChainId);
      const fixedFee = supportedChainInfo.fixedNativeFee;

      const balanceETHTreasury = toBN(await web3.eth.getBalance(treasury));
      // console.log("this.debridgeETH.feeProxy()" + await this.debridgeETH.feeProxy());
      let sendTx =  await this.debridgeETH.connect(workerAccount).withdrawFee(this.linkDebridgeId, {
        value: fixedFee
      });

      let receipt = await sendTx.wait();
      this.burnEventDeLink = receipt.events?.find((x) => {return x.event == "AutoBurnt"});

      const newBalanceETHTreasury = toBN(await web3.eth.getBalance(treasury));
      // console.log("balanceETHTreasury "+balanceETHTreasury.toString());
      // console.log("newBalanceETHTreasury "+newBalanceETHTreasury.toString());
      const newBalance = toBN(await this.linkToken.balanceOf(this.debridgeETH.address));
      const diffBalance = balance.sub(newBalance);
      const newDebridgeInfo = await this.debridgeETH.getDebridge(this.linkDebridgeId);

      assert.ok(newBalanceETHTreasury.gt(balanceETHTreasury));
      // assert.equal(diffBalance.toString(), debridgeInfo.withdrawnFees.toString());
      assert.equal(0, debridgeInfo.withdrawnFees.toString());
      // assert.equal(0, newDebridgeInfo.collectedFees.sub(newDebridgeInfo.withdrawnFees).toString());
      assert.equal(diffBalance.toString(), newDebridgeInfo.withdrawnFees.toString());
      // assert.equal(0, newBalance.toString());
    });

    it("should reject withdrawing fee by non-worker", async function() {
      await expectRevert(
        this.debridgeBSC.connect(bobAccount).withdrawFee(this.linkDebridgeId),
        "bad role"
      );
    });

    it("should reject withdrawing fees if the token not from current chain", async function() {
      const fakeDebridgeId = await this.debridgeBSC.getDebridgeId(999, "0x5A0b54D5dc17e0AadC383d2db43B0a0D3E029c4c");
      await expectRevert(
        this.debridgeBSC.connect(workerAccount).withdrawFee(fakeDebridgeId),
        "debridge not exist"
      );
    });
  });
});
