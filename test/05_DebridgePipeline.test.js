const { expectRevert } = require("@openzeppelin/test-helpers");
const {
  permitWithDeadline,
  packSubmissionAutoParamsFrom,
  packSubmissionAutoParamsTo,
  submissionSignatures,
  normalizeTokenAmount,
  MAX_TRANSFER_DECIMALS,
} = require("./utils.spec");
const MockLinkToken = artifacts.require("MockLinkToken");
const WethGate = artifacts.require("WethGate");
const MockInvalidToken = artifacts.require("MockInvalidToken");
const MockToken = artifacts.require("MockToken");
const DeBridgeToken = artifacts.require("DeBridgeToken");
const IUniswapV2Pair = artifacts.require("IUniswapV2Pair");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const { toWei } = web3.utils;
const { BigNumber } = require("ethers");

const bscWeb3 = new Web3(process.env.TEST_BSC_PROVIDER);
const oracleKeys = JSON.parse(process.env.TEST_ORACLE_KEYS);

function toBN(number) {
  return BigNumber.from(number.toString());
}

const ZERO_ADDRESS = ethers.constants.AddressZero;
const MAX = web3.utils.toTwosComplement(-1);
const alicePrivKey = "0x512aba028561d58c914fdcb31cc7f4dd9a433cb3672eb9eaf44302eb097ec3bc";
const bobPrivKey = "0x79b2a2a43a1e9f325920f99a720605c9c563c61fb5ae3ebe483f83f1230512d3";

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

const nativeBSCDebridgeId = "0x8ca679b0f7e259a80b1066b4253c3fdc0d9bdbb15c926fd2a5eab0335bf1f745";
const nativeETHDebridgeId = "0x6ac1b981b4452354ad8bd156fe151bcb91252dea9ed7232af4d0e64b50c09dcf";

const referralCode = 555;
const zeroFlag = 0;

let deLinkAddressInBSC = "0";
let deETHAddressInBSC = "0";
let deHTAddressInBSC = "0";
let deETHAddressInHECO = "0";
let deCakeAddressInHECO = "0";
let deBNBAddressInHECO = "0";

let feesCalculatorETH;
let feesCalculatorBSC;

