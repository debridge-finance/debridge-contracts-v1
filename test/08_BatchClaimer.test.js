const Web3 = require("web3");
const { expectRevert } = require("@openzeppelin/test-helpers");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const MockLinkToken = artifacts.require("MockLinkToken");
const MockToken = artifacts.require("MockToken");
const DeBridgeToken = artifacts.require("DeBridgeToken");
const { toWei } = web3.utils;
const { BigNumber } = require("ethers");
const MAX = web3.utils.toTwosComplement(-1);
const Tx = require("ethereumjs-tx");
const bscWeb3 = new Web3(process.env.TEST_BSC_PROVIDER);
const oracleKeys = JSON.parse(process.env.TEST_ORACLE_KEYS);
const bobPrivKey = "0x79b2a2a43a1e9f325920f99a720605c9c563c61fb5ae3ebe483f83f1230512d3";

function toBN(number) {
  return BigNumber.from(number.toString());
}

const ZERO_ADDRESS = ethers.constants.AddressZero;
const transferFeeBps = 50;
const minReservesBps = 3000;
const BPS = toBN(10000);

const referralCode = 555;

contract("DeBridgeGate light mode with batch claimer", function () {
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

    const Debridge = await ethers.getContractFactory("MockDeBridgeGate", alice);
    const ClaimerFactory = await ethers.getContractFactory("Claimer", alice);
    const SignatureVerifier = await ethers.getContractFactory("SignatureVerifier", alice);
    const DefiControllerFactory = await ethers.getContractFactory("DefiController", alice);
    const CallProxyFactory = await ethers.getContractFactory("CallProxy", alice);
    const WETH9 = await deployments.getArtifact("WETH9");
    const WETH9Factory = await ethers.getContractFactory(WETH9.abi, WETH9.bytecode, alice);
    this.mockToken = await MockToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.linkToken = await MockLinkToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.dbrToken = await MockLinkToken.new("DBR", "DBR", 18, {
      from: alice,
    });
    this.amountThreshold = toWei("1000");

    this.minConfirmations = Math.floor(oracleKeys.length / 2) + 2;
    this.confirmationThreshold = 5; //Confirmations per block before extra check enabled.
    this.excessConfirmations = 7; //Confirmations count in case of excess activity.

    console.log("minConfirmations: " + this.minConfirmations);
    console.log("confirmationThreshold: " + this.confirmationThreshold);
    console.log("excessConfirmations: " + this.excessConfirmations);

    //   function initialize(
    //     uint256 _minConfirmations,
    //     uint256 _confirmationThreshold,
    //     uint256 _excessConfirmations,
    //     address _debridgeAddress
    // )
    this.signatureVerifier = await upgrades.deployProxy(SignatureVerifier, [
      this.minConfirmations,
      this.confirmationThreshold,
      this.excessConfirmations,
      ZERO_ADDRESS,
    ]);
    await this.signatureVerifier.deployed();

    this.initialOracles = [];
    const maxOraclesCount = Math.min(this.signers.length, 10);
    for (let i = 1; i <= maxOraclesCount; i++) {
      this.initialOracles.push({
        account: this.signers[i],
        address: this.signers[i].address,
      });
    }
    console.log("initialOracles.length: " + this.initialOracles.length);

    await this.signatureVerifier.addOracles(
      this.initialOracles.map(o => o.address),
      this.initialOracles.map(o => false),
      {
        from: alice,
      });

    // Alice is required oracle
    await this.signatureVerifier.addOracles([alice], [true], {
      from: alice,
    });

    this.defiController = await upgrades.deployProxy(DefiControllerFactory, []);
    this.callProxy = await upgrades.deployProxy(CallProxyFactory, []);
    const maxAmount = toWei("100000000000");
    const fixedNativeFee = toWei("0.00001");
    const isSupported = true;
    const supportedChainIds = [42, 56];
    this.weth = await WETH9Factory.deploy();

    //   function initialize(
    //     uint256 _excessConfirmations,
    //     address _signatureVerifier,
    //     address _callProxy,
    //     IWETH _weth,
    //     IFeeProxy _feeProxy,
    //     IDefiController _defiController,
    // )

    const DeBridgeTokenFactory = await ethers.getContractFactory("DeBridgeToken", alice);
    const deBridgeToken = await DeBridgeTokenFactory.deploy();
    const DeBridgeTokenDeployerFactory = await ethers.getContractFactory("DeBridgeTokenDeployer", alice);
    const deBridgeTokenDeployer = await upgrades.deployProxy(
      DeBridgeTokenDeployerFactory,
      [
        deBridgeToken.address,
        alice,
        ZERO_ADDRESS,
      ]);

    this.debridge = await upgrades.deployProxy(
      Debridge,
      [
        this.excessConfirmations,
        this.signatureVerifier.address.toString(),
        this.callProxy.address.toString(),
        this.weth.address,
        ZERO_ADDRESS,
        deBridgeTokenDeployer.address,
        ZERO_ADDRESS,
        1, //overrideChainId
      ],
      {
        initializer: "initializeMock",
        kind: "transparent",
      }
    );

    await this.debridge.deployed();

    this.claimer = await upgrades.deployProxy(
      ClaimerFactory,
      [
        this.debridge.address
      ]);

    await this.debridge.updateChainSupport(
      supportedChainIds,
      [
        {
          transferFeeBps,
          fixedNativeFee,
          isSupported,
          maxAmount: ethers.constants.MaxUint256,
        },
        {
          transferFeeBps,
          fixedNativeFee,
          isSupported,
          maxAmount: ethers.constants.MaxUint256,
        },
      ],
      false
    );

    await this.debridge.updateChainSupport(
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
      true
    );

    const GOVMONITORING_ROLE = await this.debridge.GOVMONITORING_ROLE();
    await this.debridge.grantRole(GOVMONITORING_ROLE, alice);
    await this.signatureVerifier.setDebridgeAddress(this.debridge.address.toString());
    await deBridgeTokenDeployer.setDebridgeAddress(this.debridge.address);

    this.wethDebridgeId = await this.debridge.getDebridgeId(1, this.weth.address);
    this.nativeDebridgeId = await this.debridge.getDebridgeId(1, ZERO_ADDRESS);
    await this.debridge.updateAssetFixedFees(this.wethDebridgeId, supportedChainIds, [
      fixedNativeFee,
      fixedNativeFee,
    ]);

    const DEBRIDGE_GATE_ROLE = await this.callProxy.DEBRIDGE_GATE_ROLE();
    await this.callProxy.grantRole(DEBRIDGE_GATE_ROLE, this.debridge.address);
  });

  context("Test setting configurations by different users", () => {
    it("should set Verifier if called by the admin", async function () {
      await this.debridge.setSignatureVerifier(this.signatureVerifier.address, {
        from: alice,
      });
      const newAggregator = await this.debridge.signatureVerifier();
      assert.equal(this.signatureVerifier.address, newAggregator);
    });
  });

  context("Test managing assets", () => {
    const isSupported = true;
    it("should deployNewAsset with signatures", async function () {
      const tokenAddresses = ["0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", "0xdac17f958d2ee523a2206206994597c13d831ec7", "0x6b175474e89094c44da98b954eedeac495271d0f"];

      for (let tokenAddress of tokenAddresses) {
        const chainId = 56;
        const maxAmount = toWei("100000000000");
        const amountThreshold = toWei("10000000000000");
        const name = "MUSD";
        const symbol = "Magic Dollar";
        const decimals = 18;

        //   function confirmNewAsset(
        //     address _tokenAddress,
        //     uint256 _chainId,
        //     string memory _name,
        //     string memory _symbol,
        //     uint8 _decimals,
        //     bytes[] memory _signatures
        // )
        const debridgeId = await this.signatureVerifier.getDebridgeId(chainId, tokenAddress);
        //console.log('debridgeId '+debridgeId);
        const deployId = await this.signatureVerifier.getDeployId(debridgeId, name, symbol, decimals);

        let signatures = "0x";
        for (let i = 0; i < oracleKeys.length; i++) {
          const oracleKey = oracleKeys[i];
          let currentSignature = (await bscWeb3.eth.accounts.sign(deployId, oracleKey)).signature;
          // remove first 0x
          signatures += currentSignature.substring(2, currentSignature.length);
        }
        // Deploy token
        await this.debridge.deployNewAsset(tokenAddress, chainId, name, symbol, decimals, signatures);

        ////   function getDeployId(
        ////     bytes32 _debridgeId,
        ////     string memory _name,
        ////     string memory _symbol,
        ////     uint8 _decimals
        //// )
        ////function deployAsset(bytes32 _deployId)
        //await this.signatureVerifier.deployAsset(deployId, {
        //  from: this.initialOracles[0].address,
        //});

        await this.debridge.updateAsset(debridgeId, maxAmount, minReservesBps, amountThreshold);
        const debridge = await this.debridge.getDebridge(debridgeId);
        const debridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(debridgeId);
        assert.equal(debridge.exist, true);
        assert.equal(debridge.chainId, chainId);
        assert.equal(debridge.maxAmount.toString(), maxAmount);
        assert.equal(debridgeFeeInfo.collectedFees.toString(), "0");
        assert.equal(debridge.balance.toString(), "0");
        assert.equal(debridge.minReservesBps.toString(), minReservesBps);
      }
    });
  });


  context("Test batch claim", () => {
    let debridgeId;
    let receiver;
    const amount = toBN(toWei("100"));
    const nonce = 1;
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    let currentChainId;

    before(async function () {
      receiver = bob;
      debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
      //console.log('debridgeId '+debridgeId);
      currentChainId = await this.debridge.getChainId();
      //Array of submissionIds
      this.submissionForClaim = [];
      //Array of signatures
      this.signatures = [];

      for (var i = 0; i < 10; i++) {
        var currentNonce = nonce + i;
        this.submissionForClaim.push(await this.debridge.getSubmissionId(
          debridgeId,
          chainId,
          currentChainId,
          amount,
          receiver,
          currentNonce
        ));
      }

      for (var i = 0; i < this.submissionForClaim.length; i++) {
        var signatures = "0x";
        var submission = this.submissionForClaim[i];
        for (let i = 0; i < oracleKeys.length; i++) {
          const oracleKey = oracleKeys[i];
          let currentSignature = (await bscWeb3.eth.accounts.sign(submission, oracleKey)).signature;
          // remove first 0x
          signatures += currentSignature.substring(2, currentSignature.length);
        }
        this.signatures.push(signatures);
      }
    });

    it("should batch claim when the submission is approved", async function () {
      let balance = toBN("0");
      let batchClaims = [];

      for (var i = 0; i < this.submissionForClaim.length; i++) {
        var currentNonce = nonce + i;

        //   struct ClaimInfo {
        //     bytes32 debridgeId;
        //     uint256 amount;
        //     uint256 chainIdFrom;
        //     address receiver;
        //     uint256 nonce;
        //     bytes signatures;
        //     bytes autoParams;
        // }

        var currentClaim = {
          debridgeId: debridgeId,
          amount: amount,
          chainIdFrom: chainId,
          receiver: receiver,
          nonce: currentNonce,
          signatures: this.signatures[i],
          autoParams: []};

          batchClaims.push(currentClaim);
      }

      //claim first request
      await this.claimer.batchClaim(
        [batchClaims[0]],
        {
          from: alice,
        });

      // Should not fall if the submission has already been claimed
      await this.claimer.batchClaim(
        batchClaims,
        {
          from: alice,
        });

      const isSubmissionsUsed =  await this.claimer.isSubmissionsUsed(this.submissionForClaim);
      for (var i = 0; i < this.submissionForClaim.length; i++) {
        assert.equal(isSubmissionsUsed[i], true);
      }
    });
  });
});
