const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS, permit } = require("./utils.spec");
const MockLinkToken = artifacts.require("MockLinkToken");
const MockToken = artifacts.require("MockToken");
const WrappedAsset = artifacts.require("WrappedAsset");
const FeeProxy = artifacts.require("FeeProxy");
const CallProxy = artifacts.require("CallProxy");
const IUniswapV2Pair = artifacts.require("IUniswapV2Pair");
const DefiController = artifacts.require("DefiController");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const { toWei } = web3.utils;
const { BigNumber } = require("ethers");

function toBN(number) {
  return BigNumber.from(number.toString());
}

const MAX = web3.utils.toTwosComplement(-1);
const bobPrivKey = "0x79b2a2a43a1e9f325920f99a720605c9c563c61fb5ae3ebe483f83f1230512d3";

const transferFeeBps = 50;
const minReservesBps = 3000;
const BPS = toBN(10000);

contract("DeBridgeGate full mode", function () {
  let UniswapV2;
  let WETH9;
  let DeBridgeGate;
  let ConfirmationAggregator;

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

    //this.oraclesAddressescounts = [
    //  // aliceAccount,
    //  bobAccount,
    //  carolAccount,
    //  eveAccount,
    //  feiAccount,
    //  devidAccount
    //];

    //console.log(alice,bob,carol,eve,devid)
    UniswapV2 = await deployments.getArtifact("UniswapV2Factory");
    WETH9 = await deployments.getArtifact("WETH9");
    DeBridgeGate = await ethers.getContractFactory("DeBridgeGate", alice);
    ConfirmationAggregator = await ethers.getContractFactory("ConfirmationAggregator", alice);

    UniswapV2Factory = await ethers.getContractFactory(UniswapV2.abi, UniswapV2.bytecode, alice);
    WETH9Factory = await ethers.getContractFactory(WETH9.abi, WETH9.bytecode, alice);

    this.initialOracles = [
      // {
      //   address: alice,
      //   admin: alice,
      // },
      {
        account: bobAccount,
        address: bob,
        admin: carol,
      },
      {
        account: carolAccount,
        address: carol,
        admin: eve,
      },
      {
        account: eveAccount,
        address: eve,
        admin: carol,
      },
      {
        account: feiAccount,
        address: fei,
        admin: eve,
      },
      {
        account: devidAccount,
        address: devid,
        admin: carol,
      },
    ];

    this.amountThreshols = toWei("1000");
    this.minConfirmations = 2;
    this.confirmationThreshold = 5; //Confirmations per block before extra check enabled.
    this.excessConfirmations = 7; //Confirmations count in case of excess activity.
  });
  beforeEach(async function () {
    this.mockToken = await MockToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.linkToken = await MockLinkToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.dbrToken = await MockLinkToken.new("DBR", "DBR", 18, {
      from: alice,
    });

    //   function initialize(
    //     uint256 _minConfirmations,
    //     uint256 _confirmationThreshold,
    //     uint256 _excessConfirmations,
    //     address _wrappedAssetAdmin,
    //     address _debridgeAddress
    // )
    this.confirmationAggregator = await upgrades.deployProxy(ConfirmationAggregator, [
      this.minConfirmations,
      this.confirmationThreshold,
      this.excessConfirmations,
      alice,
      ZERO_ADDRESS,
    ]);

    await this.confirmationAggregator.deployed();
    for (let oracle of this.initialOracles) {
      await this.confirmationAggregator.addOracle(oracle.address, oracle.admin, false, {
        from: alice,
      });
    }

    //Alice is required oracle
    await this.confirmationAggregator.addOracle(alice, alice, true, {
      from: alice,
    });

    this.uniswapFactory = await UniswapV2Factory.deploy(carol);
    this.feeProxy = await FeeProxy.new(this.linkToken.address, this.uniswapFactory.address, {
      from: alice,
    });
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
      devid,
    ]);
    await this.debridge.deployed();
    await this.confirmationAggregator.setDebridgeAddress(this.debridge.address.toString());
    assert.equal(this.debridge.address.toString(), await this.confirmationAggregator.debridgeAddress());
    this.nativeDebridgeId = await this.debridge.nativeDebridgeId();

    //should update excessConfirmations if called by the admin"
    let newExcessConfirmations = 9;
    await this.debridge.updateExcessConfirmations(newExcessConfirmations, {
      from: alice,
    });
    assert.equal(await this.debridge.excessConfirmations(), newExcessConfirmations);

    //Test setting configurations by different users
    const aggregator = this.confirmationAggregator.address;
    await this.debridge.setAggregator(aggregator, {
      from: alice,
    });
    const newAggregator = await this.debridge.confirmationAggregator();
    assert.equal(aggregator, newAggregator);

    const feeProxy = this.feeProxy.address;
    await this.debridge.setFeeProxy(feeProxy, {
      from: alice,
    });
    const newFeeProxy = await this.debridge.feeProxy();
    assert.equal(feeProxy, newFeeProxy);

    const defiController = this.defiController.address;
    await this.debridge.setDefiController(defiController, {
      from: alice,
    });
    const newDefiController = await this.debridge.defiController();
    assert.equal(defiController, newDefiController);

    const weth = this.weth.address;
    await this.debridge.setWeth(weth, {
      from: alice,
    });
    const newWeth = await this.debridge.weth();
    assert.equal(weth, newWeth);

    //Test managing assets
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const amountThreshold = toWei("10");
    const name = "MUSD";
    const symbol = "Magic Dollar";
    const decimals = 18;
    const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
    //   function confirmNewAsset(
    //     address _tokenAddress,
    //     uint256 _chainId,
    //     string memory _name,
    //     string memory _symbol,
    //     uint8 _decimals
    // )
    for (let oracle of this.initialOracles) {
      await this.confirmationAggregator.connect(oracle.account).confirmNewAsset(tokenAddress, chainId, name, symbol, decimals);
    }
    //   function getDeployId(
    //     bytes32 _debridgeId,
    //     string memory _name,
    //     string memory _symbol,
    //     uint8 _decimals
    // )
    // let deployId = await this.confirmationAggregator.getDeployId(debridgeId, name, symbol, decimals)
    // //function deployAsset(bytes32 _deployId)
    // await this.debridge.checkAndDeployAsset(debridgeId, {
    //   from: this.initialOracles[0].address,
    // });
    await this.debridge.updateAsset(debridgeId, maxAmount, minReservesBps, amountThreshold, {
      from: alice,
    });
    const debridge = await this.debridge.getDebridge(debridgeId);
    assert.equal(debridge.maxAmount.toString(), maxAmount);
    assert.equal(debridge.collectedFees.toString(), "0");
    assert.equal(debridge.balance.toString(), "0");
    assert.equal(debridge.minReservesBps.toString(), minReservesBps);

    assert.equal(await this.debridge.getAmountThreshold(debridgeId), amountThreshold);
  });

  describe("Test mint method", async function () {
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    let receiver;
    const amount = toBN(toWei("100"));
    const nonce = 2;
    let currentChainId;
    let submissionId;
    let debridgeId;
    beforeEach(async function () {
      receiver = bob;
      currentChainId = 1; //await this.debridge.chainId();
      const newSupply = toWei("100");
      await this.linkToken.mint(alice, newSupply, {
        from: alice,
      });
      await this.dbrToken.mint(alice, newSupply, {
        from: alice,
      });
      //await this.dbrToken.transferAndCall(
      //  this.confirmationAggregator.address.toString(),
      //  newSupply,
      //  "0x",
      //  {
      //    from: alice,
      //  }
      //);
      //await this.linkToken.transferAndCall(
      //  this.confirmationAggregator.address.toString(),
      //  newSupply,
      //  "0x",
      //  {
      //    from: alice,
      //  }
      //);
      debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);

      //   function getSubmisionId(
      //     bytes32 _debridgeId,
      //     uint256 _chainIdFrom,
      //     uint256 _chainIdTo,
      //     uint256 _amount,
      //     address _receiver,
      //     uint256 _nonce
      // )
      submissionId = await this.debridge.getSubmisionId(debridgeId, chainId, currentChainId, amount, receiver, nonce);

      for (let oracle of this.initialOracles) {
        await this.confirmationAggregator.connect(oracle.account).submit(submissionId);
      }
    });
    it("check confirmation without DSRM confirmation", async function () {
      let submissionInfo = await this.confirmationAggregator.getSubmissionInfo(submissionId);
      let submissionConfirmations = await this.confirmationAggregator.getSubmissionConfirmations(submissionId);

      assert.equal(submissionInfo.confirmations.toString(), this.initialOracles.length);
      assert.equal(submissionInfo.requiredConfirmations, 0);
      assert.equal(submissionInfo.isConfirmed, false);

      assert.equal(this.initialOracles.length, submissionConfirmations[0]);
      assert.equal(false, submissionConfirmations[1]);
    });

    it("should reject native token without DSRM confirmation", async function () {
      await expectRevert(
        this.debridge.mint(debridgeId, chainId, receiver, amount, nonce, [], {
          from: alice,
        }),
        "not confirmed"
      );
    });

    it("confirm by required oracle", async function () {
      await this.confirmationAggregator.submit(submissionId, {
        from: alice,
      });
    });
    describe('confirm by required oracle',function(){
      beforeEach(async function(){
        await this.confirmationAggregator.submit(submissionId, {
          from: alice,
        });
      })

      it("check confirmation with DSRM confirmation", async function () {
      const submissionInfo = await this.confirmationAggregator.getSubmissionInfo(submissionId);
      // struct SubmissionInfo {
      //   uint256 block; // confirmation block
      //   uint256 confirmations; // received confirmations count
      //   uint256 requiredConfirmations; // required oracles (DSRM) received confirmations count
      //   bool isConfirmed; // is confirmed submission (user can claim)
      //   mapping(address => bool) hasVerified; // verifier => has already voted
      // }
      assert.equal(submissionInfo.confirmations, this.initialOracles.length + 1);
      // console.log(`confirmations: ${submissionInfo.confirmations}`);
      assert.equal(submissionInfo.requiredConfirmations, 1);
      assert.equal(submissionInfo.isConfirmed, true);
      });

      it("should reject exceed amount", async function () {
      const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);

      // console.log("getAmountThreshold: " + (await this.debridge.getAmountThreshold(debridgeId)).toString());
      // console.log("excessConfirmations: " + (await this.debridge.excessConfirmations()).toString());
      // console.log("amount: " + amount);

      // const submission = await this.debridge.getSubmisionId(
      //   debridgeId,
      //   chainId,
      //   currentChainId,
      //   amount,
      //   receiver,
      //   nonce
      // );
      // let submissionInfo = await this.confirmationAggregator.getSubmissionInfo(submission);
      // console.log("submissionInfo.confirmations: " + submissionInfo.confirmations.toString());

      await expectRevert(
        this.debridge.mint(debridgeId, chainId, receiver, amount, nonce, [], {
          from: alice,
        }),
        "amount not confirmed"
      );
      });

      it("update reduce ExcessConfirmations if called by the admin", async function () {
      let newExcessConfirmations = 3;
      await this.debridge.updateExcessConfirmations(newExcessConfirmations, {
        from: alice,
      });
      assert.equal(await this.debridge.excessConfirmations(), newExcessConfirmations);
      });

      it("should reject when the submission is blocked", async function () {
      await this.debridge.blockSubmission([submissionId], true, {
        from: alice,
      });

      assert.equal(await this.debridge.isBlockedSubmission(submissionId), true);

      await expectRevert(
        this.debridge.mint(debridgeId, chainId, receiver, amount, nonce, [], {
          from: alice,
        }),
        "mint: blocked submission"
      );
      });

      it("should unblock the submission by admin", async function () {
      await this.debridge.blockSubmission([submissionId], false, {
        from: alice,
      });

      assert.equal(await this.debridge.isBlockedSubmission(submissionId), false);
      });

      it("should mint when the submission is approved", async function () {
      const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
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
      await this.debridge.mint(debridgeId, chainId, receiver, amount, nonce, [], {
        from: alice,
      });
      const debridge = await this.debridge.getDebridge(debridgeId);
      const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);
      const newBalance = toBN(await wrappedAsset.balanceOf(receiver));
      const submissionId = await this.debridge.getSubmisionId(debridgeId, chainId, currentChainId, amount, receiver, nonce);
      const isSubmissionUsed = await this.debridge.isSubmissionUsed(submissionId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.ok(isSubmissionUsed);
      });

      it("should reject minting with unconfirmed submission", async function () {
      const nonce = 4;
      const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
      await expectRevert(
        this.debridge.mint(debridgeId, chainId, receiver, amount, nonce, [], {
          from: alice,
        }),
        "not confirmed"
      );
      });

      it("should reject minting twice", async function () {
      const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
      await expectRevert(
        this.debridge.mint(debridgeId, chainId, receiver, amount, nonce, [], {
          from: alice,
        }),
        "mint: already used"
      );
      });
    })
  });

  for (let i = 0; i <= 2; i++) {
    let discount = 0;
    switch (i) {
      case 0:
        discount = 0;
        break;
      case 1:
        discount = 5000; //50%
        break;
      case 2:
        discount = 10000; //100%
        break;
      default:
        discount = 0;
    }
    context(`Test burn method  discount: ${(discount * 100) / BPS}%`, () => {
      it(`set discount ${(discount * 100) / BPS}% fee for customer bob`, async function () {
        await this.debridge.updateFeeDiscount(bob, discount);
        const discountFromContract = await this.debridge.feeDiscount(bob);
        assert.equal(discount, discountFromContract);
      });

      it("should burning when the amount is suficient", async function () {
        const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
        const chainIdTo = 56;
        const receiver = alice;
        const amount = toBN(toWei("1"));
        const debridgeId = await this.debridge.getDebridgeId(chainIdTo, tokenAddress);
        const debridge = await this.debridge.getDebridge(debridgeId);
        const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);
        const balance = toBN(await wrappedAsset.balanceOf(bob));
        const deadline = toBN(MAX_UINT256);
        const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);
        const signature = await permit(wrappedAsset, bob, this.debridge.address, amount, deadline, bobPrivKey);
        const nativeDebridgeInfo = await this.debridge.getDebridge(this.nativeDebridgeId);
        let fixedNativeFeeWithDiscount = supportedChainInfo.fixedNativeFee;
        fixedNativeFeeWithDiscount = toBN(fixedNativeFeeWithDiscount).sub(toBN(fixedNativeFeeWithDiscount).mul(discount).div(BPS));
        await this.debridge.connect(bobAccount).burn(debridgeId, alice, amount, chainIdTo, deadline, signature, false, {
          value: fixedNativeFeeWithDiscount,
        });
        const newNativeDebridgeInfo = await this.debridge.getDebridge(this.nativeDebridgeId);
        const newBalance = toBN(await wrappedAsset.balanceOf(bob));
        assert.equal(balance.sub(amount).toString(), newBalance.toString());
        const newDebridge = await this.debridge.getDebridge(debridgeId);
        let fees = toBN(supportedChainInfo.transferFeeBps).mul(amount).div(BPS);
        fees = toBN(fees).sub(toBN(fees).mul(discount).div(BPS));

        assert.equal(debridge.collectedFees.add(fees).toString(), newDebridge.collectedFees.toString());
        assert.equal(
          nativeDebridgeInfo.collectedFees.add(fixedNativeFeeWithDiscount).toString(),
          newNativeDebridgeInfo.collectedFees.toString()
        );
      });

      it("should reject burning from current chain", async function () {
        const tokenAddress = ZERO_ADDRESS;
        const chainId = await this.debridge.chainId();
        const receiver = bob;
        const amount = toBN(toWei("1"));
        const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
        const deadline = 0;
        const signature = "0x";
        await expectRevert(
          this.debridge.burn(debridgeId, receiver, amount, 42, deadline, signature, false, {
            from: alice,
          }),
          "burn: native asset"
        );
      });
    });
  }
  context("Test claim method", () => {
    const tokenAddress = ZERO_ADDRESS;
    let receiver;
    const amount = toBN(toWei("0.9"));
    const nonce = 4;
    let chainIdFrom = 50;
    let chainId;
    let debridgeId;
    let outsideDebridgeId;
    let erc20DebridgeId;
    let curentChainSubmission;
    let outsideChainSubmission;
    let erc20Submission;
    before(async function () {
      receiver = bob;
      chainId = await this.debridge.chainId();
      debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
      outsideDebridgeId = await this.debridge.getDebridgeId(56, "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984");
      erc20DebridgeId = await this.debridge.getDebridgeId(chainId, this.mockToken.address);
      curentChainSubmission = await this.debridge.getSubmisionId(debridgeId, chainIdFrom, chainId, amount, receiver, nonce);
      outsideChainSubmission = await this.debridge.getSubmisionId(outsideDebridgeId, chainIdFrom, 56, amount, receiver, nonce);
      erc20Submission = await this.debridge.getSubmisionId(erc20DebridgeId, chainIdFrom, chainId, amount, receiver, nonce);
      for (let oracle of this.initialOracles) {
        await this.confirmationAggregator.connect(oracle.account).submit(curentChainSubmission);
        await this.confirmationAggregator.connect(oracle.account).submit(outsideChainSubmission);
        await this.confirmationAggregator.connect(oracle.account).submit(erc20Submission);
      }
    });
    it("check confirmation without DSRM confirmation", async function () {
      const curentChainSubmissionInfo = await this.confirmationAggregator.getSubmissionInfo(curentChainSubmission);
      const outsideChainSubmissionInfo = await this.confirmationAggregator.getSubmissionInfo(outsideChainSubmission);
      const erc20SubmissionInfo = await this.confirmationAggregator.getSubmissionInfo(erc20Submission);
      // struct SubmissionInfo {
      //   uint256 block; // confirmation block
      //   uint256 confirmations; // received confirmations count
      //   uint256 requiredConfirmations; // required oracles (DSRM) received confirmations count
      //   bool isConfirmed; // is confirmed submission (user can claim)
      //   mapping(address => bool) hasVerified; // verifier => has already voted
      // }
      assert.equal(curentChainSubmissionInfo.confirmations, this.initialOracles.length);
      assert.equal(curentChainSubmissionInfo.requiredConfirmations, 0);
      assert.equal(curentChainSubmissionInfo.isConfirmed, false);

      assert.equal(outsideChainSubmissionInfo.confirmations, this.initialOracles.length);
      assert.equal(outsideChainSubmissionInfo.requiredConfirmations, 0);
      assert.equal(outsideChainSubmissionInfo.isConfirmed, false);

      assert.equal(erc20SubmissionInfo.confirmations, this.initialOracles.length);
      assert.equal(erc20SubmissionInfo.requiredConfirmations, 0);
      assert.equal(erc20SubmissionInfo.isConfirmed, false);
    });

    it("should reject native token without DSRM confirmation", async function () {
      await expectRevert(
        this.debridge.claim(debridgeId, chainIdFrom, receiver, amount, nonce, [], {
          from: alice,
        }),
        "not confirmed"
      );
    });

    it("confirm by required oracle", async function () {
      await this.confirmationAggregator.submit(curentChainSubmission, {
        from: alice,
      });
      await this.confirmationAggregator.submit(outsideChainSubmission, {
        from: alice,
      });
      await this.confirmationAggregator.submit(erc20Submission, {
        from: alice,
      });
    });

    it("should reject when the submission is blocked", async function () {
      const cuurentChainSubmission = await this.debridge.getSubmisionId(debridgeId, chainIdFrom, chainId, amount, receiver, nonce);
      await this.debridge.blockSubmission([cuurentChainSubmission], true, {
        from: alice,
      });

      assert.equal(await this.debridge.isBlockedSubmission(cuurentChainSubmission), true);

      await expectRevert(
        this.debridge.claim(debridgeId, chainIdFrom, receiver, amount, nonce, [], {
          from: alice,
        }),
        "claim: blocked submission"
      );
    });

    it("should unblock the submission by admin", async function () {
      const cuurentChainSubmission = await this.debridge.getSubmisionId(debridgeId, chainIdFrom, chainId, amount, receiver, nonce);
      await this.debridge.blockSubmission([cuurentChainSubmission], false, {
        from: alice,
      });

      assert.equal(await this.debridge.isBlockedSubmission(cuurentChainSubmission), false);
    });

    it("check confirmation with DSRM confirmation", async function () {
      const curentChainSubmissionInfo = await this.confirmationAggregator.getSubmissionInfo(curentChainSubmission);
      const outsideChainSubmissionInfo = await this.confirmationAggregator.getSubmissionInfo(outsideChainSubmission);
      const erc20SubmissionInfo = await this.confirmationAggregator.getSubmissionInfo(erc20Submission);
      // struct SubmissionInfo {
      //   uint256 block; // confirmation block
      //   uint256 confirmations; // received confirmations count
      //   uint256 requiredConfirmations; // required oracles (DSRM) received confirmations count
      //   bool isConfirmed; // is confirmed submission (user can claim)
      //   mapping(address => bool) hasVerified; // verifier => has already voted
      // }
      assert.equal(curentChainSubmissionInfo.confirmations, this.initialOracles.length + 1);
      assert.equal(curentChainSubmissionInfo.requiredConfirmations, 1);
      assert.equal(curentChainSubmissionInfo.isConfirmed, true);

      assert.equal(outsideChainSubmissionInfo.confirmations, this.initialOracles.length + 1);
      assert.equal(outsideChainSubmissionInfo.requiredConfirmations, 1);
      assert.equal(outsideChainSubmissionInfo.isConfirmed, true);

      assert.equal(erc20SubmissionInfo.confirmations, this.initialOracles.length + 1);
      assert.equal(erc20SubmissionInfo.requiredConfirmations, 1);
      assert.equal(erc20SubmissionInfo.isConfirmed, true);
    });

    it("should claim native token when the submission is approved", async function () {
      const debridge = await this.debridge.getDebridge(debridgeId);
      const balance = toBN(await web3.eth.getBalance(receiver));

      await this.debridge.claim(debridgeId, chainIdFrom, receiver, amount, nonce, [], {
        from: alice,
      });
      const newBalance = toBN(await web3.eth.getBalance(receiver));
      const submissionId = await this.debridge.getSubmisionId(debridgeId, chainIdFrom, await this.debridge.chainId(), amount, receiver, nonce);
      const isSubmissionUsed = await this.debridge.isSubmissionUsed(submissionId);
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(debridge.collectedFees.toString(), newDebridge.collectedFees.toString());
      assert.ok(isSubmissionUsed);
    });

    it("should claim ERC20 when the submission is approved", async function () {
      const debridge = await this.debridge.getDebridge(erc20DebridgeId);
      const balance = toBN(await this.mockToken.balanceOf(receiver));
      await this.debridge.claim(erc20DebridgeId, chainIdFrom, receiver, amount, nonce, [], {
        from: alice,
      });
      const newBalance = toBN(await this.mockToken.balanceOf(receiver));
      const submissionId = await this.debridge.getSubmisionId(
        erc20DebridgeId,
        chainIdFrom,
        await this.debridge.chainId(),
        amount,
        receiver,
        nonce
      );
      const isSubmissionUsed = await this.debridge.isSubmissionUsed(submissionId);
      const newDebridge = await this.debridge.getDebridge(erc20DebridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(debridge.collectedFees.toString(), newDebridge.collectedFees.toString());
      assert.ok(isSubmissionUsed);
    });

    it("should reject claiming with unconfirmed submission", async function () {
      const nonce = 1;
      await expectRevert(
        this.debridge.claim(debridgeId, chainIdFrom, receiver, amount, nonce, [], {
          from: alice,
        }),
        "not confirmed"
      );
    });

    it("should reject claiming the token from outside chain", async function () {
      await expectRevert(
        this.debridge.claim(outsideDebridgeId, chainIdFrom, receiver, amount, nonce, [], {
          from: alice,
        }),
        "not confirmed"
      );
    });

    it("should reject claiming twice", async function () {
      await expectRevert(
        this.debridge.claim(debridgeId, chainIdFrom, receiver, amount, nonce, [], {
          from: alice,
        }),
        "claim: already used"
      );
    });
  });
});