const discountsValues = [0, 5000, 10000];
contract("DeBridgeGate real pipeline mode", function () {
  before(async function () {
    this.signers = await ethers.getSigners();
    aliceAccount = this.signers[0];
    bobAccount = this.signers[1];
    carolAccount = this.signers[2];
    eveAccount = this.signers[3];
    feiAccount = this.signers[4];
    devidAccount = this.signers[5];
    alice = aliceAccount.address;
    bob = bobAccount.address;
    carol = carolAccount.address;
    eve = eveAccount.address;
    fei = feiAccount.address;
    devid = devidAccount.address;
    treasury = devid;
    worker = carol;
    workerAccount = carolAccount;

    const WETH9 = await deployments.getArtifact("WETH9");
    const WETH9Factory = await ethers.getContractFactory(WETH9.abi, WETH9.bytecode, alice);

    const UniswapV2 = await deployments.getArtifact("UniswapV2Factory");
    const UniswapV2Factory = await ethers.getContractFactory(
      UniswapV2.abi,
      UniswapV2.bytecode,
      alice
    );

    const DeBridgeTokenFactory = await ethers.getContractFactory("DeBridgeToken", alice);
    const DeBridgeTokenDeployerFactory = await ethers.getContractFactory("DeBridgeTokenDeployer", alice);

    const DeBridgeGateFactory = await ethers.getContractFactory("MockDeBridgeGate", alice);
    const SignatureVerifierFactory = await ethers.getContractFactory("SignatureVerifier", alice);
    const CallProxyFactory = await ethers.getContractFactory("CallProxy", alice);
    const DefiControllerFactory = await ethers.getContractFactory("DefiController", alice);
    const FeesCalculatorFactory = await ethers.getContractFactory("FeesCalculator", alice);

    const MockFeeProxyFactory = await ethers.getContractFactory("MockFeeProxy", alice);
    const MockExternalFactory = await ethers.getContractFactory("MockExternalContract", alice);

    this.amountThreshols = toWei("1000");

    this.initialOracles = [];
    const maxOraclesCount = Math.min(this.signers.length,10);
    for (let i = 1; i <= maxOraclesCount; i++) {
      this.initialOracles.push({
        account: this.signers[i],
        address: this.signers[i].address,
      });
    }

    this.minConfirmations = Math.floor(this.initialOracles.length/2) + 1;
    this.confirmationThreshold = 5; //Confirmations per block before extra check enabled.
    this.excessConfirmations = 7; //Confirmations count in case of excess activity.


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
    this.emptyNameToken = await MockToken.new("", "NONAME", 18, {
      from: alice,
    });

    //-------Deploy weth contracts
    this.wethETH = await WETH9Factory.deploy();
    this.wethBSC = await WETH9Factory.deploy();
    this.wethHECO = await WETH9Factory.deploy();

    //-------Deploy WethGate contracts
    this.wethGateETH = await WethGate.new(this.wethETH.address, {
      from: alice,
    });
    this.wethGateBSC = await WethGate.new(this.wethBSC.address, {
      from: alice,
    });
    this.wethGateHECO = await WethGate.new(this.wethHECO.address, {
      from: alice,
    });


    //-------Deploy uniswap contracts
    this.uniswapFactoryETH = await UniswapV2Factory.deploy(carol);
    this.uniswapFactoryBSC = await UniswapV2Factory.deploy(carol);
    this.uniswapFactoryHECO = await UniswapV2Factory.deploy(carol);

    this.mockExternalContract = await MockExternalFactory.deploy();

    //-------Deploy FeeProxy contracts
    this.feeProxyETH = await upgrades.deployProxy(
      MockFeeProxyFactory,
      [this.uniswapFactoryETH.address, this.wethETH.address],
      {
        initializer: "initializeMock",
        kind: "transparent",
      }
    );

    this.feeProxyBSC = await upgrades.deployProxy(
      MockFeeProxyFactory,
      [this.uniswapFactoryBSC.address, this.wethBSC.address],
      {
        initializer: "initializeMock",
        kind: "transparent",
      }
    );

    this.feeProxyHECO = await upgrades.deployProxy(
      MockFeeProxyFactory,
      [this.uniswapFactoryHECO.address, this.wethHECO.address],
      {
        initializer: "initializeMock",
        kind: "transparent",
      }
    );

    //Hack override contract chain Id
    await this.feeProxyETH.overrideChainId(ethChainId);
    await this.feeProxyBSC.overrideChainId(bscChainId);
    await this.feeProxyHECO.overrideChainId(hecoChainId);

    // console.log(`feeProxyETH: ${this.feeProxyETH.address.toString()}`);
    // console.log(`feeProxyBSC: ${this.feeProxyBSC.address.toString()}`);
    // console.log(`feeProxyHECO: ${this.feeProxyHECO.address.toString()}`);

    //-------Deploy callProxy contracts
    this.callProxy = await upgrades.deployProxy(CallProxyFactory, []);

    //-------Deploy defiController contracts
    this.defiControllerETH = await upgrades.deployProxy(DefiControllerFactory, []);

    //-------Deploy confirmation aggregator contracts
    //   function initialize(
    //     uint256 _minConfirmations,
    //     uint256 _confirmationThreshold,
    //     uint256 _excessConfirmations,
    // )

    this.signatureVerifierETH = await upgrades.deployProxy(SignatureVerifierFactory, [
      this.minConfirmations,
      this.confirmationThreshold,
      this.excessConfirmations,
      ZERO_ADDRESS,
    ]);
    await this.signatureVerifierETH.deployed();

    this.signatureVerifierBSC = await upgrades.deployProxy(SignatureVerifierFactory, [
      this.minConfirmations,
      this.confirmationThreshold,
      this.excessConfirmations,
      ZERO_ADDRESS,
    ]);
    await this.signatureVerifierBSC.deployed();

    this.signatureVerifierHECO = await upgrades.deployProxy(SignatureVerifierFactory, [
      this.minConfirmations,
      this.confirmationThreshold,
      this.excessConfirmations,
      ZERO_ADDRESS,
    ]);
    await this.signatureVerifierHECO.deployed();

    // deploy token implementations
    this.deBridgeTokenETH = await DeBridgeTokenFactory.deploy();
    this.deBridgeTokenBSC = await DeBridgeTokenFactory.deploy();
    this.deBridgeTokenHECO = await DeBridgeTokenFactory.deploy();

    // deploy DeBridgeTokenDeployer contracts
    this.deBridgeTokenDeployerETH = await upgrades.deployProxy(
      DeBridgeTokenDeployerFactory,
      [
        this.deBridgeTokenETH.address,
        alice,
        ZERO_ADDRESS,
      ]);
    this.deBridgeTokenDeployerBSC = await upgrades.deployProxy(
      DeBridgeTokenDeployerFactory,
      [
        this.deBridgeTokenBSC.address,
        alice,
        ZERO_ADDRESS,
      ]);
    this.deBridgeTokenDeployerHECO = await upgrades.deployProxy(
      DeBridgeTokenDeployerFactory,
      [
        this.deBridgeTokenHECO.address,
        alice,
        ZERO_ADDRESS,
      ]);

    //-------Deploy DebridgeGate contracts
    //   function initialize(
    //     uint256 _excessConfirmations,
    //     address _signatureVerifier,
    //     address _callProxy,
    //     IWETH _weth,
    //     IFeeProxy _feeProxy,
    //     IDefiController _defiController,
    // )
    this.debridgeETH = await upgrades.deployProxy(
      DeBridgeGateFactory,
      [
        this.excessConfirmations,
        this.signatureVerifierETH.address,
        this.callProxy.address.toString(),
        this.wethETH.address,
        this.feeProxyETH.address,
        this.deBridgeTokenDeployerETH.address,
        this.defiControllerETH.address,
        ethChainId, //overrideChainId
      ],
      {
        initializer: "initializeMock",
        kind: "transparent",
      }
    );
    this.debridgeBSC = await upgrades.deployProxy(
      DeBridgeGateFactory,
      [
        this.excessConfirmations,
        this.signatureVerifierBSC.address,
        this.callProxy.address.toString(),
        this.wethBSC.address,
        this.feeProxyBSC.address,
        this.deBridgeTokenDeployerBSC.address,
        ZERO_ADDRESS,
        bscChainId, //overrideChainId
      ],
      {
        initializer: "initializeMock",
        kind: "transparent",
      }
    );

    this.debridgeHECO = await upgrades.deployProxy(
      DeBridgeGateFactory,
      [
        this.excessConfirmations,
        this.signatureVerifierHECO.address,
        this.callProxy.address.toString(),
        this.wethHECO.address,
        this.feeProxyHECO.address,
        this.deBridgeTokenDeployerHECO.address,
        ZERO_ADDRESS,
        hecoChainId, //overrideChainId
      ],
      {
        initializer: "initializeMock",
        kind: "transparent",
      }
    );

    await this.debridgeETH.updateChainSupport(
      [bscChainId, hecoChainId],
      [
        {
          transferFeeBps,
          fixedNativeFee: fixedNativeFeeBNB,
          isSupported,
        },
        {
          transferFeeBps,
          fixedNativeFee: fixedNativeFeeHT,
          isSupported,
        },
      ],
      false
    );

    await this.debridgeETH.updateChainSupport(
      [bscChainId, hecoChainId],
      [
        {
          transferFeeBps,
          fixedNativeFee: fixedNativeFeeBNB,
          isSupported,
        },
        {
          transferFeeBps,
          fixedNativeFee: fixedNativeFeeHT,
          isSupported,
        },
      ],
      true
    );

    await this.debridgeBSC.updateChainSupport(
      [ethChainId, hecoChainId], //supportedChainIds,
      [
        {
          transferFeeBps,
          fixedNativeFee: fixedNativeFeeETH,
          isSupported,
        },
        {
          transferFeeBps,
          fixedNativeFee: fixedNativeFeeHT,
          isSupported,
        },
      ],
      false
    );

    await this.debridgeBSC.updateChainSupport(
      [ethChainId, hecoChainId], //supportedChainIds,
      [
        {
          transferFeeBps,
          fixedNativeFee: fixedNativeFeeETH,
          isSupported,
        },
        {
          transferFeeBps,
          fixedNativeFee: fixedNativeFeeHT,
          isSupported,
        },
      ],
      true
    );

    await this.debridgeHECO.updateChainSupport(
      [ethChainId, bscChainId], //supportedChainIds,
      [
        {
          transferFeeBps,
          fixedNativeFee: fixedNativeFeeETH,
          isSupported,
        },
        {
          transferFeeBps,
          fixedNativeFee: fixedNativeFeeBNB,
          isSupported,
        },
      ],
      false
    );

    await this.debridgeHECO.updateChainSupport(
      [ethChainId, bscChainId], //supportedChainIds,
      [
        {
          transferFeeBps,
          fixedNativeFee: fixedNativeFeeETH,
          isSupported,
        },
        {
          transferFeeBps,
          fixedNativeFee: fixedNativeFeeBNB,
          isSupported,
        },
      ],
      true
    );

    // deploy FeesCalculator contracts
    feesCalculatorETH = await upgrades.deployProxy(
      FeesCalculatorFactory,
      [this.debridgeETH.address],
    );
    feesCalculatorBSC = await upgrades.deployProxy(
      FeesCalculatorFactory,
      [this.debridgeBSC.address],
    );

    // set debridge address
    await this.deBridgeTokenDeployerETH.setDebridgeAddress(this.debridgeETH.address);
    await this.deBridgeTokenDeployerBSC.setDebridgeAddress(this.debridgeBSC.address);
    await this.deBridgeTokenDeployerHECO.setDebridgeAddress(this.debridgeHECO.address);

    await this.signatureVerifierETH.setDebridgeAddress(this.debridgeETH.address);
    await this.signatureVerifierBSC.setDebridgeAddress(this.debridgeBSC.address);
    await this.signatureVerifierHECO.setDebridgeAddress(this.debridgeHECO.address);

    this.linkDebridgeId = await this.debridgeETH.getDebridgeId(ethChainId, this.linkToken.address);
    this.cakeDebridgeId = await this.debridgeETH.getDebridgeId(bscChainId, this.cakeToken.address);

    this.nativeDebridgeIdETH = await this.debridgeETH.getDebridgeId(ethChainId, ZERO_ADDRESS);
    this.nativeDebridgeIdBSC = await this.debridgeBSC.getDebridgeId(bscChainId, ZERO_ADDRESS);
    this.nativeDebridgeIdHECO = await this.debridgeHECO.getDebridgeId(hecoChainId, ZERO_ADDRESS);

    this.debridgeWethId = await this.debridgeETH.getDebridgeId(ethChainId, this.wethETH.address);

    this.debridgeWethBSCId = await this.debridgeETH.getDebridgeId(bscChainId, this.wethBSC.address);

    this.debridgeWethHECOId = await this.debridgeETH.getDebridgeId(
      hecoChainId,
      this.wethHECO.address
    );

    const DEBRIDGE_GATE_ROLE = await this.callProxy.DEBRIDGE_GATE_ROLE();
    await this.callProxy.grantRole(DEBRIDGE_GATE_ROLE, this.debridgeETH.address);
    await this.callProxy.grantRole(DEBRIDGE_GATE_ROLE, this.debridgeBSC.address);
    await this.callProxy.grantRole(DEBRIDGE_GATE_ROLE, this.debridgeHECO.address);

    this.non_evm_receivers = [
      // SOL
      web3.utils.utf8ToHex('CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq'),
      // BTC
      web3.utils.utf8ToHex('qrg6smtqa4swuj4lk5v0x5m2hyanr8hgm5s68ztfdv'),
      // BTC long
      web3.utils.utf8ToHex('bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97'),
    ]
  });
  context("Configure contracts", () => {
    it("Check init contract params", async function () {
      //TODO: check that correct binding in constructor
      assert.equal(
        this.uniswapFactoryETH.address.toString(),
        await this.feeProxyETH.uniswapFactory()
      );
      assert.equal(
        this.uniswapFactoryBSC.address.toString(),
        await this.feeProxyBSC.uniswapFactory()
      );
      assert.equal(
        this.uniswapFactoryHECO.address.toString(),
        await this.feeProxyHECO.uniswapFactory()
      );

      assert.equal(
        this.signatureVerifierETH.address,
        await this.debridgeETH.signatureVerifier()
      );
      assert.equal(
        this.signatureVerifierBSC.address,
        await this.debridgeBSC.signatureVerifier()
      );
      assert.equal(
        this.signatureVerifierHECO.address,
        await this.debridgeHECO.signatureVerifier()
      );

      assert.equal(ZERO_ADDRESS, await this.feeProxyETH.debridgeGate());
      assert.equal(ZERO_ADDRESS, await this.feeProxyBSC.debridgeGate());
      assert.equal(ZERO_ADDRESS, await this.feeProxyHECO.debridgeGate());

      assert.equal(this.feeProxyETH.address, await this.debridgeETH.feeProxy());
      assert.equal(this.feeProxyBSC.address, await this.debridgeBSC.feeProxy());
      assert.equal(this.feeProxyHECO.address, await this.debridgeHECO.feeProxy());

      // assert.equal(treasury, await this.debridgeETH.treasury());
      // assert.equal(treasury, await this.debridgeBSC.treasury());
      // assert.equal(treasury, await this.debridgeHECO.treasury());

      assert.equal(this.defiControllerETH.address, await this.debridgeETH.defiController());
      assert.equal(ZERO_ADDRESS, await this.debridgeBSC.defiController());
      assert.equal(ZERO_ADDRESS, await this.debridgeHECO.defiController());

      assert.equal(this.wethETH.address, await this.debridgeETH.weth());
      assert.equal(this.wethBSC.address, await this.debridgeBSC.weth());
      assert.equal(this.wethHECO.address, await this.debridgeHECO.weth());
    });

    it("Initialize oracles", async function () {
      let oracleAddresses = this.initialOracles.map(i => i.address);
      let required = this.initialOracles.map(i => false);

      await this.signatureVerifierBSC
        .connect(aliceAccount)
        .addOracles(oracleAddresses, required);
      await this.signatureVerifierHECO
        .connect(aliceAccount)
        .addOracles(oracleAddresses, required);

      // Alice is required oracle
      await this.signatureVerifierBSC
        .connect(aliceAccount)
        .addOracles([alice], [true]);
      await this.signatureVerifierHECO
        .connect(aliceAccount)
        .addOracles([alice], [true]);

      await this.signatureVerifierETH
        .connect(aliceAccount)
        .addOracles(oracleAddresses, required);

      // Alice is required oracle
      await this.signatureVerifierETH
        .connect(aliceAccount)
        .addOracles([alice], [true]);

      //TODO: check that we added oracles
      assert.equal(
        await this.signatureVerifierBSC.requiredOraclesCount(),
        1);
      assert.equal(
        await this.signatureVerifierHECO.requiredOraclesCount(),
        1);
      assert.equal(
        await this.signatureVerifierETH.requiredOraclesCount(),
        1);
    });

    it("Update fixed fee for WETH", async function () {
      const wethDebridgeId = await this.debridgeETH.getDebridgeId(ethChainId, this.wethETH.address);
      const bscWethDebridgeId = await this.debridgeETH.getDebridgeId(
        bscChainId,
        this.wethBSC.address
      );
      const hecoWethDebridgeId = await this.debridgeETH.getDebridgeId(
        hecoChainId,
        this.wethHECO.address
      );
      //   function updateAssetFixedFees(
      //     bytes32 _debridgeId,
      //     uint256[] memory _supportedChainIds,
      //     uint256[] memory _assetFeesInfo
      // )
      await this.debridgeETH.updateAssetFixedFees(
        wethDebridgeId,
        [bscChainId, hecoChainId],
        [fixedNativeFeeBNB, fixedNativeFeeHT]
      );

      let fixedFee = await this.debridgeETH.getDebridgeChainAssetFixedFee(wethDebridgeId, bscChainId)
      assert.equal(fixedFee.toString(), fixedNativeFeeBNB.toString());
      fixedFee = await this.debridgeETH.getDebridgeChainAssetFixedFee(wethDebridgeId, hecoChainId)
      assert.equal(fixedFee.toString(), fixedNativeFeeHT.toString());

      await this.debridgeBSC.updateAssetFixedFees(
        bscWethDebridgeId,
        [ethChainId, hecoChainId],
        [fixedNativeFeeETH, fixedNativeFeeHT]
      );

      fixedFee = await this.debridgeBSC.getDebridgeChainAssetFixedFee(bscWethDebridgeId, ethChainId)
      assert.equal(fixedFee.toString(), fixedNativeFeeETH.toString());
      fixedFee = await this.debridgeBSC.getDebridgeChainAssetFixedFee(bscWethDebridgeId, hecoChainId)
      assert.equal(fixedFee.toString(), fixedNativeFeeHT.toString());

      await this.debridgeHECO.updateAssetFixedFees(
        hecoWethDebridgeId,
        [ethChainId, bscChainId],
        [fixedNativeFeeHT, fixedNativeFeeBNB]
      );

      fixedFee = await this.debridgeHECO.getDebridgeChainAssetFixedFee(hecoWethDebridgeId, ethChainId)
      assert.equal(fixedFee.toString(), fixedNativeFeeHT.toString());
      fixedFee = await this.debridgeHECO.getDebridgeChainAssetFixedFee(hecoWethDebridgeId, bscChainId)
      assert.equal(fixedFee.toString(), fixedNativeFeeBNB.toString());

      //TODO: check that we added oracles
    });
  });

  context("Test setting configurations by different users", () => {
    it("should set signatureVerifier if called by the admin", async function () {
      let testAddress = "0x765bDC94443b2D87543ee6BdDEE2208343C8C07A";
      await this.debridgeETH.setSignatureVerifier(testAddress);
      assert.equal(testAddress, await this.debridgeETH.signatureVerifier());
      //Return to this.signatureVerifierETH.address
      await this.debridgeETH.setSignatureVerifier(this.signatureVerifierETH.address);
      assert.equal(this.signatureVerifierETH.address, await this.debridgeETH.signatureVerifier());
    });

    it("should set debridgeGate to fee proxy if called by the admin", async function () {
      await this.feeProxyETH.setDebridgeGate(this.debridgeETH.address.toString());
      await this.feeProxyBSC.setDebridgeGate(this.debridgeBSC.address.toString());
      await this.feeProxyHECO.setDebridgeGate(this.debridgeHECO.address.toString());
      assert.equal(this.debridgeETH.address.toString(), await this.feeProxyETH.debridgeGate());
      assert.equal(this.debridgeBSC.address.toString(), await this.feeProxyBSC.debridgeGate());
      assert.equal(this.debridgeHECO.address.toString(), await this.feeProxyHECO.debridgeGate());
    });
    it("should set fee proxy if called by the admin", async function () {
      let testAddress = "0x765bDC94443b2D87543ee6BdDEE2208343C8C07A";
      await this.debridgeETH.setFeeProxy(testAddress);
      assert.equal(testAddress, await this.debridgeETH.feeProxy());
      //restore back
      await this.debridgeETH.setFeeProxy(this.feeProxyETH.address);
      assert.equal(this.feeProxyETH.address, await this.debridgeETH.feeProxy());
    });

    it("should set defi controller if called by the admin", async function () {
      let testAddress = "0x765bDC94443b2D87543ee6BdDEE2208343C8C07A";
      await this.debridgeBSC.setDefiController(testAddress);
      assert.equal(testAddress, await this.debridgeBSC.defiController());
      //restore back
      await this.debridgeBSC.setDefiController(ZERO_ADDRESS);
      assert.equal(ZERO_ADDRESS, await this.debridgeBSC.defiController());
    });

    it("should set Weth Gate if called by the admin", async function () {
      const gateAddress = this.wethGateETH.address;
      await this.debridgeETH.setWethGate(gateAddress);
      assert.equal(gateAddress, await this.debridgeETH.wethGate());
      //restore back
      await this.debridgeETH.setWethGate(ZERO_ADDRESS);
      assert.equal(ZERO_ADDRESS, await this.debridgeETH.wethGate());
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

    it("should reject setting signatureVerifier if called by the non-admin", async function () {
      await expectRevert(
        this.debridgeETH.connect(bobAccount).setSignatureVerifier(ZERO_ADDRESS),
        "AdminBadRole()"
      );
    });

    it("should reject setting fee proxy if called by the non-admin", async function () {
      await expectRevert(
        this.debridgeETH.connect(bobAccount).setFeeProxy(ZERO_ADDRESS),
        "AdminBadRole()"
      );
    });

    it("should reject setting defi controller if called by the non-admin", async function () {
      await expectRevert(
        this.debridgeETH.connect(bobAccount).setDefiController(ZERO_ADDRESS),
        "AdminBadRole()"
      );
    });

    it("should reject setting Weth gate if called by the non-admin", async function () {
      await expectRevert(
        this.debridgeETH.connect(bobAccount).setWethGate(ZERO_ADDRESS),
        "AdminBadRole()"
      );
    });


    // setWeth removed from contract
    // it("should reject setting weth if called by the non-admin", async function() {
    //   await expectRevert(
    //     this.debridgeETH.connect(bobAccount).setWeth(ZERO_ADDRESS),
    //     "onlyAdmin: AdminBadRole()"
    //   );
    // });
  });

  discountsValues.forEach(discount => {
    context(`Test send method from ETH to BSC. discount: ${(discount * 100) / BPS}%`, () => {
      it(`set discount ${(discount * 100) / BPS}% fee for customer alice`, async function () {
        await this.debridgeETH.updateFeeDiscount(alice, discount, discount);
        const discountFromContract = await this.debridgeETH.feeDiscount(alice);
        expect(discount).to.equal(discountFromContract.discountTransferBps);
        expect(discount).to.equal(discountFromContract.discountFixBps);
      });

      it("should send native tokens", async function () {
        const tokenAddress = ZERO_ADDRESS;
        const sender = alice;
        const receiver = bob;
        const chainIdTo = bscChainId;
        // use amount with max supported decimals
        let amount = 10 - 10 ** -MAX_TRANSFER_DECIMALS;
        amount = ethers.utils.parseEther(amount.toFixed(MAX_TRANSFER_DECIMALS));

        const balance = toBN(await this.wethETH.balanceOf(this.debridgeETH.address));
        const userBalanceBefore = toBN(await web3.eth.getBalance(sender));

        const debridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(this.debridgeWethId);
        const supportedChainInfo = await this.debridgeETH.getChainToConfig(chainIdTo);
        const fixedNativeFeeAfterDiscount = toBN(supportedChainInfo.fixedNativeFee).mul(BPS-discount).div(BPS);
        let feesWithFix = toBN(supportedChainInfo.transferFeeBps)
          .mul(toBN(amount).sub(fixedNativeFeeAfterDiscount))
          .div(BPS);
        feesWithFix = toBN(feesWithFix).sub(toBN(feesWithFix).mul(discount).div(BPS));
        feesWithFix = feesWithFix.add(fixedNativeFeeAfterDiscount);

        let sendTx = await this.debridgeETH.send(
          tokenAddress,
          amount,
          chainIdTo,
          receiver,
          [],
          false,
          referralCode,
          [],
          {
            value: amount,
            from: sender,
          }
        );

        let receipt = await sendTx.wait();
        let sentEvent = receipt.events.find((x) => {
          return x.event == "Sent";
        });
        sentEvents.push(sentEvent);

        await testSubmissionFees(
          feesCalculatorETH,
          sentEvent,
          tokenAddress,
          amount,
          chainIdTo,
          sender,
          false,
          0,
        )

        const newBalance = toBN(await this.wethETH.balanceOf(this.debridgeETH.address));
        const newDebridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(this.debridgeWethId);
        assert.equal(balance.add(amount).toString(), newBalance.toString());
        assert.equal(
          debridgeFeeInfo.collectedFees.add(feesWithFix).toString(),
          newDebridgeFeeInfo.collectedFees.toString()
        );

        // check user balance
        const txCost = toBN(receipt.cumulativeGasUsed).mul(toBN(receipt.effectiveGasPrice));
        const userBalanceAfter = toBN(await web3.eth.getBalance(sender));
        assert.equal(
          userBalanceAfter.toString(),
          userBalanceBefore.sub(amount).sub(txCost).toString());

        // check amount in Sent event
        assert.equal(
          sentEvent.args.amount.toString(),
          normalizeTokenAmount(amount.sub(feesWithFix), 18).toString());

        //TODO: check that balance was increased
        // const newDebridgeInfo = await this.debridgeETH.getDebridge(debridgeId);
        // assert.equal(
        //   debridge.balance
        //     .add(amount)  - fee%
        //     .toString(),
        //     newDebridgeInfo.balance.toString()
        // );

        // TODO: check sender's balance

        // test getNativeInfo mapping to be sure that _addAsset call in send added correct asset

        // getNativeInfo[address(0)] should be empty
        const ethInfo = await this.debridgeETH.getNativeInfo(ZERO_ADDRESS);
        assert.equal(ethInfo.nativeChainId, 0);
        assert.equal(ethInfo.nativeAddress, '0x');

        // getNativeInfo[WETH] should have correct nativeAddress
        const wethInfo = await this.debridgeETH.getNativeInfo(this.wethETH.address);
        assert.equal(wethInfo.nativeChainId.toNumber(), ethChainId);
        assert.equal(
          wethInfo.nativeAddress.toLowerCase(),
          this.wethETH.address.toLowerCase()
        );
      });

      it("should send native tokens with rounding", async function () {
        const tokenAddress = ZERO_ADDRESS;
        const sender = alice;
        const receiver = bob;
        const chainIdTo = bscChainId;
        // use amount with more decimals than max supported
        const amountDecimals = MAX_TRANSFER_DECIMALS + 4;
        let amount = 1 - 10 ** -amountDecimals;
        amount = ethers.utils.parseEther(amount.toFixed(amountDecimals));
        // console.log(amount.toString());

        const balance = toBN(await this.wethETH.balanceOf(this.debridgeETH.address));
        const userBalanceBefore = toBN(await web3.eth.getBalance(sender));

        const debridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(this.debridgeWethId);
        const supportedChainInfo = await this.debridgeETH.getChainToConfig(chainIdTo);
        const fixedNativeFeeAfterDiscount = toBN(supportedChainInfo.fixedNativeFee).mul(BPS-discount).div(BPS);
        let feesWithFix = toBN(supportedChainInfo.transferFeeBps)
          .mul(toBN(amount).sub(fixedNativeFeeAfterDiscount))
          .div(BPS);
        feesWithFix = toBN(feesWithFix).sub(toBN(feesWithFix).mul(discount).div(BPS));
        feesWithFix = feesWithFix.add(fixedNativeFeeAfterDiscount);

        let sendTx = await this.debridgeETH.send(
          tokenAddress,
          amount,
          chainIdTo,
          receiver,
          [],
          false,
          referralCode,
          [],
          {
            value: amount,
            from: sender,
          }
        );

        let receipt = await sendTx.wait();
        let sentEvent = receipt.events.find((x) => {
          return x.event == "Sent";
        });
        sentEvents.push(sentEvent);

        await testSubmissionFees(
          feesCalculatorETH,
          sentEvent,
          tokenAddress,
          amount,
          chainIdTo,
          sender,
          false,
          0,
        )

        const newBalance = toBN(await this.wethETH.balanceOf(this.debridgeETH.address));
        const newDebridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(this.debridgeWethId);
        assert.equal(balance.add(amount).toString(), newBalance.toString());
        assert.equal(
          debridgeFeeInfo.collectedFees.add(feesWithFix).toString(),
          newDebridgeFeeInfo.collectedFees.toString()
        );

        // check user balance
        const txCost = toBN(receipt.cumulativeGasUsed).mul(toBN(receipt.effectiveGasPrice));
        const userBalanceAfter = toBN(await web3.eth.getBalance(sender));
        assert.equal(
          userBalanceAfter.toString(),
          userBalanceBefore.sub(amount).sub(txCost).toString());

        // check amount in Sent event, it should be rounded
        assert.notEqual(
          sentEvent.args.amount.toString(),
          amount.sub(feesWithFix).toString());
        assert.equal(
          sentEvent.args.amount.toString(),
          normalizeTokenAmount(amount.sub(feesWithFix), 18).toString());
      });

      it("should send ERC20 tokens without permit", async function () {
        const token = this.linkToken;
        const tokenAddress = token.address;
        const chainId = await this.debridgeETH.chainId();
        const sender = alice;
        const receiver = bob;
        const chainIdTo = bscChainId;

        // use amount with max supported decimals
        const tokenDecimals = (await token.decimals()).toNumber();
        let amount = 100 - 10 ** -MAX_TRANSFER_DECIMALS;
        amount = ethers.utils.parseUnits(
          amount.toFixed(MAX_TRANSFER_DECIMALS),
          tokenDecimals);

        await token.mint(sender, amount, {
          from: alice,
        });
        await token.approve(this.debridgeETH.address, amount, {
          from: sender,
        });
        const debridgeId = await this.debridgeETH.getDebridgeId(chainId, tokenAddress);

        const balance = toBN(await token.balanceOf(this.debridgeETH.address));
        const userBalanceBefore = toBN(await token.balanceOf(sender));

        const debridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(debridgeId);
        const supportedChainInfo = await this.debridgeETH.getChainToConfig(chainIdTo);
        const nativeDebridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(
          this.nativeDebridgeIdETH
        );
        let fees = toBN(supportedChainInfo.transferFeeBps).mul(amount).div(BPS);
        fees = toBN(fees).sub(toBN(fees).mul(discount).div(BPS));

        let fixedNativeFee = toBN(supportedChainInfo.fixedNativeFee);
        fixedNativeFee = toBN(fixedNativeFee).sub(toBN(fixedNativeFee).mul(discount).div(BPS));

        let sendTx = await this.debridgeETH.send(
          tokenAddress,
          amount,
          chainIdTo,
          receiver,
          [],
          false,
          referralCode,
          [],
          {
            value: fixedNativeFee,
            from: sender,
          }
        );

        let receipt = await sendTx.wait();
        let sentEvent = receipt.events.find((x) => {
          return x.event == "Sent";
        });
        sentEvents.push(sentEvent);

        await testSubmissionFees(
          feesCalculatorETH,
          sentEvent,
          tokenAddress,
          amount,
          chainIdTo,
          sender,
          false,
          0,
        )

        const newNativeDebridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(
          this.nativeDebridgeIdETH
        );
        const newBalance = toBN(await token.balanceOf(this.debridgeETH.address));
        const newDebridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(debridgeId);
        assert.equal(balance.add(amount).toString(), newBalance.toString());
        assert.equal(
          debridgeFeeInfo.collectedFees.add(fees).toString(),
          newDebridgeFeeInfo.collectedFees.toString()
        );
        assert.equal(
          nativeDebridgeFeeInfo.collectedFees
            .add(toBN(fixedNativeFee))
            .toString(),
          newNativeDebridgeFeeInfo.collectedFees.toString()
        );

        const userBalanceAfter = toBN(await token.balanceOf(sender));
        assert.equal(
          userBalanceAfter.toString(),
          userBalanceBefore.sub(amount).toString());

        // check amount in Sent event
        assert.equal(
          sentEvent.args.amount.toString(),
          normalizeTokenAmount(amount.sub(fees), tokenDecimals).toString());

        //TODO: check that balance was increased
        // assert.equal(
        //   debridge.balance
        //     .add(amount) - fee%
        //     .toString(),
        //     newDebridgeInfo.balance.toString()
        // );

        // TODO: check sender's balance

        // getNativeInfo[token_address] should be correct
        const tokenNativeInfo = await this.debridgeETH.getNativeInfo(tokenAddress);
        assert.equal(tokenNativeInfo.nativeChainId.toNumber(), ethChainId);
        assert.equal(
          tokenNativeInfo.nativeAddress.toLowerCase(),
          tokenAddress.toLowerCase()
        );
      });

      it("should send ERC20 tokens with permit", async function () {
        const tokenAddress = this.linkToken.address;
        const chainId = await this.debridgeETH.chainId();
        const receiver = bob;
        const amount = toBN(toWei("100"));
        const chainIdTo = bscChainId;
        await this.linkToken.mint(alice, amount, {
          from: alice,
        });
        // await this.linkToken.approve(this.debridgeETH.address, amount, {
        //   from: alice,
        // });
        const debridgeId = await this.debridgeETH.getDebridgeId(chainId, tokenAddress);

        const balance = toBN(await this.linkToken.balanceOf(this.debridgeETH.address));
        const debridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(debridgeId);
        const supportedChainInfo = await this.debridgeETH.getChainToConfig(chainIdTo);
        const nativeDebridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(
          this.nativeDebridgeIdETH
        );
        let fees = toBN(supportedChainInfo.transferFeeBps).mul(amount).div(BPS);
        fees = toBN(fees).sub(toBN(fees).mul(discount).div(BPS));

        let fixedNativeFee = toBN(supportedChainInfo.fixedNativeFee);
        fixedNativeFee = toBN(fixedNativeFee).sub(toBN(fixedNativeFee).mul(discount).div(BPS));

        const permit = await permitWithDeadline(
          this.linkToken,
          alice,
          this.debridgeETH.address,
          amount,
          toBN(MAX_UINT256),
          alicePrivKey,
        );

        let sendTx = await this.debridgeETH.send(
          tokenAddress,
          amount,
          chainIdTo,
          receiver,
          permit,
          false,
          referralCode,
          [],
          {
            value: fixedNativeFee,
            from: alice,
          }
        );

        let receipt = await sendTx.wait();
        let sentEvent = receipt.events.find((x) => {
          return x.event == "Sent";
        });
        sentEvents.push(sentEvent);

        await testSubmissionFees(
          feesCalculatorETH,
          sentEvent,
          tokenAddress,
          amount,
          chainIdTo,
          alice,
          false,
          0,
        )

        const newNativeDebridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(
          this.nativeDebridgeIdETH
        );
        const newBalance = toBN(await this.linkToken.balanceOf(this.debridgeETH.address));
        const newDebridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(debridgeId);
        assert.equal(balance.add(amount).toString(), newBalance.toString());
        assert.equal(
          debridgeFeeInfo.collectedFees.add(fees).toString(),
          newDebridgeFeeInfo.collectedFees.toString()
        );
        assert.equal(
          nativeDebridgeFeeInfo.collectedFees
            .add(toBN(fixedNativeFee))
            .toString(),
          newNativeDebridgeFeeInfo.collectedFees.toString()
        );

        //TODO: check that balance was increased
        // assert.equal(
        //   debridge.balance
        //     .add(amount) - fee%
        //     .toString(),
        //     newDebridgeInfo.balance.toString()
        // );

        // TODO: check sender's balance
      });

      it("should overwrite amount when amount and msg.value mismatched when sending extra native tokens", async function () {
        const tokenAddress = ZERO_ADDRESS;
        const chainIdTo = bscChainId;
        const receiver = bob;
        const sender = alice;
        const amount = toBN(toWei("0.1"));
        const sendedAmount = toBN(toWei("0.5"));

        const balance = toBN(await web3.eth.getBalance(sender));

        const tx = await this.debridgeETH.send(
          tokenAddress,
          amount,
          chainIdTo,
          receiver,
          [],
          false,
          referralCode,
          [],
          {
            value: sendedAmount,
            from: sender,
          });
        const receipt = await tx.wait();

        const txCost = toBN(receipt.cumulativeGasUsed).mul(toBN(receipt.effectiveGasPrice));
        const newBalance = toBN(await web3.eth.getBalance(sender));

        assert.equal(balance.sub(sendedAmount).sub(txCost).toString(), newBalance.toString());

        const sentEvent = receipt.events.find((x) => {
          return x.event == "Sent";
        });

        assert.equal(
          sentEvent.args.feeParams.receivedAmount.toString(),
          sendedAmount.toString()
        )
      });

      it("should refund extra fee native tokens when sending ERC20", async function () {
        const token = this.linkToken;
        const chainIdTo = bscChainId;
        const receiver = bob;
        const sender = alice;
        const amount = toBN(toWei("1"));

        await token.mint(sender, amount, {
          from: alice,
        });
        await token.approve(this.debridgeETH.address, amount, {
          from: alice,
        });

        const balance = toBN(await web3.eth.getBalance(sender));

        const supportedChainInfo = await this.debridgeETH.getChainToConfig(chainIdTo);
        let fixedNativeFee = toBN(supportedChainInfo.fixedNativeFee);
        fixedNativeFee = fixedNativeFee.sub(toBN(fixedNativeFee).mul(discount).div(BPS));
        const extraNativeFee = toBN(toWei("0.1"));
        const sendedNativeFee = fixedNativeFee.add(extraNativeFee);

        const tx = await this.debridgeETH.send(
          token.address,
          amount,
          chainIdTo,
          receiver,
          [],
          false,
          referralCode,
          [],
          {
            value: sendedNativeFee,
            from: sender,
          });
        const receipt = await tx.wait();

        const txCost = toBN(receipt.cumulativeGasUsed).mul(toBN(receipt.effectiveGasPrice));
        const newBalance = toBN(await web3.eth.getBalance(sender));

        assert.equal(balance.sub(sendedNativeFee).add(extraNativeFee).sub(txCost).toString(), newBalance.toString());
      });

      it("should reject sending tokens to unsupported chain", async function () {
        const tokenAddress = ZERO_ADDRESS;
        const receiver = bob;
        const amount = toBN(toWei("1"));
        const chainIdTo = 9999;
        await expectRevert(
          this.debridgeETH.send(
            tokenAddress,
            amount,
            chainIdTo,
            receiver,
            [],
            false,
            referralCode,
            [],
            {
              value: amount,
              from: alice,
            }),
          "WrongChainTo()"
        );
      });

      it("should reject sending tokens without symbol or decimals", async function () {
        const invalidToken = await MockInvalidToken.new("Invalid Token", "INVALID", 10, {
          from: alice,
        });
        const tokenAddress = invalidToken.address;
        const receiver = bob;
        const amount = toBN(toWei("1"));
        const chainIdTo = bscChainId;
        await expectRevert(
          this.debridgeETH.send(
            tokenAddress,
            amount,
            chainIdTo,
            receiver,
            [],
            false,
            referralCode,
            [],
            {
              value: amount,
              from: alice,
            }),
          "InvalidTokenToSend()"
        );
      });

      it("should support non EVM receiver parameter", async function () {
        const amount = toBN(toWei("1"));
        for (const receiver of this.non_evm_receivers) {
          const tx = await this.debridgeETH.send(
            ZERO_ADDRESS,
            amount,
            bscChainId,
            receiver,
            [],
            false,
            referralCode,
            [],
            {
              value: amount,
              from: alice,
            }
          );
          let receipt = await tx.wait();
          let event = receipt.events.find((x) => x.event == "Sent");
          assert.equal(event.args.receiver, receiver);

          await testSubmissionFees(
            feesCalculatorETH,
            event,
            ZERO_ADDRESS,
            amount,
            bscChainId,
            alice,
            false,
            0,
          )
        }
      });
    });
  });

  // test adding assets after calling send method

  context("Test managing assets", () => {
    before(async function () {
      currentChainId = await this.debridgeETH.chainId();
      const newSupply = toWei("100");
      await this.linkToken.mint(alice, newSupply, {
        from: alice,
      });
      await this.dbrToken.mint(alice, newSupply, {
        from: alice,
      });
    });

    it("should revert deploying new asset without signatures", async function() {
      await expectRevert(
        this.debridgeBSC.deployNewAsset(this.wethETH.address, bscChainId, "Wrapped ETH", "deETH", 18, []),
        "NotConfirmedByRequiredOracles()");
      await expectRevert(
        this.debridgeBSC.deployNewAsset(this.wethETH.address, hecoChainId, "Wrapped HT", "deHT", 18, []),
        "NotConfirmedByRequiredOracles()");
      await expectRevert(
        this.debridgeHECO.deployNewAsset(this.wethETH.address, ethChainId, "Wrapped ETH", "deETH", 18, []),
        "NotConfirmedByRequiredOracles()");
      await expectRevert(
        this.debridgeHECO.deployNewAsset(this.cakeToken.address, bscChainId, "PancakeSwap Token", "Cake", 18, []),
        "NotConfirmedByRequiredOracles()");
      await expectRevert(
        this.debridgeHECO.deployNewAsset(this.wethBSC.address, bscChainId, "Wrapped BNB", "deBNB", 18, []),
        "NotConfirmedByRequiredOracles()");
    });

    it("should deploy new asset if called with validators signatures", async function () {
      const tokenAddress = this.linkToken.address;
      const chainId = ethChainId;
      const maxAmount = toWei("1000000");
      const amountThreshold = toWei("10");
      const name = await this.linkToken.name();
      const symbol = await this.linkToken.symbol();
      const decimals = (await this.linkToken.decimals()).toString();
      const debridgeId = await this.debridgeBSC.getDebridgeId(chainId, tokenAddress);

      const deployId = await this.debridgeBSC.getDeployId(
        debridgeId,
        name,
        symbol,
        decimals
      );
      const deploySignatures = await submissionSignatures(bscWeb3, oracleKeys, deployId);

      await this.debridgeBSC.updateAsset(debridgeId, maxAmount, minReservesBps, amountThreshold);
      const debridge = await this.debridgeBSC.getDebridge(debridgeId);
      const debridgeFeeInfo = await this.debridgeBSC.getDebridgeFeeInfo(debridgeId);
      assert.equal(debridge.maxAmount.toString(), maxAmount);
      assert.equal(debridgeFeeInfo.collectedFees.toString(), "0");
      assert.equal(debridge.balance.toString(), "0");
      assert.equal(debridge.minReservesBps.toString(), minReservesBps);

      assert.equal(await this.debridgeBSC.getAmountThreshold(debridgeId), amountThreshold);

      // Deploy tokens
      let tx = await this.debridgeBSC.deployNewAsset(tokenAddress, chainId, name, symbol, decimals, deploySignatures);
      let receipt = await tx.wait();
      let pairAddedEvent = receipt.events.find((x) => {
          return x.event == "PairAdded";
      });
      deLinkAddressInBSC = pairAddedEvent.args.tokenAddress;
      // console.log(`deLinkAddressInBSC ${deLinkAddressInBSC}`);
    });

    it("should deploy list of new assets", async function () {
      let tokenNativeAddress = this.wethETH.address;
      let tokenNativeChainId = ethChainId;
      let tokenName = "Wrapped ETH";
      let tokenSymbol = "WETH";
      let tokenDecimals = 18;
      let debridgeId = await this.debridgeBSC.getDebridgeId(tokenNativeChainId, tokenNativeAddress);
      let deployId = await this.debridgeBSC.getDeployId(
        debridgeId,
        tokenName,
        tokenSymbol,
        tokenDecimals
      );
      let deploySignatures = await submissionSignatures(bscWeb3, oracleKeys, deployId);

      //Override name/sybmol
      await this.deBridgeTokenDeployerBSC.setOverridedTokenInfo(
        [debridgeId],
        [
          {
            accept: true,
            name: "ETH",
            symbol: "ETH",
          }
        ]
      );

      let tx =  await this.debridgeBSC.deployNewAsset(tokenNativeAddress, tokenNativeChainId, tokenName, tokenSymbol, tokenDecimals, deploySignatures);
      let receipt = await tx.wait();
      let pairAddedEvent = receipt.events.find((x) => {
          return x.event == "PairAdded";
      });
      deETHAddressInBSC = pairAddedEvent.args.tokenAddress;
      // console.log(`deETHAddressInBSC ${deETHAddressInBSC}`);

      tx =  await this.debridgeHECO.deployNewAsset(tokenNativeAddress, tokenNativeChainId, tokenName, tokenSymbol, tokenDecimals, deploySignatures);
      receipt = await tx.wait();
      pairAddedEvent = receipt.events.find((x) => {
          return x.event == "PairAdded";
      });
      deETHAddressInHECO = pairAddedEvent.args.tokenAddress;
      // console.log(`deETHAddressInHECO ${deETHAddressInHECO}`);

      tokenNativeAddress = this.wethHECO.address;
      tokenNativeChainId = hecoChainId;
      tokenName = "Wrapped HT";
      tokenSymbol = "WHT";
      tokenDecimals = 18;
      debridgeId = await this.debridgeBSC.getDebridgeId(tokenNativeChainId, tokenNativeAddress);
      deployId = await this.debridgeBSC.getDeployId(
        debridgeId,
        tokenName,
        tokenSymbol,
        tokenDecimals
      );
      deploySignatures = await submissionSignatures(bscWeb3, oracleKeys, deployId);
      tx =  await this.debridgeBSC.deployNewAsset(tokenNativeAddress, tokenNativeChainId, tokenName, tokenSymbol, tokenDecimals, deploySignatures);
      receipt = await tx.wait();
      pairAddedEvent = receipt.events.find((x) => {
          return x.event == "PairAdded";
      });
      deHTAddressInBSC = pairAddedEvent.args.tokenAddress;
      // console.log(`deHTAddressInBSC ${deHTAddressInBSC}`);


      tokenNativeAddress = this.cakeToken.address;
      tokenNativeChainId = bscChainId;
      tokenName = "PancakeSwap Token";
      tokenSymbol = "Cake";
      tokenDecimals = 18;
      debridgeId = await this.debridgeBSC.getDebridgeId(tokenNativeChainId, tokenNativeAddress);
      deployId = await this.debridgeBSC.getDeployId(
        debridgeId,
        tokenName,
        tokenSymbol,
        tokenDecimals
      );
      deploySignatures = await submissionSignatures(bscWeb3, oracleKeys, deployId);
      tx =  await this.debridgeHECO.deployNewAsset(tokenNativeAddress, tokenNativeChainId, tokenName, tokenSymbol, tokenDecimals, deploySignatures);
      receipt = await tx.wait();
      pairAddedEvent = receipt.events.find((x) => {
          return x.event == "PairAdded";
      });
      deCakeAddressInHECO = pairAddedEvent.args.tokenAddress;
      // console.log(`deCakeAddressInHECO ${deCakeAddressInHECO}`);


      tokenNativeAddress = this.wethBSC.address;
      tokenNativeChainId = bscChainId;
      tokenName = "Wrapped BNB";
      tokenSymbol = "WBNB";
      tokenDecimals = 18;
      debridgeId = await this.debridgeBSC.getDebridgeId(tokenNativeChainId, tokenNativeAddress);
      deployId = await this.debridgeBSC.getDeployId(
        debridgeId,
        tokenName,
        tokenSymbol,
        tokenDecimals
      );
      deploySignatures = await submissionSignatures(bscWeb3, oracleKeys, deployId);
      tx =  await this.debridgeHECO.deployNewAsset(tokenNativeAddress, tokenNativeChainId, tokenName, tokenSymbol, tokenDecimals, deploySignatures);
      receipt = await tx.wait();
      pairAddedEvent = receipt.events.find((x) => {
          return x.event == "PairAdded";
      });
      deBNBAddressInHECO = pairAddedEvent.args.tokenAddress;


      //this.emptyNameToken.address, hecoChainId, "", "NONAME", 18
      tokenNativeAddress = this.emptyNameToken.address;
      tokenNativeChainId = hecoChainId;
      tokenName = "";
      tokenSymbol = "NONAME";
      tokenDecimals = 18;
      debridgeId = await this.debridgeBSC.getDebridgeId(tokenNativeChainId, tokenNativeAddress);
      deployId = await this.debridgeBSC.getDeployId(
        debridgeId,
        tokenName,
        tokenSymbol,
        tokenDecimals
      );
      deploySignatures = await submissionSignatures(bscWeb3, oracleKeys, deployId);
      tx =  await this.debridgeBSC.deployNewAsset(tokenNativeAddress, tokenNativeChainId, tokenName, tokenSymbol, tokenDecimals, deploySignatures);
      receipt = await tx.wait();
      pairAddedEvent = receipt.events.find((x) => {
          return x.event == "PairAdded";
      });
      const deEmptyNameTokenAddressInBSC = pairAddedEvent.args.tokenAddress;
      const deEmptyNameToken = await DeBridgeToken.at(deEmptyNameTokenAddressInBSC);
      assert.equal( await deEmptyNameToken.symbol(), "deNONAME");
      // detoken name should use symbol because original name is empty
      assert.equal( await deEmptyNameToken.name(), "deBridge NONAME");
      assert.equal( (await deEmptyNameToken.decimals()).toString(), "18");

      // console.log(`deBNBAddressInHECO ${deBNBAddressInHECO}`);

      //Check that new deployed token with correct values
      const wethDebridgeId =  await this.debridgeBSC.getDebridgeId(ethChainId, this.wethETH.address);
      const wethDebridge = await this.debridgeBSC.getDebridge(wethDebridgeId);
      const deWethTokenAddress = wethDebridge.tokenAddress;
      const deBridgeTokenInstance = await DeBridgeToken.at(deWethTokenAddress);
      // console.log(deWethTokenAddress);
      // console.log(await deBridgeTokenInstance.symbol());
      // console.log(await deBridgeTokenInstance.name());
      // console.log(await deBridgeTokenInstance.decimals());
      assert.equal( await deBridgeTokenInstance.symbol(), "deETH");
      assert.equal( await deBridgeTokenInstance.name(), "deBridge ETH");
      assert.equal( (await deBridgeTokenInstance.decimals()).toString(), "18");


      const deBNBInHecoTokenInstance = await DeBridgeToken.at(deBNBAddressInHECO);
      assert.equal( await deBNBInHecoTokenInstance.symbol(), "deWBNB");
      assert.equal( await deBNBInHecoTokenInstance.name(), "deBridge Wrapped BNB");
      assert.equal( (await deBNBInHecoTokenInstance.decimals()).toString(), "18");
    });

    it("should reject deploy new asset twice", async function () {
      let tokenNativeAddress = this.wethETH.address;
      let tokenNativeChainId = ethChainId;
      let tokenName = "Wrapped ETH";
      let tokenSymbol = "WETH";
      let tokenDecimals = 18;
      let debridgeId = await this.debridgeBSC.getDebridgeId(tokenNativeChainId, tokenNativeAddress);
      let deployId = await this.debridgeBSC.getDeployId(
        debridgeId,
        tokenName,
        tokenSymbol,
        tokenDecimals
      );
      let deploySignatures = await submissionSignatures(bscWeb3, oracleKeys, deployId);
      await expectRevert(
        this.debridgeBSC.deployNewAsset(tokenNativeAddress, tokenNativeChainId, tokenName, tokenSymbol, tokenDecimals, deploySignatures),
        "AssetAlreadyExist()");
    });

    it("should have same output for getDebridgeId/getbDebridgeId", async function () {
      const chainIdFrom = await this.debridgeETH.chainId();
      // const chainIdTo = await this.debridgeBSC.chainId();
      const nativeDebridgeIdFrom = await this.debridgeETH.getDebridgeId(chainIdFrom, ZERO_ADDRESS);
      const nativeDebridgeIdTo = await this.debridgeETH.getbDebridgeId(chainIdFrom, ZERO_ADDRESS);
      assert.equal(nativeDebridgeIdFrom, nativeDebridgeIdTo);

      const tokenDebridgeIdFrom = await this.debridgeETH.getDebridgeId(chainIdFrom, this.linkToken.address);
      const tokenDebridgeIdTo = await this.debridgeETH.getbDebridgeId(chainIdFrom, this.linkToken.address);
      assert.equal(tokenDebridgeIdFrom, tokenDebridgeIdTo);
    });
  });

  context("Test mint method (BSC network)", () => {
    before(async function () {
      this.debridgeWethId = await this.debridgeETH.getDebridgeId(ethChainId, this.wethETH.address);
      this.nativeSubmission = sentEvents.find((x) => {
        return x.args.debridgeId == this.debridgeWethId;
      });
      this.nativeSubmissionId = this.nativeSubmission.args.submissionId;

      this.linkSubmission = sentEvents.find((x) => {
        return x.args.debridgeId == this.linkDebridgeId;
      });
      this.linkSubmissionId = this.linkSubmission.args.submissionId;
    });

    it("should reject native token without confirmation from required oracle", async function () {
      let signatures = await submissionSignatures(bscWeb3, oracleKeys.slice(1, oracleKeys.length), this.linkSubmissionId);

      await expectRevert(
        this.debridgeBSC.claim(
          this.debridgeWethId,
          this.nativeSubmission.args.amount,
          ethChainId,
          this.nativeSubmission.args.receiver,
          this.nativeSubmission.args.nonce,
          signatures,
          [],
          {
            from: alice,
          }
        ),
        "NotConfirmedByRequiredOracles()"
      );
    });

    it("should reject if submission from unsupported network", async function () {
      let signatures = await submissionSignatures(bscWeb3, oracleKeys.slice(1, oracleKeys.length), this.linkSubmissionId);

      await expectRevert(
        this.debridgeBSC.claim(
          this.debridgeWethId,
          this.nativeSubmission.args.amount,
          8888,
          this.nativeSubmission.args.receiver,
          this.nativeSubmission.args.nonce,
          signatures,
          [],
          {
            from: alice,
          }
        ),
        "WrongChainFrom()"
      );
    });

    it("update reduce ExcessConfirmations if called by the admin", async function () {
      let newExcessConfirmations = 3;
      await this.debridgeBSC.updateExcessConfirmations(newExcessConfirmations, {
        from: alice,
      });
      assert.equal(await this.debridgeBSC.excessConfirmations(), newExcessConfirmations);
    });

    it("should reject when the submission is blocked", async function () {
      await this.debridgeBSC.blockSubmission([this.nativeSubmissionId], true, {
        from: alice,
      });
      assert.equal(await this.debridgeBSC.isBlockedSubmission(this.nativeSubmissionId), true);
      let signatures = await submissionSignatures(bscWeb3, oracleKeys, this.nativeSubmissionId);

      await expectRevert(
        this.debridgeBSC.claim(
          this.debridgeWethId,
          this.nativeSubmission.args.amount,
          ethChainId,
          this.nativeSubmission.args.receiver,
          this.nativeSubmission.args.nonce,
          signatures,
          [],
          {
            from: alice,
          }
        ),
        "SubmissionBlocked()"
      );
    });

    it("should unblock the submission by admin", async function () {
      await this.debridgeBSC.blockSubmission([this.nativeSubmissionId], false, {
        from: alice,
      });
      assert.equal(await this.debridgeBSC.isBlockedSubmission(this.nativeSubmissionId), false);
    });

    it("should mint (deETH) when the submission is approved", async function () {
      const balance = toBN("0");
      const receiver = this.nativeSubmission.args.receiver;
      const submissionId = await this.debridgeBSC.getSubmissionId(
        this.debridgeWethId,
        ethChainId,
        bscChainId,
        this.nativeSubmission.args.amount,
        receiver,
        this.nativeSubmission.args.nonce
      );

      assert.equal(this.nativeSubmissionId, submissionId);

      let signatures = await submissionSignatures(bscWeb3, oracleKeys, submissionId);

      await this.debridgeBSC.claim(
        this.debridgeWethId,
        this.nativeSubmission.args.amount,
        ethChainId,
        receiver,
        this.nativeSubmission.args.nonce,
        signatures,
        [],
        {
          from: alice,
        }
      );
      const debridgeInfo = await this.debridgeBSC.getDebridge(this.debridgeWethId);
      const deBridgeToken = await DeBridgeToken.at(debridgeInfo.tokenAddress);
      const newBalance = toBN(await deBridgeToken.balanceOf(receiver));


      const isSubmissionUsed = await this.debridgeBSC.isSubmissionUsed(submissionId);
      assert.equal(
        balance.add(this.nativeSubmission.args.amount).toString(),
        newBalance.toString()
      );
      assert.ok(isSubmissionUsed);

      const externalIsSubmissionUsed = await this.mockExternalContract.readIsSubmissionUsed(this.debridgeBSC.address, submissionId);
      assert.ok(externalIsSubmissionUsed);

      const nativeTokenInfo = await this.debridgeBSC.getNativeInfo(debridgeInfo.tokenAddress);
      assert.equal(ethChainId.toString(), nativeTokenInfo.nativeChainId.toString());
      assert.equal(this.wethETH.address.toLowerCase(), nativeTokenInfo.nativeAddress.toString());
    });

    it("should mint (deLink) when the submission is approved ", async function () {
      const balance = toBN("0");
      let signatures = await submissionSignatures(bscWeb3, oracleKeys, this.linkSubmissionId);
      await this.debridgeBSC.claim(
        this.linkDebridgeId,
        this.linkSubmission.args.amount,
        ethChainId,
        this.linkSubmission.args.receiver,
        this.linkSubmission.args.nonce,
        signatures,
        [],
        {
          from: alice,
        }
      );
      const debridgeInfo = await this.debridgeBSC.getDebridge(this.linkDebridgeId);
      const deBridgeToken = await DeBridgeToken.at(debridgeInfo.tokenAddress);
      const newBalance = toBN(await deBridgeToken.balanceOf(this.linkSubmission.args.receiver));
      const submissionId = await this.debridgeBSC.getSubmissionId(
        this.linkDebridgeId,
        ethChainId,
        bscChainId,
        this.linkSubmission.args.amount,
        this.linkSubmission.args.receiver,
        this.linkSubmission.args.nonce
      );
      const isSubmissionUsed = await this.debridgeBSC.isSubmissionUsed(submissionId);
      assert.equal(balance.add(this.linkSubmission.args.amount).toString(), newBalance.toString());
      assert.ok(isSubmissionUsed);

      const externalIsSubmissionUsed = await this.mockExternalContract.readIsSubmissionUsed(this.debridgeBSC.address, submissionId);
      assert.ok(externalIsSubmissionUsed);

      const nativeTokenInfo = await this.debridgeBSC.getNativeInfo(debridgeInfo.tokenAddress);
      assert.equal(ethChainId.toString(), nativeTokenInfo.nativeChainId.toString());
      assert.equal(this.linkToken.address.toLowerCase(), nativeTokenInfo.nativeAddress.toString());
    });

    it("should reject minting with unconfirmed submission", async function () {
      const wrongNonce = 4;
      let signatures = await submissionSignatures(bscWeb3, oracleKeys, this.nativeSubmissionId);

      await expectRevert(
        this.debridgeBSC.claim(
          this.debridgeWethId,
          this.nativeSubmission.args.amount,
          ethChainId,
          this.nativeSubmission.args.receiver,
          wrongNonce,
          signatures,
          [],
          {
            from: alice,
          }
        ),
        "NotConfirmedByRequiredOracles()"
      );
    });

    it("should reject minting twice", async function () {
      let signatures = await submissionSignatures(bscWeb3, oracleKeys, this.nativeSubmissionId);
      await expectRevert(
        this.debridgeBSC.claim(
          this.debridgeWethId,
          this.nativeSubmission.args.amount,
          ethChainId,
          this.nativeSubmission.args.receiver,
          this.nativeSubmission.args.nonce,
          signatures,
          [],
          {
            from: alice,
          }
        ),
        "SubmissionUsed"
      );
    });
  });

  discountsValues.forEach(discount => {
    context(`Test burn method (BSC network) discount: ${(discount * 100) / BPS}%`, () => {
      before(async function () {});

      it(`set discount ${(discount * 100) / BPS}% fee for customer bob`, async function () {
        await this.debridgeBSC.updateFeeDiscount(bob, discount, discount);
        const discountFromContract = await this.debridgeBSC.feeDiscount(bob);
        expect(discount).to.equal(discountFromContract.discountTransferBps);
        expect(discount).to.equal(discountFromContract.discountFixBps);
      });

      it("should burning (deETH, deLink) when the amount is sufficient", async function () {
        let tokensAddresses = [deETHAddressInBSC, deLinkAddressInBSC];
        for (let currentToken of tokensAddresses) {
          const chainIdTo = ethChainId;
          const receiver = bob;
          const amount = toBN(toWei("1"));
          // console.log(currentToken);
          const nativeInfo = await this.debridgeBSC.getNativeInfo(currentToken);
          const debridgeId = await this.debridgeBSC.getDebridgeId(nativeInfo.nativeChainId, nativeInfo.nativeAddress);
          // console.log(debridgeId);
          // console.log(`debridgeWethId ${this.debridgeWethId}`);
          const debridgeInfo = await this.debridgeBSC.getDebridge(debridgeId);
          const debridgeFeeInfo = await this.debridgeBSC.getDebridgeFeeInfo(debridgeId);
          const deBridgeToken = await DeBridgeToken.at(debridgeInfo.tokenAddress);
          const balance = toBN(await deBridgeToken.balanceOf(bob));
          const supportedChainInfo = await this.debridgeBSC.getChainToConfig(chainIdTo);
          const permitParameter = await permitWithDeadline(
            deBridgeToken,
            bob,
            this.debridgeBSC.address,
            amount,
            toBN(MAX_UINT256),
            bobPrivKey
          );
          const nativeDebridgeFeeInfo = await this.debridgeBSC.getDebridgeFeeInfo(
            nativeBSCDebridgeId
          );
          let fixedNativeFeeWithDiscount = supportedChainInfo.fixedNativeFee;
          fixedNativeFeeWithDiscount = toBN(fixedNativeFeeWithDiscount).sub(
            toBN(fixedNativeFeeWithDiscount).mul(discount).div(BPS)
          );
          let burnTx = await this.debridgeBSC.connect(bobAccount).send(
            currentToken,
            amount,
            chainIdTo,
            receiver,
            permitParameter,
            false,
            referralCode,
            [],
            {
              value: fixedNativeFeeWithDiscount,
            }
          );

          let receipt = await burnTx.wait();
          // console.log(receipt);
          let burnEvent = receipt.events.find((x) => {
            return x.event == "Sent";
          });
          burnEvents.push(burnEvent);

          await testSubmissionFees(
            feesCalculatorBSC,
            burnEvent,
            currentToken,
            amount,
            chainIdTo,
            bobAccount.address,
            false,
            0,
          )

          const newNativeDebridgeFeeInfo = await this.debridgeBSC.getDebridgeFeeInfo(
            nativeBSCDebridgeId
          );
          const newBalance = toBN(await deBridgeToken.balanceOf(bob));
          assert.equal(balance.sub(amount).toString(), newBalance.toString());
          const newDebridgeFeeInfo = await this.debridgeBSC.getDebridgeFeeInfo(debridgeId);
          let fees = toBN(supportedChainInfo.transferFeeBps).mul(amount).div(BPS);
          fees = toBN(fees).sub(toBN(fees).mul(discount).div(BPS));
          // console.log( debridgeFeeInfo);
          // console.log( 'newDebridgeFeeInfo');
          // console.log(newDebridgeFeeInfo);
          assert.equal(
            debridgeFeeInfo.collectedFees.add(fees).toString(),
            newDebridgeFeeInfo.collectedFees.toString()
          );
          assert.equal(
            nativeDebridgeFeeInfo.collectedFees.add(fixedNativeFeeWithDiscount).toString(),
            newNativeDebridgeFeeInfo.collectedFees.toString()
          );
        }
      });

      // Obsolete
      // it("should reject burning from current chain", async function () {
      //   const receiver = bob;
      //   const amount = toBN(toWei("1"));
      //   await expectRevert(
      //     this.debridgeETH.burn(
      //       this.debridgeWethId,
      //       receiver,
      //       amount,
      //       ethChainId,
      //       [],
      //       false,
      //       referralCode,
      //       [],
      //       {
      //         from: alice,
      //       }
      //     ),
      //     "WrongChain()"
      //   );
      // });

      it("should support non EVM receiver parameter", async function () {
        const amount = toBN(toWei("0.1"));
        const currentToken = deETHAddressInBSC;
        const nativeInfo = await this.debridgeBSC.getNativeInfo(currentToken);
        // console.log("nativeInfo");
        // console.log(nativeInfo);
        const debridgeId = await this.debridgeBSC.getDebridgeId(nativeInfo.nativeChainId, nativeInfo.nativeAddress);
        // console.log("debridgeId");
        // console.log(debridgeId);

        const debridgeInfo = await this.debridgeBSC.getDebridge(debridgeId);
        // console.log("debridgeInfo");
        // console.log(debridgeInfo);

        const deBridgeToken = await DeBridgeToken.at(debridgeInfo.tokenAddress);
        // console.log(`deBridgeToken: ${deBridgeToken.address}`);
        // console.log(`currentToken: ${currentToken}`);
        assert.equal(currentToken, deBridgeToken.address);

        const supportedChainInfo = await this.debridgeBSC.getChainToConfig(ethChainId);
        let fixedNativeFeeWithDiscount = supportedChainInfo.fixedNativeFee;
        fixedNativeFeeWithDiscount = toBN(fixedNativeFeeWithDiscount).sub(
          toBN(fixedNativeFeeWithDiscount).mul(discount).div(BPS)
        );
        for (const receiver of this.non_evm_receivers) {
          const permitParameter = await permitWithDeadline(
            deBridgeToken,
            bob,
            this.debridgeBSC.address,
            amount,
            toBN(MAX_UINT256),
            bobPrivKey
          );
          const tx = await this.debridgeBSC.connect(bobAccount).send(
            currentToken,
            amount,
            ethChainId,
            receiver,
            permitParameter,
            false,
            referralCode,
            [],
            {
              value: fixedNativeFeeWithDiscount,
            }
          );
          let receipt = await tx.wait();
          // console.log(receipt);
          let event = receipt.events.find((x) => x.event == "Sent");
          assert.equal(event.args.receiver, receiver);

          await testSubmissionFees(
            feesCalculatorBSC,
            event,
            currentToken,
            amount,
            ethChainId,
            bobAccount.address,
            false,
            0,
          )
        }
      });
    });
  });

  context("Test claim method (ETH network)", () => {
    before(async function () {
      this.nativeSubmission = burnEvents.find((x) => {
        return x.args.debridgeId == this.debridgeWethId;
      });
      this.nativeSubmissionId = this.nativeSubmission.args.submissionId;

      this.linkSubmission = burnEvents.find((x) => {
        return x.args.debridgeId == this.linkDebridgeId;
      });
      this.linkSubmissionId = this.linkSubmission.args.submissionId;


      this.nativeSignatures = await submissionSignatures(bscWeb3, oracleKeys, this.nativeSubmissionId);
      this.linkSignatures = await submissionSignatures(bscWeb3, oracleKeys, this.linkSubmissionId);
    });

    it("check view method is valid signature", async function () {
      assert.equal(
        await this.signatureVerifierETH.isValidSignature(
          this.nativeSubmissionId,
          (
            await bscWeb3.eth.accounts.sign(this.nativeSubmissionId, oracleKeys[0])
          ).signature
        ),
        true
      );
      assert.equal(
        await this.signatureVerifierETH.isValidSignature(
          this.linkSubmissionId,
          (
            await bscWeb3.eth.accounts.sign(this.nativeSubmissionId, oracleKeys[0])
          ).signature
        ),
        false
      );
    });

    it("should reject when the submission is blocked", async function () {
      await this.debridgeETH.blockSubmission([this.nativeSubmissionId], true, {
        from: alice,
      });

      assert.equal(await this.debridgeETH.isBlockedSubmission(this.nativeSubmissionId), true);

      await expectRevert(
        this.debridgeETH.claim(
          this.debridgeWethId,
          this.nativeSubmission.args.amount,
          bscChainId,
          this.nativeSubmission.args.receiver,
          this.nativeSubmission.args.nonce,
          this.nativeSignatures,
          [],
          {
            from: alice,
          }
        ),
        "SubmissionBlocked()"
      );
    });

    it("should unblock the submission by admin", async function () {
      await this.debridgeETH.blockSubmission([this.nativeSubmissionId], false, {
        from: alice,
      });
      assert.equal(await this.debridgeETH.isBlockedSubmission(this.nativeSubmissionId), false);
    });

    it("should reject when exist dublicate signatures", async function () {
      const debridgeId = this.debridgeWethId;
      const receiver = this.nativeSubmission.args.receiver;
      const amount = this.nativeSubmission.args.amount;
      const nonce = this.nativeSubmission.args.nonce;
      //Add duplicate signatures
      let signaturesWithDublicate =
        "0x" +
        this.nativeSignatures.substring(132, 262) +
        this.nativeSignatures.substring(2, this.nativeSignatures.length);

      //console.log("signatures count: " + signaturesWithDublicate.length);

      await expectRevert(
        this.debridgeETH.claim(
          debridgeId,
          amount,
          bscChainId,
          receiver,
          nonce,
          signaturesWithDublicate,
          [],
          {
            from: alice,
          }
        ),
        "DuplicateSignatures()"
      );
    });

    it("should claim native token when the submission is approved", async function () {
      const debridgeId = this.debridgeWethId;
      const debridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(debridgeId);
      const receiver = this.nativeSubmission.args.receiver;
      const balance = await toBN(await this.wethETH.balanceOf(receiver));
      const amount = this.nativeSubmission.args.amount;
      const nonce = this.nativeSubmission.args.nonce;
      //console.log("signatures count: " + this.nativeSignatures.length);
      await this.debridgeETH.claim(
        debridgeId,
        amount,
        bscChainId,
        receiver,
        nonce,
        this.nativeSignatures,
        [],
        {
          from: alice,
        }
      );
      const newBalance = await toBN(await this.wethETH.balanceOf(receiver));
      const isSubmissionUsed = await this.debridgeETH.isSubmissionUsed(this.nativeSubmissionId);
      const newDebridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridgeFeeInfo.collectedFees.toString(),
        newDebridgeFeeInfo.collectedFees.toString()
      );
      assert.ok(isSubmissionUsed);

      const externalIsSubmissionUsed = await this.mockExternalContract.readIsSubmissionUsed(this.debridgeETH.address, this.nativeSubmissionId);
      assert.ok(externalIsSubmissionUsed);
    });

    it("should claim ERC20 when the submission is approved", async function () {
      const debridgeId = this.linkDebridgeId;
      const debridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(debridgeId);
      const receiver = this.linkSubmission.args.receiver;
      const balance = toBN(await this.linkToken.balanceOf(receiver));
      const amount = this.linkSubmission.args.amount;
      const nonce = this.linkSubmission.args.nonce;
      await this.debridgeETH.claim(
        debridgeId,
        amount,
        bscChainId,
        receiver,
        nonce,
        this.linkSignatures,
        [],
        {
          from: alice,
        }
      );
      const newBalance = toBN(await this.linkToken.balanceOf(receiver));
      const isSubmissionUsed = await this.debridgeETH.isSubmissionUsed(this.linkSubmissionId);
      const newDebridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridgeFeeInfo.collectedFees.toString(),
        newDebridgeFeeInfo.collectedFees.toString()
      );
      assert.ok(isSubmissionUsed);

      const externalIsSubmissionUsed = await this.mockExternalContract.readIsSubmissionUsed(this.debridgeETH.address, this.linkSubmissionId);
      assert.ok(externalIsSubmissionUsed);
    });

    it("should reject claiming with unconfirmed submission", async function () {
      const debridgeId = this.linkDebridgeId;
      const receiver = this.linkSubmission.args.receiver;
      const amount = this.linkSubmission.args.amount;
      const wrongNonce = 999;
      await expectRevert(
        this.debridgeETH.claim(
          debridgeId,
          amount,
          bscChainId,
          receiver,
          wrongNonce,
          this.linkSignatures,
          [],
          { from: alice }
        ),
        "NotConfirmedByRequiredOracles()"
      );
    });

    it("should reject claiming twice", async function () {
      const debridgeId = this.linkDebridgeId;
      const receiver = this.linkSubmission.args.receiver;
      const amount = this.linkSubmission.args.amount;
      const nonce = this.linkSubmission.args.nonce;

      await expectRevert(
        this.debridgeETH.claim(
          debridgeId,
          amount,
          bscChainId,
          receiver,
          nonce,
          this.linkSignatures,
          [],
          { from: alice }
        ),
        "Submission"
      );
    });
  });

  context(`Test transfer between BSC to HECO.`, () => {
    before(async function () {
      this.sentEventsBSC = [];
    });
    it("should send native tokens (from BSC to HECO)", async function () {
      const tokenAddress = ZERO_ADDRESS;
      const chainId = await this.debridgeBSC.chainId();
      const receiver = bob;
      const amount = toBN(toWei("10"));
      const chainIdTo = hecoChainId;
      // const debridgeId = await this.debridgeBSC.getDebridgeId(
      //   chainId,
      //   tokenAddress
      // );
      const discount = 0;
      const balance = toBN(await this.wethBSC.balanceOf(this.debridgeBSC.address));
      // const debridge = await this.debridgeBSC.getDebridge(debridgeId);
      //collect fee in weth bsc
      const debridgeFeeInfo = await this.debridgeBSC.getDebridgeFeeInfo(this.debridgeWethBSCId);
      const supportedChainInfo = await this.debridgeBSC.getChainToConfig(chainIdTo);
      const fixedNativeFeeAfterDiscount = toBN(supportedChainInfo.fixedNativeFee).mul(BPS-discount).div(BPS);
      let feesWithFix = toBN(supportedChainInfo.transferFeeBps)
        .mul(toBN(amount).sub(fixedNativeFeeAfterDiscount))
        .div(BPS)
        .add(fixedNativeFeeAfterDiscount);

      let sendTx = await this.debridgeBSC.send(
        tokenAddress,
        amount,
        chainIdTo,
        receiver,
        [],
        false,
        0,
        [],
        {
          value: amount,
          from: alice,
        }
      );

      let receipt = await sendTx.wait();
      let sentEvent = receipt.events.find((x) => {
        return x.event == "Sent";
      });
      this.nativeSubmission = sentEvent;
      this.sentEventsBSC.push(sentEvent);

      await testSubmissionFees(
        feesCalculatorBSC,
        sentEvent,
        tokenAddress,
        amount,
        chainIdTo,
        alice,
        false,
        0,
      )

      const newBalance = toBN(await this.wethBSC.balanceOf(this.debridgeBSC.address));
      // const newDebridgeInfo = await this.debridgeBSC.getDebridge(debridgeId);
      const newDebridgeFeeInfo = await this.debridgeBSC.getDebridgeFeeInfo(this.debridgeWethBSCId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridgeFeeInfo.collectedFees.add(feesWithFix).toString(),
        newDebridgeFeeInfo.collectedFees.toString()
      );
    });

    it("should send ERC20 (Cake) tokens (from BSC to HECO)", async function () {
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
      const debridgeId = await this.debridgeBSC.getDebridgeId(chainId, tokenAddress);

      this.cakeDebridgeId = debridgeId;
      const balance = toBN(await this.cakeToken.balanceOf(this.debridgeBSC.address));
      const debridgeInfo = await this.debridgeBSC.getDebridge(debridgeId);
      const debridgeFeeInfo = await this.debridgeBSC.getDebridgeFeeInfo(debridgeId);
      const supportedChainInfo = await this.debridgeBSC.getChainToConfig(chainIdTo);
      const nativeDebridgeFeeInfo = await this.debridgeBSC.getDebridgeFeeInfo(
        this.nativeDebridgeIdBSC
      );
      let fees = toBN(supportedChainInfo.transferFeeBps).mul(amount).div(BPS);
      let sendTx = await this.debridgeBSC.send(
        tokenAddress,
        amount,
        chainIdTo,
        receiver,
        [],
        false,
        0,
        [],
        {
          value: supportedChainInfo.fixedNativeFee,
          from: alice,
        }
      );

      let receipt = await sendTx.wait();
      let sentEvent = receipt.events.find((x) => {
        return x.event == "Sent";
      });
      this.cakeSubmission = sentEvent;
      this.sentEventsBSC.push(sentEvent);

      await testSubmissionFees(
        feesCalculatorBSC,
        sentEvent,
        tokenAddress,
        amount,
        chainIdTo,
        alice,
        false,
        0,
      )

      const newNativeDebridgeFeeInfo = await this.debridgeBSC.getDebridgeFeeInfo(
        this.nativeDebridgeIdBSC
      );
      const newBalance = toBN(await this.cakeToken.balanceOf(this.debridgeBSC.address));
      const newDebridgeFeeInfo = await this.debridgeBSC.getDebridgeFeeInfo(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridgeFeeInfo.collectedFees.add(fees).toString(),
        newDebridgeFeeInfo.collectedFees.toString()
      );

      assert.equal(
        nativeDebridgeFeeInfo.collectedFees.add(toBN(supportedChainInfo.fixedNativeFee)).toString(),
        newNativeDebridgeFeeInfo.collectedFees.toString()
      );
    });

    it("should mint (deBSC) when the submission is approved", async function () {
      const balance = toBN("0");
      const signatures = await submissionSignatures(bscWeb3, oracleKeys, this.nativeSubmission.args.submissionId);
      await this.debridgeHECO.claim(
        this.debridgeWethBSCId,
        this.nativeSubmission.args.amount,
        bscChainId,
        this.nativeSubmission.args.receiver,
        this.nativeSubmission.args.nonce,
        signatures,
        [],
        {
          from: alice,
        }
      );

      const debridgeInfo = await this.debridgeHECO.getDebridge(this.debridgeWethBSCId);
      const deBridgeToken = await DeBridgeToken.at(debridgeInfo.tokenAddress);
      const newBalance = toBN(await deBridgeToken.balanceOf(this.nativeSubmission.args.receiver));

      const submissionId = await this.debridgeHECO.getSubmissionId(
        this.debridgeWethBSCId,
        bscChainId,
        hecoChainId,
        this.nativeSubmission.args.amount,
        this.nativeSubmission.args.receiver,
        this.nativeSubmission.args.nonce
      );
      const isSubmissionUsed = await this.debridgeHECO.isSubmissionUsed(submissionId);
      assert.equal(
        balance.add(this.nativeSubmission.args.amount).toString(),
        newBalance.toString()
      );
      assert.ok(isSubmissionUsed);

      const externalIsSubmissionUsed = await this.mockExternalContract.readIsSubmissionUsed(this.debridgeHECO.address, submissionId);
      assert.ok(externalIsSubmissionUsed);
    });

    it("should mint (deCake) when the submission is approved ", async function () {
      const balance = toBN("0");
      const signatures = await submissionSignatures(bscWeb3, oracleKeys, this.cakeSubmission.args.submissionId);

      let mintTx = await this.debridgeHECO.claim(
        this.cakeDebridgeId,
        this.cakeSubmission.args.amount,
        bscChainId,
        this.cakeSubmission.args.receiver,
        this.cakeSubmission.args.nonce,
        signatures,
        [],
        {
          from: alice,
        }
      );
      let receipt = await mintTx.wait();

      const debridgeInfo = await this.debridgeHECO.getDebridge(this.cakeDebridgeId);
      const deBridgeToken = await DeBridgeToken.at(debridgeInfo.tokenAddress);
      const newBalance = toBN(await deBridgeToken.balanceOf(this.cakeSubmission.args.receiver));
      const submissionId = await this.debridgeHECO.getSubmissionId(
        this.cakeDebridgeId,
        bscChainId,
        hecoChainId,
        this.cakeSubmission.args.amount,
        this.cakeSubmission.args.receiver,
        this.cakeSubmission.args.nonce
      );
      const isSubmissionUsed = await this.debridgeHECO.isSubmissionUsed(submissionId);
      assert.equal(balance.add(this.cakeSubmission.args.amount).toString(), newBalance.toString());
      assert.ok(isSubmissionUsed);

      const externalIsSubmissionUsed = await this.mockExternalContract.readIsSubmissionUsed(this.debridgeHECO.address, submissionId);
      assert.ok(externalIsSubmissionUsed);
    });

    it("should burn (deCake in HECO network)", async function () {
      const currentToken = deCakeAddressInHECO;
      const nativeInfo = await this.debridgeHECO.getNativeInfo(currentToken);
      const debridgeId = await this.debridgeHECO.getDebridgeId(nativeInfo.nativeChainId, nativeInfo.nativeAddress);
      const chainIdTo = ethChainId;
      const receiver = bob;
      const amount = toBN(toWei("1"));
      const debridgeInfo = await this.debridgeHECO.getDebridge(debridgeId);
      const deBridgeToken = await DeBridgeToken.at(debridgeInfo.tokenAddress);
      assert.equal(currentToken, deBridgeToken.address);
      const balance = toBN(await deBridgeToken.balanceOf(bob));
      // const deadline = toBN(Math.floor(Date.now() / 1000)+1000);
      const supportedChainInfo = await this.debridgeHECO.getChainToConfig(chainIdTo);
      const permitParameter = await permitWithDeadline(
        deBridgeToken,
        bob,
        this.debridgeHECO.address,
        amount,
        toBN(MAX_UINT256),
        bobPrivKey
      );
      let fixedNativeFeeWithDiscount = supportedChainInfo.fixedNativeFee;
      // fixedNativeFeeWithDiscount = toBN(fixedNativeFeeWithDiscount).sub(toBN(fixedNativeFeeWithDiscount).mul(discount).div(BPS));
      let burnTx = await this.debridgeHECO.connect(bobAccount).send(
        currentToken,
        amount,
        chainIdTo,
        receiver,
        permitParameter,
        false,
        referralCode,
        [],
        {
          value: fixedNativeFeeWithDiscount,
        }
      );
      const newBalance = toBN(await deBridgeToken.balanceOf(bob));
      assert.equal(balance.sub(amount).toString(), newBalance.toString());
    });
  });

  context("Test autosubmissions", () => {
    it("should have same submissionId for same autoparams", async function() {
      const amount = toBN(toWei("150"));
      const sender = aliceAccount;
      const receiver = bobAccount;
      const executionFee = toBN(toWei("25")); //toBN("25000000001111111111");
      const flags = 20;
      //      const data = [];
      const data = "0xd547741f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000003b38786685c4fd6bc3e685086fc7f086bc254864";

      const fallbackAddress = fei;

      const mypack =  web3.eth.abi.encodeParameter(
        'tuple(uint256,uint8, bytes, bytes)',
        [executionFee, flags, fallbackAddress, data]
      );

      const ethersPack = packSubmissionAutoParamsTo(
        executionFee,
        flags,
        fallbackAddress,
        data)


      // console.log(mypack);
      // console.log(ethersPack);
      const sentTx = await this.debridgeETH
        .connect(sender)
        .send(
          ZERO_ADDRESS,
          amount,
          bscChainId,
          receiver.address,
          [],
          false,
          referralCode,
          packSubmissionAutoParamsTo(
            executionFee,
            flags,
            fallbackAddress,
            data),
          {
            value: amount,
            from: sender.address,
          }
        );

      // get Sent event
      const sentReceipt = await sentTx.wait();
      const sentEvent = sentReceipt.events.find(i => i.event == "Sent");

      await testSubmissionFees(
        feesCalculatorETH,
        sentEvent,
        ZERO_ADDRESS,
        amount,
        bscChainId,
        sender.address,
        false,
        executionFee,
      )

      const submissionIdFrom = await this.debridgeBSC.getSubmissionIdFrom(
        this.debridgeWethId,
        ethChainId,
        amount.sub(executionFee),
        receiver.address,
        sentEvent.args.nonce,
        {
          executionFee,
          flags,
          fallbackAddress,
          data,
          nativeSender: sender.address,
        },
        true,
        ZERO_ADDRESS
      );

      assert.equal(mypack, ethersPack);
      assert.equal(sentEvent.args.submissionId, submissionIdFrom);
    });
  });

  context("Test submission flags", () => {

    // TODO: don't hardcode flags here
    // Flag to unwrap ETH
    const UNWRAP_ETH = 0;
    // Flag to revert if external call fails
    const REVERT_IF_EXTERNAL_FAIL = 1;
    // Flag to call proxy with a sender contract
    const PROXY_WITH_SENDER = 2;
    // Data is hash in DeBridgeGate send method
    const SEND_HASHED_DATA = 3;

    let ethAccount, bscAccount;
    let amount = toBN(toWei("75"));
    let executionFee = toBN(toWei("5"));
    let fallbackAddress;

    let deETHToken;
    let balanceInitial, balanceInitialWETH, balanceDeETHBeforeMint;
    let sentTx, sentEvent;

    before(async function() {
      ethAccount = aliceAccount;
      bscAccount = bobAccount;
      amount = toBN(toWei("75"));
      executionFee = toBN(toWei("5"));
      fallbackAddress = fei;

      const debridgeInfo = await this.debridgeBSC.getDebridge(this.debridgeWethId);
      deETHToken = await DeBridgeToken.at(debridgeInfo.tokenAddress);
    })

    beforeEach(async function() {
      const ignore_tests = ["should set callProxy with sender"]
      if (ignore_tests.includes(this.currentTest.title)) {
        return;
      }

      balanceInitial = toBN(await web3.eth.getBalance(ethAccount.address));
      balanceInitialWETH = toBN(await this.wethETH.balanceOf(ethAccount.address));

      // send native token from ETH to BSC
      sentTx = await this.debridgeETH
        .connect(ethAccount)
        .send(
          ZERO_ADDRESS,
          amount,
          bscChainId,
          bscAccount.address,
          [],
          false,
          referralCode,
          [],
          {
            value: amount,
            from: ethAccount.address,
          }
        );

      // get Sent event
      const sentReceipt = await sentTx.wait();
      sentEvent = sentReceipt.events.find(i => i.event == "Sent");
      // console.log(sentEvent)

      await testSubmissionFees(
        feesCalculatorETH,
        sentEvent,
        ZERO_ADDRESS,
        amount,
        bscChainId,
        ethAccount.address,
        false,
        0,
      )

      const balanceAfterSend = toBN(await web3.eth.getBalance(ethAccount.address));
      const sentTxFee = sentReceipt.gasUsed * sentTx.gasPrice;
      assert.equal(balanceAfterSend.toString(), balanceInitial.sub(amount).sub(sentTxFee).toString());

      let signatures =  await submissionSignatures(bscWeb3, oracleKeys, sentEvent.args.submissionId);

      balanceDeETHBeforeMint = toBN(await deETHToken.balanceOf(bscAccount.address));
      // call mint on BSC to get deETH
      await this.debridgeBSC
        .connect(bscAccount)
        .claim(
          this.debridgeWethId,
          sentEvent.args.amount,
          ethChainId,
          bscAccount.address,
          sentEvent.args.nonce,
          signatures,
          [],
        );

      const balanceDeETHAfterMint = toBN(await deETHToken.balanceOf(bscAccount.address));
      assert.equal(balanceDeETHAfterMint.toString(), balanceDeETHBeforeMint.add(sentEvent.args.amount).toString());

      // approve before burn
      await deETHToken.approve(this.debridgeBSC.address, amount,
        {from: bscAccount.address});
    })

    context("Test UNWRAP_ETH flag", () => {
      it("should burn/claim with UNWRAP_ETH flag without auto call data", async function() {
        const autoData = [];
        const flags = 2 ** UNWRAP_ETH;

        // call autoburn on BSC
        const burnTx = await this.debridgeBSC
          .connect(bscAccount)
          .send(
            deETHToken.address,
            sentEvent.args.amount,
            ethChainId,
            ethAccount.address,
            [],
            false,
            referralCode,
            packSubmissionAutoParamsTo(
              executionFee,
              flags,
              fallbackAddress,
              autoData),
            {
              // pay fee in native token
              value: toWei('1000'),
            }
          );

        const balanceDeETHAfterBurn = toBN(await deETHToken.balanceOf(bscAccount.address));
        assert.equal(balanceDeETHAfterBurn.toString(), balanceDeETHBeforeMint.toString());
        const balanceAfterBurn = toBN(await web3.eth.getBalance(ethAccount.address));
        const workerBalanceWETHBefore = toBN(await this.wethETH.balanceOf(workerAccount.address));

        // get Burnt event
        const burnReceipt = await burnTx.wait();
        const burnEvent = burnReceipt.events.find(i => i.event == "Sent");
        // console.log(burnEvent)

        await testSubmissionFees(
          feesCalculatorBSC,
          burnEvent,
          deETHToken.address,
          sentEvent.args.amount,
          ethChainId,
          bscAccount.address,
          false,
          executionFee,
        )

        // worker call claim on ETH to get native tokens back
        const claimTx = await this.debridgeETH
          .connect(workerAccount)
          .claim(
            burnEvent.args.debridgeId,
            burnEvent.args.amount,
            bscChainId,
            ethAccount.address,
            burnEvent.args.nonce,
            await submissionSignatures(bscWeb3, oracleKeys, burnEvent.args.submissionId),
            packSubmissionAutoParamsFrom(
              executionFee,
              flags,
              fallbackAddress,
              autoData,
              bscAccount.address));

        // weth balance shouldn't change
        const balanceWETH = toBN(await this.wethETH.balanceOf(ethAccount.address));
        assert.equal(balanceWETH.toString(), balanceInitialWETH.toString());

        // eth balance should increased
        const balanceAfterClaim = toBN(await web3.eth.getBalance(ethAccount.address));
        assert.equal(balanceAfterBurn.add(burnEvent.args.amount).toString(), balanceAfterClaim.toString());

        // worker should receive executionFee in weth
        const workerBalanceWETHAfter = toBN(await this.wethETH.balanceOf(workerAccount.address));
        assert.equal(workerBalanceWETHAfter.toString(), workerBalanceWETHBefore.add(executionFee).toString());
      });

      it("should burn/claim with UNWRAP_ETH flag with auto call data", async function() {
        const receiverContractFactory = await ethers.getContractFactory("MockProxyReceiver");
        const receiverContract = await receiverContractFactory.deploy();

        const autoData = receiverContract.interface.encodeFunctionData("setUint256Payable", [
          12345,
        ]);
        const flags = 2 ** UNWRAP_ETH;

        // call autoburn on BSC
        const burnTx = await this.debridgeBSC
          .connect(bscAccount)
          .send(
            deETHToken.address,
            sentEvent.args.amount,
            ethChainId,
            receiverContract.address,
            [],
            false,
            referralCode,
            packSubmissionAutoParamsTo(
              executionFee,
              flags,
              fallbackAddress,
              autoData),
            {
              // pay fee in native token
              value: toWei('1000'),
            }
          );

        const balanceDeETHAfterBurn = toBN(await deETHToken.balanceOf(bscAccount.address));
        assert.equal(balanceDeETHAfterBurn.toString(), balanceDeETHBeforeMint.toString());

        const receiverBalanceBefore = toBN(await web3.eth.getBalance(receiverContract.address));
        const receiverBalanceWETHBefore = toBN(await this.wethETH.balanceOf(receiverContract.address));
        const fallbackBalanceBefore = toBN(await web3.eth.getBalance(fallbackAddress));
        const fallbackBalanceWETHBefore = toBN(await this.wethETH.balanceOf(fallbackAddress));
        const workerBalanceBefore = toBN(await web3.eth.getBalance(workerAccount.address));
        const workerBalanceWETHBefore = toBN(await this.wethETH.balanceOf(workerAccount.address));

        // get Burnt event
        const burnReceipt = await burnTx.wait();
        const burnEvent = burnReceipt.events.find(i => i.event == "Sent");
        // console.log(burnEvent)
        const callProxyAddress = await this.debridgeETH.callProxy();

        await testSubmissionFees(
          feesCalculatorBSC,
          burnEvent,
          deETHToken.address,
          sentEvent.args.amount,
          ethChainId,
          bscAccount.address,
          false,
          executionFee,
        )

        // worker call claim on ETH to get native tokens back
        await expect(
          this.debridgeETH
            .connect(workerAccount)
            .claim(
              burnEvent.args.debridgeId,
              burnEvent.args.amount,
              bscChainId,
              receiverContract.address,
              burnEvent.args.nonce,
              await submissionSignatures(bscWeb3, oracleKeys, burnEvent.args.submissionId),
              packSubmissionAutoParamsFrom(
                executionFee,
                flags,
                fallbackAddress,
                autoData,
                bscAccount.address))
        )
          .to.emit(this.debridgeETH, "AutoRequestExecuted")
          .withArgs(burnEvent.args.submissionId, true, callProxyAddress);

        // weth balance of receiver shouldn't change
        const receiverBalanceWETHAfter = toBN(await this.wethETH.balanceOf(receiverContract.address));
        assert.equal(receiverBalanceWETHBefore.toString(), receiverBalanceWETHAfter.toString());

        // eth balance of receiver should change
        const receiverBalanceAfter = toBN(await web3.eth.getBalance(receiverContract.address));
        assert.equal(receiverBalanceBefore.add(burnEvent.args.amount).toString(), receiverBalanceAfter.toString());

        // fallback weth balance shouldn't change
        const fallbackBalanceWETHAfter = toBN(await this.wethETH.balanceOf(fallbackAddress));
        assert.equal(fallbackBalanceWETHAfter.toString(), fallbackBalanceWETHBefore.toString());

        // fallback eth balance shouldn't change
        const fallbackBalanceAfter = toBN(await web3.eth.getBalance(fallbackAddress));
        assert.equal(fallbackBalanceAfter.toString(), fallbackBalanceBefore.toString());

        // worker should receive executionFee in WETH
        const workerBalanceWETHAfter = toBN(await this.wethETH.balanceOf(workerAccount.address));
        assert.equal(workerBalanceWETHBefore.add(executionFee).toString(), workerBalanceWETHAfter.toString(), );
      });
    });


    context("Test UNWRAP_ETH flag with Weth Gate", () => {

      it("should set Weth Gate  if called by the admin", async function () {
        const gateAddress = this.wethGateETH.address;
        await this.debridgeETH.setWethGate(gateAddress);
        assert.equal(gateAddress, await this.debridgeETH.wethGate());
      });

      it("should burn/claim with UNWRAP_ETH flag without auto call data", async function() {
        const autoData = [];
        const flags = 2 ** UNWRAP_ETH;

        // call autoburn on BSC
        const burnTx = await this.debridgeBSC
          .connect(bscAccount)
          .send(
            deETHToken.address,
            sentEvent.args.amount,
            ethChainId,
            ethAccount.address,
            [],
            false,
            referralCode,
            packSubmissionAutoParamsTo(
              executionFee,
              flags,
              fallbackAddress,
              autoData),
            {
              // pay fee in native token
              value: toWei('1000'),
            }
          );

        const balanceDeETHAfterBurn = toBN(await deETHToken.balanceOf(bscAccount.address));
        assert.equal(balanceDeETHAfterBurn.toString(), balanceDeETHBeforeMint.toString());
        const balanceAfterBurn = toBN(await web3.eth.getBalance(ethAccount.address));
        const workerBalanceWETHBefore = toBN(await this.wethETH.balanceOf(workerAccount.address));

        // get Burnt event
        const burnReceipt = await burnTx.wait();
        const burnEvent = burnReceipt.events.find(i => i.event == "Sent");
        // console.log(burnEvent)

        await testSubmissionFees(
          feesCalculatorBSC,
          burnEvent,
          deETHToken.address,
          sentEvent.args.amount,
          ethChainId,
          bscAccount.address,
          false,
          executionFee,
        )

        // worker call claim on ETH to get native tokens back
        const claimTx = await this.debridgeETH
          .connect(workerAccount)
          .claim(
            burnEvent.args.debridgeId,
            burnEvent.args.amount,
            bscChainId,
            ethAccount.address,
            burnEvent.args.nonce,
            await submissionSignatures(bscWeb3, oracleKeys, burnEvent.args.submissionId),
            packSubmissionAutoParamsFrom(
              executionFee,
              flags,
              fallbackAddress,
              autoData,
              bscAccount.address));

        // weth balance shouldn't change
        const balanceWETH = toBN(await this.wethETH.balanceOf(ethAccount.address));
        assert.equal(balanceWETH.toString(), balanceInitialWETH.toString());

        // eth balance should increased
        const balanceAfterClaim = toBN(await web3.eth.getBalance(ethAccount.address));
        assert.equal(balanceAfterBurn.add(burnEvent.args.amount).toString(), balanceAfterClaim.toString());

        // worker should receive executionFee in weth
        const workerBalanceWETHAfter = toBN(await this.wethETH.balanceOf(workerAccount.address));
        assert.equal(workerBalanceWETHAfter.toString(), workerBalanceWETHBefore.add(executionFee).toString());
      });

      it("should burn/claim with UNWRAP_ETH flag with auto call data", async function() {
        const receiverContractFactory = await ethers.getContractFactory("MockProxyReceiver");
        const receiverContract = await receiverContractFactory.deploy();

        const autoData = receiverContract.interface.encodeFunctionData("setUint256Payable", [
          12345,
        ]);
        const flags = 2 ** UNWRAP_ETH;

        // call autoburn on BSC
        const burnTx = await this.debridgeBSC
          .connect(bscAccount)
          .send(
            deETHToken.address,
            sentEvent.args.amount,
            ethChainId,
            receiverContract.address,
            [],
            false,
            referralCode,
            packSubmissionAutoParamsTo(
              executionFee,
              flags,
              fallbackAddress,
              autoData),
            {
              // pay fee in native token
              value: toWei('1000'),
            }
          );

        const balanceDeETHAfterBurn = toBN(await deETHToken.balanceOf(bscAccount.address));
        assert.equal(balanceDeETHAfterBurn.toString(), balanceDeETHBeforeMint.toString());

        const receiverBalanceBefore = toBN(await web3.eth.getBalance(receiverContract.address));
        const receiverBalanceWETHBefore = toBN(await this.wethETH.balanceOf(receiverContract.address));
        const fallbackBalanceBefore = toBN(await web3.eth.getBalance(fallbackAddress));
        const fallbackBalanceWETHBefore = toBN(await this.wethETH.balanceOf(fallbackAddress));
        const workerBalanceBefore = toBN(await web3.eth.getBalance(workerAccount.address));
        const workerBalanceWETHBefore = toBN(await this.wethETH.balanceOf(workerAccount.address));

        // get Burnt event
        const burnReceipt = await burnTx.wait();
        const burnEvent = burnReceipt.events.find(i => i.event == "Sent");
        // console.log(burnEvent)
        const callProxyAddress = await this.debridgeETH.callProxy();

        await testSubmissionFees(
          feesCalculatorBSC,
          burnEvent,
          deETHToken.address,
          sentEvent.args.amount,
          ethChainId,
          bscAccount.address,
          false,
          executionFee,
        )

        // worker call claim on ETH to get native tokens back
        await expect(
          this.debridgeETH
            .connect(workerAccount)
            .claim(
              burnEvent.args.debridgeId,
              burnEvent.args.amount,
              bscChainId,
              receiverContract.address,
              burnEvent.args.nonce,
              await submissionSignatures(bscWeb3, oracleKeys, burnEvent.args.submissionId),
              packSubmissionAutoParamsFrom(
                executionFee,
                flags,
                fallbackAddress,
                autoData,
                bscAccount.address))
        )
          .to.emit(this.debridgeETH, "AutoRequestExecuted")
          .withArgs(burnEvent.args.submissionId, true, callProxyAddress);

        // weth balance of receiver shouldn't change
        const receiverBalanceWETHAfter = toBN(await this.wethETH.balanceOf(receiverContract.address));
        assert.equal(receiverBalanceWETHBefore.toString(), receiverBalanceWETHAfter.toString());

        // eth balance of receiver should change
        const receiverBalanceAfter = toBN(await web3.eth.getBalance(receiverContract.address));
        assert.equal(receiverBalanceBefore.add(burnEvent.args.amount).toString(), receiverBalanceAfter.toString());

        // fallback weth balance shouldn't change
        const fallbackBalanceWETHAfter = toBN(await this.wethETH.balanceOf(fallbackAddress));
        assert.equal(fallbackBalanceWETHAfter.toString(), fallbackBalanceWETHBefore.toString());

        // fallback eth balance shouldn't change
        const fallbackBalanceAfter = toBN(await web3.eth.getBalance(fallbackAddress));
        assert.equal(fallbackBalanceAfter.toString(), fallbackBalanceBefore.toString());

        // worker should receive executionFee in WETH
        const workerBalanceWETHAfter = toBN(await this.wethETH.balanceOf(workerAccount.address));
        assert.equal(workerBalanceWETHBefore.add(executionFee).toString(), workerBalanceWETHAfter.toString(), );
      });

      it("should set zero address to Weth Gate if called by the admin", async function () {
        await this.debridgeETH.setWethGate(ZERO_ADDRESS);
        assert.equal(ZERO_ADDRESS, await this.debridgeETH.wethGate());
      });
    });

    context("Test PROXY_WITH_SENDER flag", () => {
      let receiverContract;

      before(async function() {
        const receiverContractFactory = await ethers.getContractFactory("MockProxyReceiver");
        receiverContract = await receiverContractFactory.deploy();
      })

      it("should set native sender/chainIdFrom with PROXY_WITH_SENDER flag", async function() {
        const receiverAmount = toBN(toWei("10"));
        const autoData = receiverContract.interface.encodeFunctionData(
          "pullTokenAndSetNativeSender", [this.wethETH.address, receiverAmount, 1]);

        const flags = 2 ** PROXY_WITH_SENDER;

        // call autoburn on BSC
        const burnTx = await this.debridgeBSC
          .connect(bscAccount)
          .send(
            deETHToken.address,
            sentEvent.args.amount,
            ethChainId,
            receiverContract.address,
            [],
            false,
            referralCode,
            packSubmissionAutoParamsTo(
              executionFee,
              flags,
              fallbackAddress,
              autoData),
            {
              // pay fee in native token
              value: toWei('1000'),
            }
          );

        const balanceDeETHAfterBurn = toBN(await deETHToken.balanceOf(bscAccount.address));
        assert.equal(balanceDeETHAfterBurn.toString(), balanceDeETHBeforeMint.toString());

        const receiverBalanceBefore = toBN(await web3.eth.getBalance(receiverContract.address));
        const receiverBalanceWETHBefore = toBN(await this.wethETH.balanceOf(receiverContract.address));
        const fallbackBalanceWETHBefore = toBN(await this.wethETH.balanceOf(fallbackAddress));
        const workerBalanceWETHBefore = toBN(await this.wethETH.balanceOf(workerAccount.address));

        // get Burnt event
        const burnReceipt = await burnTx.wait();
        const burnEvent = burnReceipt.events.find(i => i.event == "Sent");
        // console.log(burnEvent)

        await testSubmissionFees(
          feesCalculatorBSC,
          burnEvent,
          deETHToken.address,
          sentEvent.args.amount,
          ethChainId,
          bscAccount.address,
          false,
          executionFee,
        )

        // worker call claim on ETH to get native tokens back
        await expect(
          this.debridgeETH
            .connect(workerAccount)
            .claim(
              burnEvent.args.debridgeId,
              burnEvent.args.amount,
              bscChainId,
              receiverContract.address,
              burnEvent.args.nonce,
              await submissionSignatures(bscWeb3, oracleKeys, burnEvent.args.submissionId),
              packSubmissionAutoParamsFrom(
                executionFee,
                flags,
                fallbackAddress,
                autoData,
                bscAccount.address))
        )
          .to.emit(this.debridgeETH, "AutoRequestExecuted")
          .withArgs(burnEvent.args.submissionId, true, this.callProxy.address);

        // weth balance of receiver should change
        const receiverBalanceWETHAfter = toBN(await this.wethETH.balanceOf(receiverContract.address));
        assert.equal(receiverBalanceWETHAfter.toString(), receiverBalanceWETHBefore.add(receiverAmount).toString());

        // fallback weth balance should increase
        const fallbackBalanceWETHAfter = toBN(await this.wethETH.balanceOf(fallbackAddress));
        assert.equal(fallbackBalanceWETHAfter.toString(), fallbackBalanceWETHBefore.add(burnEvent.args.amount).sub(receiverAmount).toString());

        // eth balance of receiver shouldn't change
        const receiverBalanceAfter = toBN(await web3.eth.getBalance(receiverContract.address));
        assert.equal(receiverBalanceBefore.toString(), receiverBalanceAfter.toString());

        // worker should receive executionFee in weth
        const workerBalanceWETHAfter = toBN(await this.wethETH.balanceOf(workerAccount.address));
        assert.equal(workerBalanceWETHAfter.toString(), workerBalanceWETHBefore.add(executionFee).toString());
        // check native sender
        assert.equal(bscAccount.address.toString().toLowerCase(), await receiverContract.submissionNativeSender());
        assert.equal("0x", await this.callProxy.submissionNativeSender());
        // check chainIdfrom
        assert.equal((await this.debridgeBSC.chainId()).toString(), (await receiverContract.submissionChainIdFrom()).toString());
        assert.equal("0", (await this.callProxy.submissionChainIdFrom()).toString());

      });
    });

    context("Test REVERT_IF_EXTERNAL_FAIL flag", () => {
      let receiverContract;

      before(async function() {
        const receiverContractFactory = await ethers.getContractFactory("MockProxyReceiver");
        receiverContract = await receiverContractFactory.deploy();
      })

      it("should revert if external call fails with REVERT_IF_EXTERNAL_FAIL flag", async function() {
        // external call with this data fails
        const autoData = receiverContract.interface.encodeFunctionData(
          "setUint256AndPullToken", [this.wethETH.address, amount, 1]);

        const flags = 2 ** REVERT_IF_EXTERNAL_FAIL;

        // call autoburn on BSC
        const burnTx = await this.debridgeBSC
          .connect(bscAccount)
          .send(
            deETHToken.address,
            sentEvent.args.amount,
            ethChainId,
            receiverContract.address,
            [],
            false,
            referralCode,
            packSubmissionAutoParamsTo(
              executionFee,
              flags,
              fallbackAddress,
              autoData),
            {
              // pay fee in native token
              value: toWei('1000'),
            }
          );

        const balanceDeETHAfterBurn = toBN(await deETHToken.balanceOf(bscAccount.address));
        assert.equal(balanceDeETHAfterBurn.toString(), balanceDeETHBeforeMint.toString());

        // get Burnt event
        const burnReceipt = await burnTx.wait();
        const burnEvent = burnReceipt.events.find(i => i.event == "Sent");
        // console.log(burnEvent)

        await testSubmissionFees(
          feesCalculatorBSC,
          burnEvent,
          deETHToken.address,
          sentEvent.args.amount,
          ethChainId,
          bscAccount.address,
          false,
          executionFee,
        )

        // worker call claim on ETH to get native tokens back
        await expectRevert(
          this.debridgeETH
            .connect(workerAccount)
            .claim(
              burnEvent.args.debridgeId,
              burnEvent.args.amount,
              bscChainId,
              receiverContract.address,
              burnEvent.args.nonce,
              await submissionSignatures(bscWeb3, oracleKeys, burnEvent.args.submissionId),
              packSubmissionAutoParamsFrom(
                executionFee,
                flags,
                fallbackAddress,
                autoData,
                bscAccount.address)),
          "ExternalCallFailed()"
        )
      });
    });


    context("Test SEND_HASHED_DATA flag", () => {
      let receiverContract;

      before(async function() {
        const receiverContractFactory = await ethers.getContractFactory("MockProxyReceiver");
        receiverContract = await receiverContractFactory.deploy();
      })

      it("should fail if SEND_HASHED_DATA and wrong data hash length", async function() {
        // external call with this data fails
        const autoData = receiverContract.interface.encodeFunctionData(
          "setUint256AndPullToken", [this.wethETH.address, amount, 1]);

        const flags = 2 ** SEND_HASHED_DATA;

        // call autoburn on BSC
        await expectRevert(this.debridgeBSC
          .connect(bscAccount)
          .send(
            deETHToken.address,
            sentEvent.args.amount,
            ethChainId,
            receiverContract.address,
            [],
            false,
            referralCode,
            packSubmissionAutoParamsTo(
              executionFee,
              flags,
              fallbackAddress,
              autoData),
            {
              // pay fee in native token
              value: toWei('1000'),
            }
          ),
          "WrongAutoArgument()"
        );
      });

      it("should send hashed data, and claim with full data with SEND_HASHED_DATA flag", async function() {
        const receiverAmount = toBN(toWei("10"));
        const autoData = receiverContract.interface.encodeFunctionData(
          "pullTokenAndSetNativeSender", [this.wethETH.address, receiverAmount, 1]);

        const autoDataHash = ethers.utils.solidityKeccak256(['bytes'], [autoData]);
        // console.log('autoData', autoData);
        // console.log('autoDataHash', autoDataHash);
        const flags = 2 ** PROXY_WITH_SENDER + 2 ** SEND_HASHED_DATA;

        // call autoburn on BSC
        const burnTx = await this.debridgeBSC
          .connect(bscAccount)
          .send(
            deETHToken.address,
            sentEvent.args.amount,
            ethChainId,
            receiverContract.address,
            [],
            false,
            referralCode,
            packSubmissionAutoParamsTo(
              executionFee,
              flags,
              fallbackAddress,
              autoDataHash),
            {
              // pay fee in native token
              value: toWei('1000'),
            }
          );

        // console.log('burnTx', burnTx);
        const balanceDeETHAfterBurn = toBN(await deETHToken.balanceOf(bscAccount.address));
        assert.equal(balanceDeETHAfterBurn.toString(), balanceDeETHBeforeMint.toString());

        const receiverBalanceBefore = toBN(await web3.eth.getBalance(receiverContract.address));
        const receiverBalanceWETHBefore = toBN(await this.wethETH.balanceOf(receiverContract.address));
        const fallbackBalanceWETHBefore = toBN(await this.wethETH.balanceOf(fallbackAddress));
        const workerBalanceWETHBefore = toBN(await this.wethETH.balanceOf(workerAccount.address));

        // get Burnt event
        const burnReceipt = await burnTx.wait();
        const burnEvent = burnReceipt.events.find(i => i.event == "Sent");
        // console.log(burnEvent)

        await testSubmissionFees(
          feesCalculatorBSC,
          burnEvent,
          deETHToken.address,
          sentEvent.args.amount,
          ethChainId,
          bscAccount.address,
          false,
          executionFee,
        )

        // worker call claim on ETH to get native tokens back
        await expect(
          this.debridgeETH
            .connect(workerAccount)
            .claim(
              burnEvent.args.debridgeId,
              burnEvent.args.amount,
              bscChainId,
              receiverContract.address,
              burnEvent.args.nonce,
              await submissionSignatures(bscWeb3, oracleKeys, burnEvent.args.submissionId),
              packSubmissionAutoParamsFrom(
                executionFee,
                flags,
                fallbackAddress,
                autoData,
                bscAccount.address))
        )
          .to.emit(this.debridgeETH, "AutoRequestExecuted")
          .withArgs(burnEvent.args.submissionId, true, this.callProxy.address);

        // weth balance of receiver should change
        const receiverBalanceWETHAfter = toBN(await this.wethETH.balanceOf(receiverContract.address));
        assert.equal(receiverBalanceWETHAfter.toString(), receiverBalanceWETHBefore.add(receiverAmount).toString());

        // fallback weth balance should increase
        const fallbackBalanceWETHAfter = toBN(await this.wethETH.balanceOf(fallbackAddress));
        assert.equal(fallbackBalanceWETHAfter.toString(), fallbackBalanceWETHBefore.add(burnEvent.args.amount).sub(receiverAmount).toString());

        // eth balance of receiver shouldn't change
        const receiverBalanceAfter = toBN(await web3.eth.getBalance(receiverContract.address));
        assert.equal(receiverBalanceBefore.toString(), receiverBalanceAfter.toString());

        // worker should receive executionFee in weth
        const workerBalanceWETHAfter = toBN(await this.wethETH.balanceOf(workerAccount.address));
        assert.equal(workerBalanceWETHAfter.toString(), workerBalanceWETHBefore.add(executionFee).toString());
      });

      it("Fallback address can claim without knowledge about data", async function() {
        const receiverAmount = toBN(toWei("10"));

        const autoData = receiverContract.interface.encodeFunctionData(
          "pullTokenAndSetNativeSender", [this.wethETH.address, receiverAmount, 1]);

        const autoDataHash = ethers.utils.solidityKeccak256(['bytes'], [autoData]);

        const flags = 2 ** PROXY_WITH_SENDER + 2 ** SEND_HASHED_DATA;
        const _fallbackAddress = workerAccount.address;

        // call autoburn on BSC
        const burnTx = await this.debridgeBSC
          .connect(bscAccount)
          .send(
            deETHToken.address,
            sentEvent.args.amount,
            ethChainId,
            receiverContract.address,
            [],
            false,
            referralCode,
            packSubmissionAutoParamsTo(
              executionFee,
              flags,
              _fallbackAddress,
              autoDataHash),
            {
              // pay fee in native token
              value: toWei('1000'),
            }
          );

        // console.log('burnTx', burnTx);
        const balanceDeETHAfterBurn = toBN(await deETHToken.balanceOf(bscAccount.address));
        assert.equal(balanceDeETHAfterBurn.toString(), balanceDeETHBeforeMint.toString());

        const receiverBalanceBefore = toBN(await web3.eth.getBalance(receiverContract.address));
        const receiverBalanceWETHBefore = toBN(await this.wethETH.balanceOf(receiverContract.address));
        const fallbackBalanceWETHBefore = toBN(await this.wethETH.balanceOf(_fallbackAddress));
        const workerBalanceWETHBefore = toBN(await this.wethETH.balanceOf(workerAccount.address));

        // get Burnt event
        const burnReceipt = await burnTx.wait();
        const burnEvent = burnReceipt.events.find(i => i.event == "Sent");
        // console.log(burnEvent)

        await testSubmissionFees(
          feesCalculatorBSC,
          burnEvent,
          deETHToken.address,
          sentEvent.args.amount,
          ethChainId,
          bscAccount.address,
          false,
          executionFee,
        )

        // In this test worker is a Fallback address claim without knowledge about data, passed only the hash of data.
        // Fallback address need to receive all tokens
        await expect(
          this.debridgeETH
            .connect(workerAccount)
            .claim(
              burnEvent.args.debridgeId,
              burnEvent.args.amount,
              bscChainId,
              receiverContract.address,
              burnEvent.args.nonce,
              await submissionSignatures(bscWeb3, oracleKeys, burnEvent.args.submissionId),
              packSubmissionAutoParamsFrom(
                executionFee,
                flags,
                _fallbackAddress,
                autoDataHash,
                bscAccount.address))
        )
          .to.emit(this.debridgeETH, "AutoRequestExecuted")
          //External call return result = true even if there is no such method in the contract
          .withArgs(burnEvent.args.submissionId, true, this.callProxy.address);

        // weth balance of receiver should the same
        const receiverBalanceWETHAfter = toBN(await this.wethETH.balanceOf(receiverContract.address));
        assert.equal(receiverBalanceWETHAfter.toString(), receiverBalanceWETHBefore.toString());

        // fallback weth balance should increase by amount + executionFee
        const fallbackBalanceWETHAfter = toBN(await this.wethETH.balanceOf(_fallbackAddress));
        assert.equal(fallbackBalanceWETHAfter.toString(), fallbackBalanceWETHBefore.add(burnEvent.args.amount).add(executionFee).toString());

        // eth balance of receiver shouldn't change
        const receiverBalanceAfter = toBN(await web3.eth.getBalance(receiverContract.address));
        assert.equal(receiverBalanceBefore.toString(), receiverBalanceAfter.toString());
      });
    });
  });

  context("Collect fee management", () => {
    before(async function () {
      const debridgeInfoDeETH = await this.debridgeBSC.getDebridge(this.debridgeWethId);
      const debridgeInfoDeLink = await this.debridgeBSC.getDebridge(this.linkDebridgeId);
      //BSC network: create pair deETH/BNB
      await this.uniswapFactoryBSC
        .connect(aliceAccount)
        .createPair(debridgeInfoDeETH.tokenAddress, this.wethBSC.address);

      //BSC network: create pair deLINK/BNB
      await this.uniswapFactoryBSC
        .connect(aliceAccount)
        .createPair(debridgeInfoDeLink.tokenAddress, this.wethBSC.address);

      const debridgeInfoLink = await this.debridgeETH.getDebridge(this.linkDebridgeId);
      //ETH network: create pari LINK/ETH

      // console.log("feeProxyETH.address " + await this.feeProxyETH.address);
      // console.log("feeProxyETH.uniswapFactory " + await this.feeProxyETH.uniswapFactory());
      // console.log("this.uniswapFactoryETH " + this.uniswapFactoryETH.address);
      // console.log("feeProxyETH.weth " + await this.feeProxyETH.weth());
      // console.log("this.wethETH.address " + this.wethETH.address);
      // console.log("debridgeInfoLink.tokenAddress " + debridgeInfoLink.tokenAddress);
      // console.log("this.linkDebridgeId " + this.linkDebridgeId);

      await this.uniswapFactoryETH
        .connect(aliceAccount)
        .createPair(debridgeInfoLink.tokenAddress, this.wethETH.address);

      const BSCPoolAddres_DeETH_BNB = await this.uniswapFactoryBSC.getPair(
        debridgeInfoDeETH.tokenAddress,
        this.wethBSC.address
      );
      const BSCPoolAddres_DeLINK_BNB = await this.uniswapFactoryBSC.getPair(
        debridgeInfoDeLink.tokenAddress,
        this.wethBSC.address
      );

      const ETHPoolAddres_LINK_ETH = await this.uniswapFactoryETH.getPair(
        debridgeInfoLink.tokenAddress,
        this.wethETH.address
      );

      // console.log("ETHPoolAddres_LINK_ETH "+ ETHPoolAddres_LINK_ETH);

      const BSCPool_DeETH_BNB = await IUniswapV2Pair.at(BSCPoolAddres_DeETH_BNB);
      const BSCPool_DeLINK_BNB = await IUniswapV2Pair.at(BSCPoolAddres_DeLINK_BNB);
      const ETHPool_LINK_ETH = await IUniswapV2Pair.at(ETHPoolAddres_LINK_ETH);

      this.deLinkToken = await DeBridgeToken.at(debridgeInfoDeLink.tokenAddress);
      this.deETHToken = await DeBridgeToken.at(debridgeInfoDeETH.tokenAddress);

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

      const WORKER_ROLE = await this.feeProxyETH.WORKER_ROLE();
      await this.feeProxyETH.grantRole(WORKER_ROLE, worker);
      await this.feeProxyBSC.grantRole(WORKER_ROLE, worker);
      await this.feeProxyHECO.grantRole(WORKER_ROLE, worker);

      await this.feeProxyETH.grantRole(WORKER_ROLE, worker);
      await this.feeProxyBSC.grantRole(WORKER_ROLE, worker);
      await this.feeProxyHECO.grantRole(WORKER_ROLE, worker);
    });

    it("FeeProxy should set FeeProxyAddress it is called by the admin", async function () {
      assert.equal("0x", await this.feeProxyETH.feeProxyAddresses(bscChainId));
      assert.equal("0x", await this.feeProxyBSC.feeProxyAddresses(ethChainId));

      await this.feeProxyETH.setFeeProxyAddress(bscChainId, this.feeProxyBSC.address.toString());
      await this.feeProxyETH.setFeeProxyAddress(ethChainId, this.feeProxyETH.address.toString());
      await this.feeProxyETH.setTreasury(ethChainId, treasury);
      await this.feeProxyETH.setTreasury(bscChainId, treasury);
      await this.feeProxyETH.setTreasury(hecoChainId, treasury);
      assert.equal(
        this.feeProxyBSC.address.toLowerCase(),
        await this.feeProxyETH.feeProxyAddresses(bscChainId)
      );
      assert.equal(treasury.toLowerCase(), await this.feeProxyETH.treasuryAddresses(ethChainId));
      assert.equal(treasury.toLowerCase(), await this.feeProxyETH.treasuryAddresses(bscChainId));
      assert.equal(treasury.toLowerCase(), await this.feeProxyETH.treasuryAddresses(hecoChainId));

      await this.feeProxyBSC.setFeeProxyAddress(ethChainId, this.feeProxyETH.address.toString());
      await this.feeProxyBSC.setTreasury(ethChainId, treasury);
      await this.feeProxyBSC.setTreasury(bscChainId, treasury);
      await this.feeProxyBSC.setTreasury(hecoChainId, treasury);
      assert.equal(
        this.feeProxyETH.address.toLowerCase(),
        await this.feeProxyBSC.feeProxyAddresses(ethChainId)
      );

      await this.feeProxyHECO.setFeeProxyAddress(bscChainId, this.feeProxyBSC.address.toString());
      assert.equal(
        this.feeProxyBSC.address.toLowerCase(),
        await this.feeProxyHECO.feeProxyAddresses(bscChainId)
      );
      await this.feeProxyHECO.setFeeProxyAddress(ethChainId, this.feeProxyETH.address.toString());
      await this.feeProxyHECO.setTreasury(ethChainId, treasury);
      await this.feeProxyHECO.setTreasury(bscChainId, treasury);
      await this.feeProxyHECO.setTreasury(hecoChainId, treasury);
      assert.equal(
        this.feeProxyETH.address.toLowerCase(),
        await this.feeProxyHECO.feeProxyAddresses(ethChainId)
      );
    });

    // it("should withdraw fee of native token if it is called by the worker", async function() {
    //   const debridgeInfo = await this.debridgeETH.getDebridge(this.nativeDebridgeId);
    //   const balance = toBN(await web3.eth.getBalance(this.debridgeETH.address));
    //   const balanceTreasury = toBN(await web3.eth.getBalance(treasury));
    //   //TODO: set chainIdTo;
    //   let chainIdTo = chainId;
    //   const supportedChainInfo = await this.debridgeETH.getChainToConfig(chainIdTo);
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

    it("should withdraw fee of ERC20 token (BSC network, deLink) if it is called by the worker", async function () {
      await this.debridgeBSC.updateFeeDiscount(this.feeProxyBSC.address, 10000, 10000);
      const debridgeInfo = await this.debridgeBSC.getDebridge(this.linkDebridgeId);
      const debridgeFeeInfo = await this.debridgeBSC.getDebridgeFeeInfo(this.linkDebridgeId);
      const balance = toBN(await this.deLinkToken.balanceOf(this.debridgeBSC.address));

      const supportedChainInfo = await this.debridgeBSC.getChainToConfig(ethChainId);
      const fixedFee = supportedChainInfo.fixedNativeFee;

      let sendTx = await this.feeProxyBSC
        .connect(workerAccount)
        .withdrawFee(debridgeInfo.tokenAddress, {
          value: fixedFee,
        });

      let receipt = await sendTx.wait();
      //Don't working because events from second contract
      //https://ethereum.stackexchange.com/questions/48335/transaction-receipt-contains-all-log-entries-but-only-the-last-two-are-decoded/48389#48389
      // this.burnEventDeLink = receipt.events.find((x) => {
      //   return x.event == "Burnt"; //"AutoBurnt";
      // });

      this.burnEventDeLink = (
        await this.debridgeBSC.queryFilter(this.debridgeBSC.filters.Sent(), receipt.blockNumber)
      )[0];

      const newBalance = toBN(await this.deLinkToken.balanceOf(this.debridgeBSC.address));
      const diffBalance = balance.sub(newBalance);
      const newDebridgeFeeInfo = await this.debridgeBSC.getDebridgeFeeInfo(this.linkDebridgeId);
      // console.log("diffBalance.toString() ",diffBalance.toString());
      // console.log("debridgeFeeInfo.collectedFees ",debridgeFeeInfo.collectedFees.toString());
      // console.log("debridgeFeeInfo.withdrawnFees ",debridgeFeeInfo.withdrawnFees.toString());
      // console.log("newDebridgeFeeInfo.collectedFees ",newDebridgeFeeInfo.collectedFees.toString());
      // console.log("newDebridgeFeeInfo.withdrawnFees ",newDebridgeFeeInfo.withdrawnFees.toString());
      assert.equal(diffBalance.toString(), debridgeFeeInfo.collectedFees.toString());
      assert.equal(0, debridgeFeeInfo.withdrawnFees.toString());
      assert.equal(
        0,
        newDebridgeFeeInfo.collectedFees.sub(newDebridgeFeeInfo.withdrawnFees).toString()
      );
      assert.equal(diffBalance.toString(), newDebridgeFeeInfo.withdrawnFees.toString());
      assert.equal(0, newBalance.toString());
    });

    it("should auto claim fee transaction (burn event deLink from BSC to ETH)", async function () {
      let signatures = await submissionSignatures(bscWeb3, oracleKeys, this.burnEventDeLink.args.submissionId);

      let currentBurnEvent = this.burnEventDeLink;
      let chainFrom = bscChainId;

      const balance = toBN(await this.linkToken.balanceOf(this.feeProxyETH.address));
      //   function claim(
      //     bytes32 _debridgeId,
      //     uint256 _chainIdFrom,
      //     address _receiver,
      //     uint256 _amount,
      //     uint256 _nonce,
      //     bytes memory _signatures
      // )

      let sendTx = await this.debridgeETH.claim(
        currentBurnEvent.args.debridgeId,
        currentBurnEvent.args.amount,
        chainFrom,
        currentBurnEvent.args.receiver,
        currentBurnEvent.args.nonce,
        signatures,
        [],
        // currentBurnEvent.args.fallbackAddress,
        // currentBurnEvent.args.claimFee,
        // currentBurnEvent.args.data,
        // currentBurnEvent.args.reservedFlag,
        // currentBurnEvent.args.nativeSender,
        {
          from: alice,
        }
      );

      let receipt = await sendTx.wait();
      const balanceAfter = toBN(await this.linkToken.balanceOf(this.feeProxyETH.address));
      expect(currentBurnEvent.args.amount.toNumber() > 0).ok;
      assert.equal(currentBurnEvent.args.amount.toString(), balanceAfter.sub(balance).toString());
    });

    it("should withdraw fee of ERC20 token (HECO network, deCake) if it is called by the worker", async function () {
      await this.debridgeHECO.updateFeeDiscount(this.feeProxyHECO.address, 10000, 10000);
      const debridgeInfo = await this.debridgeHECO.getDebridge(this.cakeDebridgeId);
      const debridgeFeeInfo = await this.debridgeHECO.getDebridgeFeeInfo(this.cakeDebridgeId);

      const supportedChainInfo = await this.debridgeHECO.getChainToConfig(ethChainId);
      const fixedFee = supportedChainInfo.fixedNativeFee;
      // console.log(`fixedFee: ${fixedFee.toString()}`);
      // console.log(`debridgeInfo.collectedFees: ${debridgeInfo.collectedFees.toString()}`);

      let sendTx = await this.feeProxyHECO
        .connect(workerAccount)
        .withdrawFee(debridgeInfo.tokenAddress, {
          value: fixedFee,
        });

      let receipt = await sendTx.wait();
      //Don't working because events from second contract
      //https://ethereum.stackexchange.com/questions/48335/transaction-receipt-contains-all-log-entries-but-only-the-last-two-are-decoded/48389#48389

      // this.burnEventDeCake = receipt.events.find((x) => {
      //   return x.event == "Burnt"; //"AutoBurnt";
      // });
      this.burnEventDeCake = (
        await this.debridgeHECO.queryFilter(this.debridgeHECO.filters.Sent(), receipt.blockNumber)
      )[0];

      // console.log(this.burnEventDeCake);
      const newDebridgeFeeInfo = await this.debridgeHECO.getDebridgeFeeInfo(this.cakeDebridgeId);
      // console.log("diffBalance.toString() ",diffBalance.toString());
      // console.log("debridgeInfo.collectedFees ",debridgeInfo.collectedFees.toString());
      // console.log("debridgeInfo.withdrawnFees ",debridgeInfo.withdrawnFees.toString());
      // console.log("newDebridgeInfo.collectedFees ",newDebridgeInfo.collectedFees.toString());
      // console.log("newDebridgeInfo.withdrawnFees ",newDebridgeInfo.withdrawnFees.toString());

      assert.equal(0, debridgeFeeInfo.withdrawnFees.toString());
      assert.equal(
        0,
        newDebridgeFeeInfo.collectedFees.sub(newDebridgeFeeInfo.withdrawnFees).toString()
      );
    });

    it("should auto claim fee transaction (burn event deCake from HECO to BSC)", async function () {
      let signatures = await submissionSignatures(bscWeb3, oracleKeys, this.burnEventDeCake.args.submissionId);

      let currentBurnEvent = this.burnEventDeCake;
      let debridgeId = currentBurnEvent.args.debridgeId;
      let chainFrom = hecoChainId;

      const debridgeFeeInfo = await this.debridgeBSC.getDebridgeFeeInfo(debridgeId);
      const balance = toBN(await this.cakeToken.balanceOf(this.feeProxyBSC.address));

      let sendTx = await this.debridgeBSC.claim(
        debridgeId,
        currentBurnEvent.args.amount,
        chainFrom,
        currentBurnEvent.args.receiver,
        currentBurnEvent.args.nonce,
        signatures,
        [],
        // currentBurnEvent.args.fallbackAddress,
        // currentBurnEvent.args.claimFee,
        // currentBurnEvent.args.data,
        // currentBurnEvent.args.reservedFlag,
        // currentBurnEvent.args.nativeSender,
        {
          from: alice,
        }
      );

      let receipt = await sendTx.wait();

      let ReceivedTransferFee = receipt.events.find((x) => {
        return x.event == "ReceivedTransferFee";
      });
      // console.log(receipt.events);
      // console.log(ReceivedTransferFee);
      // console.log("amount " + ReceivedTransferFee.args.amount.toString());

      const newDebridgeFeeInfo = await this.debridgeBSC.getDebridgeFeeInfo(debridgeId);
      const newBalance = toBN(await this.cakeToken.balanceOf(this.feeProxyBSC.address));

      // console.log("cakeToken "+ this.cakeToken.address);
      // console.log("this.debridgeBSC "+ this.debridgeBSC.address);
      // console.log("balance"+balance.toString());
      // console.log("+amount "+ currentBurnEvent.args.amount.toString());
      // console.log("newBalance.toString() "+newBalance.toString());

      // console.log("Proxy balance  "+(await this.cakeToken.balanceOf(this.callProxy.address)).toString());
      // console.log("Proxy fee balance  "+(await this.cakeToken.balanceOf(this.feeProxyBSC.address)).toString());

      //Balnce cake on debridgeGate will be the same, Cake only transfered to CallProxy and back to collected fee
      assert.equal(currentBurnEvent.args.amount.toString(), newBalance.sub(balance).toString());

      assert.equal(
        debridgeFeeInfo.collectedFees.toString(),
        newDebridgeFeeInfo.collectedFees.toString()
      );

      assert.equal(
        debridgeFeeInfo.withdrawnFees.toString(),
        newDebridgeFeeInfo.withdrawnFees.toString()
      );
    });

    it("should withdraw fee of ERC20 token (ETH network, Link) if it is called by the worker", async function () {
      await this.debridgeETH.updateFeeDiscount(this.feeProxyETH.address, 10000, 10000);
      const debridgeInfo = await this.debridgeETH.getDebridge(this.linkDebridgeId);
      const debridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(this.linkDebridgeId);
      const balance = toBN(await this.linkToken.balanceOf(this.debridgeETH.address));

      const supportedChainInfo = await this.debridgeETH.getChainToConfig(ethChainId);
      const fixedFee = supportedChainInfo.fixedNativeFee;

      const balanceETHTreasury = toBN(await this.wethETH.balanceOf(treasury));

      let sendTx = await this.feeProxyETH
        .connect(workerAccount)
        .withdrawFee(debridgeInfo.tokenAddress, {
          value: fixedFee,
        });

      let receipt = await sendTx.wait();
      this.burnEventDeLink = receipt.events.find((x) => {
        return x.event == "Burnt"; //"AutoBurnt";
      });

      const newBalanceETHTreasury = toBN(await this.wethETH.balanceOf(treasury));
      // console.log("balanceETHTreasury "+balanceETHTreasury.toString());
      // console.log("newBalanceETHTreasury "+newBalanceETHTreasury.toString());
      const newBalance = toBN(await this.linkToken.balanceOf(this.debridgeETH.address));
      const diffBalance = balance.sub(newBalance);
      const newDebridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(this.linkDebridgeId);

      assert.ok(newBalanceETHTreasury.gt(balanceETHTreasury));
      // assert.equal(diffBalance.toString(), debridgeInfo.withdrawnFees.toString());
      assert.equal(0, debridgeFeeInfo.withdrawnFees.toString());
      // assert.equal(0, newDebridgeInfo.collectedFees.sub(newDebridgeInfo.withdrawnFees).toString());
      assert.equal(diffBalance.toString(), newDebridgeFeeInfo.withdrawnFees.toString());
      // assert.equal(0, newBalance.toString());
    });

    it("should reject withdrawing fee by non-worker", async function () {
      await expectRevert(
        this.feeProxyBSC
          .connect(bobAccount)
          .withdrawFee("0x5A0b54D5dc17e0AadC383d2db43B0a0D3E029c4c"),
        "WorkerBadRole()"
      );

      await expectRevert(
        this.feeProxyBSC.connect(bobAccount).withdrawNativeFee(),
        "WorkerBadRole()"
      );

      await expectRevert(
        this.debridgeBSC.connect(bobAccount).withdrawFee(this.linkDebridgeId),
        "FeeProxyBadRole()"
      );
    });

    // it("should reject withdrawing fees if the token not from current chain", async function () {
    //   const fakeDebridgeId = await this.debridgeBSC.getDebridgeId(
    //     999,
    //     "0x5A0b54D5dc17e0AadC383d2db43B0a0D3E029c4c"
    //   );
    //   await expectRevert(
    //     this.feeProxyBSC.connect(workerAccount).withdrawFee("0x5A0b54D5dc17e0AadC383d2db43B0a0D3E029c4c"),
    //     "DebridgeNotFound()"
    //   );
    // });
  });

  context("Test flashloans", function () {
    let flash;
    let flashFactory;
    before(async function () {
      flashFactory = await ethers.getContractFactory("MockFlashCallback", alice);
    });
    beforeEach(async function () {
      flash = await flashFactory.deploy();
      const amount = toBN(toWei("1000"));
      await this.cakeToken.mint(alice, amount);

      //flashFeeBps 0.1%
      await this.cakeToken.mint(flash.address, toBN(toWei("10")));
      const chainIdTo = bscChainId;
      const supportedChainInfo = await this.debridgeETH.getChainToConfig(chainIdTo);

      await this.cakeToken.approve(this.debridgeETH.address, amount, {
        from: alice,
      });
      //We need to create debridge
      await this.debridgeETH.send(
        this.cakeToken.address,
        amount,
        chainIdTo,
        alice,
        [],
        false,
        0,
        [],
        {
          value: supportedChainInfo.fixedNativeFee,
          from: alice,
        }
      );
    });

    it("flash increases balances and counters of received funds", async function () {
      const amount = toBN(1000);
      await this.debridgeETH.updateFlashFee(10); //set 0.1%
      const flashFeeBps = await this.debridgeETH.flashFeeBps();
      const fee = amount.mul(flashFeeBps).div(BPS);
      const chainId = await this.debridgeETH.getChainId();
      const debridgeId = await this.debridgeETH.getDebridgeId(chainId, this.cakeToken.address);
      const debridge = await this.debridgeETH.getDebridge(debridgeId);
      const debridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(debridgeId);
      const paidBefore = debridgeFeeInfo.collectedFees;
      const balanceReceiverBefore = await this.cakeToken.balanceOf(alice);

      await flash.flash(
        this.debridgeETH.address,
        this.cakeToken.address,
        alice,
        amount,
        false
      );

      const newDebridge = await this.debridgeETH.getDebridge(debridgeId);
      const newDebridgeFeeInfo = await this.debridgeETH.getDebridgeFeeInfo(debridgeId);
      const paidAfter = newDebridgeFeeInfo.collectedFees;
      const balanceReceiverAfter = await this.cakeToken.balanceOf(alice);

      expect("10").to.equal(flashFeeBps.toString());
      expect(toBN(paidBefore).add(fee)).to.equal(toBN(newDebridgeFeeInfo.collectedFees));
      expect(toBN(balanceReceiverBefore).add(amount)).to.equal(toBN(balanceReceiverAfter));
    });

    it("flash reverts if not profitable", async function () {
      await expect(
        flash.flash(this.debridgeETH.address, this.cakeToken.address, alice, 1000, true)
      ).to.be.revertedWith("FlashFeeNotPaid()");
    });
  });

  context("Test calculating ids", () => {
    it("should has same debridgeId", async function() {
      const chainId = 100;
      const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      const debridgeId = await this.debridgeETH.getDebridgeId(chainId, tokenAddress);

      const debridgeIdETH = await this.debridgeETH.getDebridgeId(chainId, tokenAddress);
      const debridgeIdBSC = await this.debridgeBSC.getDebridgeId(chainId, tokenAddress);

      assert.equal(debridgeId, debridgeIdETH);
      assert.equal(debridgeIdETH, debridgeIdBSC);

      const calculatedDebridgeId = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [chainId, tokenAddress]);
      assert.equal(debridgeId, calculatedDebridgeId);
    })

    it("should has same deployId", async function() {
      const debridgeId = "0x8ee3dbcdef0876763610fbdbed3ff2f4c14425bc81d10df7378e47a83e42b253";
      const name = "TEST_TOKEN";
      const symbol = "TEST";
      const decimals = 18;
      const deployIdETH = await this.debridgeETH.getDeployId(debridgeId, name, symbol, decimals);
      const deployIdBSC = await this.debridgeBSC.getDeployId(debridgeId, name, symbol, decimals);
      const DEPLOY_PREFIX = await this.debridgeETH.DEPLOY_PREFIX();
      assert.equal(deployIdETH, deployIdBSC);

      const calculatedDeployId = ethers.utils.solidityKeccak256(
        ['uint256', 'bytes32', 'string', 'string', 'uint8'],
        [DEPLOY_PREFIX, debridgeId, name, symbol, decimals]);
      assert.equal(deployIdETH, calculatedDeployId);
    });
  });

  async function testSubmissionFees(
    feesCalculator,
    sentEvent,
    tokenAddress,
    amount,
    chainIdTo,
    sender,
    useAssetFee,
    executionFee
  ) {
    const feeInfo = await feesCalculator.getTransferFees(
      tokenAddress,
      amount,
      chainIdTo,
      sender,
      useAssetFee,
      executionFee,
    )
    assert.equal(
      sentEvent.args.amount.toString(),
      feeInfo.amountAfterFee.toString()
    );
    assert.equal(
      sentEvent.args.feeParams.fixFee.toString(),
      feeInfo.fixFee.toString()
    );
    assert.equal(
      sentEvent.args.feeParams.transferFee.toString(),
      feeInfo.transferFee.toString()
    );
    assert.equal(
      sentEvent.args.feeParams.useAssetFee,
      feeInfo.useAssetFee
    );
  }
});
