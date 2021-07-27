const Web3 = require("web3");
const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS, permit } = require("./utils.spec");
const { deployProxy } = require("@openzeppelin/truffle-upgrades");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const FullAggregator = artifacts.require("FullAggregator");
const LightVerifier = artifacts.require("LightVerifier");
const MockLinkToken = artifacts.require("MockLinkToken");
const MockToken = artifacts.require("MockToken");
const Debridge = artifacts.require("DeBridgeGate");
const WrappedAsset = artifacts.require("WrappedAsset");
const CallProxy = artifacts.require("CallProxy");
const DefiController = artifacts.require("DefiController");
const WETH9 = artifacts.require("WETH9");
const { toWei, fromWei, toBN } = web3.utils;
const MAX = web3.utils.toTwosComplement(-1);
const Tx = require("ethereumjs-tx");
const bscWeb3 = new Web3(process.env.TEST_BSC_PROVIDER);
const oracleKeys = JSON.parse(process.env.TEST_ORACLE_KEYS);
const bobPrivKey =
  "0x79b2a2a43a1e9f325920f99a720605c9c563c61fb5ae3ebe483f83f1230512d3";

const transferFeeBPS = 50;
const minReservesBPS = 3000;
const BPS = toBN(10000);

contract("DeBridgeGate light mode", function([alice, bob, carol, eve, fei, devid]) {
  before(async function() {
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
    this.minConfirmations = 3;
    //this.fullAggregatorAddress = "0x72736f8c88bd1e438b05acc28c58ac21c5dc76ce";
    //this.aggregatorInstance = new web3.eth.Contract(
    //  FullAggregator.abi,
    //  this.fullAggregatorAddress
    //);
    this.confirmationThreshold = 5; //Confirmations per block before extra check enabled.
    this.excessConfirmations = 3; //Confirmations count in case of excess activity.

    this.fullAggregator = await FullAggregator.new(
      this.minConfirmations,
      this.confirmationThreshold,
      this.excessConfirmations,
      alice,
      ZERO_ADDRESS,
      {
        from: alice,
      }
    );
    // constructor(
    //   uint256 _minConfirmations,
    //   uint256 _confirmationThreshold,
    //   uint256 _excessConfirmations,
    //   address _wrappedAssetAdmin,
    //   address _debridgeAddress
    // )
    this.lightVerifier = await LightVerifier.new(
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
      await this.lightVerifier.addOracle(oracle.address, {
        from: alice,
      });
    }
    this.defiController = await DefiController.new({
      from: alice,
    });
    this.callProxy = await CallProxy.new({
      from: alice,
    });
    const maxAmount = toWei("100000000000");
    const fixedNativeFee = toWei("0.00001");
    const isSupported = true;
    const supportedChainIds =[42, 56];
    this.weth = await WETH9.new({
      from: alice,
    });

    //function initialize(
    //    uint256 _excessConfirmations,
    //    address _lightAggregator,
    //    address _fullAggregator,
    //    address _callProxy,
    //    uint256[] memory _supportedChainIds,
    //    ChainSupportInfo[] memory _chainSupportInfo,
    //    IWETH _weth,
    //    IFeeProxy _feeProxy,
    //    IDefiController _defiController
    //)

    this.debridge = await deployProxy(Debridge, [
      this.excessConfirmations,
      this.lightVerifier.address.toString(),
      this.fullAggregator.address.toString(),
      this.callProxy.address.toString(),
      supportedChainIds,
      [
        {
          transferFeeBPS,
          fixedNativeFee,
          isSupported,
        },
        {
          transferFeeBPS,
          fixedNativeFee,
          isSupported,
        },
      ],
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        devid
    ]);

    await this.lightVerifier.setDebridgeAddress(this.debridge.address.toString());
  });

  context("Test setting configurations by different users", () => {
    it("should set aggregator if called by the admin", async function() {
      const aggregator = this.lightVerifier.address;
      await this.debridge.setAggregator(aggregator, true,{
        from: alice,
      });
      const newAggregator = await this.debridge.lightAggregator();
      assert.equal(aggregator, newAggregator);
    });

    it("should set defi controller if called by the admin", async function() {
      const defiController = this.defiController.address;
      await this.debridge.setDefiController(defiController, {
        from: alice,
      });
      const newDefiController = await this.debridge.defiController();
      assert.equal(defiController, newDefiController);
    });

    it("should reject setting aggregator if called by the non-admin", async function() {
      await expectRevert(
        this.debridge.setAggregator(ZERO_ADDRESS, true,{
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject setting defi controller if called by the non-admin", async function() {
      await expectRevert(
        this.debridge.setDefiController(ZERO_ADDRESS, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });
  });

  context("Test managing assets", () => {
    const isSupported = true;
    it("should add external asset if called by the admin", async function() {
      const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      const chainId = 56;
      const maxAmount = toWei("100000000000");
      const amountThreshold = toWei("10000000000000");
      const fixedFee = toWei("0.00001");
      const supportedChainIds = [42, 3];
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
      const debridgeId = await this.lightVerifier.getDebridgeId(chainId, tokenAddress);
      //console.log('debridgeId '+debridgeId);
      const deployId = await this.lightVerifier.getDeployId(debridgeId, name, symbol, decimals);

      let signatures = [];
      for (let i = 0; i < oracleKeys.length; i++) {
        const oracleKey = oracleKeys[i];
        signatures.push(
          (await bscWeb3.eth.accounts.sign(deployId, oracleKey)).signature
        );
      }
      await this.lightVerifier.confirmNewAsset(tokenAddress, chainId, name, symbol, decimals, signatures, {
        from: this.initialOracles[0].address,
      });
      
      ////   function getDeployId(
      ////     bytes32 _debridgeId,
      ////     string memory _name,
      ////     string memory _symbol,
      ////     uint8 _decimals
      //// )
      ////function deployAsset(bytes32 _deployId)
      //await this.lightVerifier.deployAsset(deployId, {
      //  from: this.initialOracles[0].address,
      //});

      await this.debridge.updateAsset(
       debridgeId,
       maxAmount,
       minReservesBPS,
       amountThreshold,
       {
         from: alice,
       }
      );
      const debridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(debridge.maxAmount.toString(), maxAmount);
      assert.equal(debridge.collectedFees.toString(), "0");
      assert.equal(debridge.balance.toString(), "0");
      assert.equal(debridge.minReservesBPS.toString(), minReservesBPS);
    });
  });

  context("Test send method", () => {
    it("should send native tokens from the current chain", async function() {
      const tokenAddress = ZERO_ADDRESS;
      const chainId = await this.debridge.chainId();
      const receiver = bob;
      const amount = toBN(toWei("1"));
      const chainIdTo = 42;
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const balance = toBN(await web3.eth.getBalance(this.debridge.address));
      const debridge = await this.debridge.getDebridge(debridgeId);
      const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);
      const fees = toBN(supportedChainInfo.transferFeeBPS)
        .mul(amount)
        .div(BPS);
      const collectedNativeFees = await this.debridge.collectedFees();
      await this.debridge.send(
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
      const newBalance = toBN(await web3.eth.getBalance(this.debridge.address));
      const newCollectedNativeFees = await this.debridge.collectedFees();
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridge.collectedFees
          .add(toBN(supportedChainInfo.fixedNativeFee))
          .add(fees)
          .toString(),
        newDebridge.collectedFees.toString()
      );
      assert.equal(
        collectedNativeFees.toString(),
        newCollectedNativeFees.toString()
      );
    });

    it("should send ERC20 tokens from the current chain", async function() {
      const tokenAddress = this.mockToken.address;
      const chainId = await this.debridge.chainId();
      const receiver = bob;
      const amount = toBN(toWei("100"));
      const chainIdTo = 42;
      await this.mockToken.mint(alice, amount, {
        from: alice,
      });
      await this.mockToken.approve(this.debridge.address, amount, {
        from: alice,
      });
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const balance = toBN(
        await this.mockToken.balanceOf(this.debridge.address)
      );
      const debridge = await this.debridge.getDebridge(debridgeId);
      const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);
      const collectedNativeFees = await this.debridge.collectedFees();
      const fees = toBN(supportedChainInfo.transferFeeBPS)
        .mul(amount)
        .div(BPS);
      await this.debridge.send(
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
      const newCollectedNativeFees = await this.debridge.collectedFees();
      const newBalance = toBN(
        await this.mockToken.balanceOf(this.debridge.address)
      );
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridge.collectedFees.add(fees).toString(),
        newDebridge.collectedFees.toString()
      );
      assert.equal(
        collectedNativeFees
          .add(toBN(supportedChainInfo.fixedNativeFee))
          .toString(),
        newCollectedNativeFees.toString()
      );
    });

    it("should reject sending too mismatched amount of native tokens", async function() {
      const tokenAddress = ZERO_ADDRESS;
      const receiver = bob;
      const chainId = await this.debridge.chainId();
      const amount = toBN(toWei("1"));
      const chainIdTo = 42;
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.debridge.send(tokenAddress, receiver, amount, chainIdTo, false, {
          value: toWei("0.1"),
          from: alice,
        }),
        "send: amount mismatch"
      );
    });

    it("should reject sending tokens to unsupported chain", async function() {
      const tokenAddress = ZERO_ADDRESS;
      const receiver = bob;
      const chainId = await this.debridge.chainId();
      const amount = toBN(toWei("1"));
      const chainIdTo = chainId;
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.debridge.send(tokenAddress, receiver, amount, chainIdTo, false, {
          value: amount,
          from: alice,
        }),
        "send: wrong targed chain"
      );
    });
  });

  context("Test mint method", () => {
    let debridgeId;
    const receiver = bob;
    const amount = toBN(toWei("100"));
    const nonce = 1;
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    let currentChainId;

    before(async function() {
      debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
      //console.log('debridgeId '+debridgeId);
      currentChainId = await this.debridge.chainId();
      const submission = await this.debridge.getSubmisionId(
        debridgeId,
        chainId,
        currentChainId,
        amount,
        receiver,
        nonce
      );
      this.signatures = [];
      for (let i = 0; i < oracleKeys.length; i++) {
        const oracleKey = oracleKeys[i];
        this.signatures.push(
          (await bscWeb3.eth.accounts.sign(submission, oracleKey)).signature
        );
      }
    });

    it("should mint when the submission is approved", async function() {
      const balance  = toBN("0");

    //   function mint(
    //     address _tokenAddress,
    //     uint256 _chainId,
    //     uint256 _chainIdFrom,
    //     address _receiver,
    //     uint256 _amount,
    //     uint256 _nonce,
    //     bytes[] calldata _signatures
    // )
      await this.debridge.mint(
        debridgeId,
        chainId,
        receiver,
        amount,
        nonce,
        this.signatures,
        {
          from: alice,
        }
      );
      const debridge = await this.debridge.getDebridge(debridgeId);
      const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);

      const newBalance = toBN(await wrappedAsset.balanceOf(receiver));
      const submissionId = await this.debridge.getSubmisionId(
        debridgeId,
        chainId,
        currentChainId,
        amount,
        receiver,
        nonce
      );
      const isSubmissionUsed = await this.debridge.isSubmissionUsed(
        submissionId
      );
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.ok(isSubmissionUsed);
    });


      // it("should update asset if called by the admin after deploy assets by mint", async function () {
      //     const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      //     const chainId = 56;
      //     const maxAmount = toWei("100000000000");
      //     const amountThreshold = toWei("10000000000000");
      //     const fixedFee = toWei("0.00001");
      //     const transferFee = toWei("0.01");
      //     const minReserves = toWei("0.2");
      //     const supportedChainIds = [42, 3];
      //     const name = "MUSD";
      //     const symbol = "Magic Dollar";
      //     const decimals = 18;

      //     await this.debridge.updateAsset(
      //       debridgeId,
      //       maxAmount,
      //       minReserves,
      //       amountThreshold,
      //       {
      //         from: alice,
      //       }
      //     );
      //     const debridge = await this.debridge.getDebridge(debridgeId);
      //     assert.equal(debridge.maxAmount.toString(), maxAmount);
      //     assert.equal(debridge.collectedFees.toString(), "0");
      //     assert.equal(debridge.balance.toString(), "0");
      //     assert.equal(debridge.minReserves.toString(), minReserves);
      // });

    it("should reject minting with unconfirmed submission", async function() {
      const wrongnonce = 4;
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.debridge.mint(debridgeId, chainId, receiver, amount, wrongnonce, [], {//will call IFullAggregator
          from: alice,
        }),
        "not confirmed"
      );
    });

    it("should reject minting with error signature", async function() {
      const wrongnonce = 4;
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.debridge.mint(debridgeId, chainId, receiver, amount, wrongnonce, this.signatures, {
          from: alice,
        }),
        "onlyOracle: bad role"
      );
    });

    it("should reject minting twice", async function() {
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.debridge.mint(debridgeId, chainId, receiver, amount, nonce, this.signatures, {
          from: alice,
        }),
        "submit: submitted already"
        //"mint: already used"
      );
    });
  });

  context("Test burn method", () => {
    it("should burning when the amount is suficient", async function() {
      const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      const chainIdTo = 56;
      const receiver = alice;
      const amount = toBN(toWei("5"));
      const debridgeId = await this.debridge.getDebridgeId(
        chainIdTo,
        tokenAddress
      );
      const debridge = await this.debridge.getDebridge(debridgeId);
      const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);
      const balance = toBN(await wrappedAsset.balanceOf(bob));
      const deadline = MAX_UINT256;
      const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);
      const signature = await permit(
        wrappedAsset,
        bob,
        this.debridge.address,
        amount,
        deadline,
        bobPrivKey
      );
      const collectedNativeFees = await this.debridge.collectedFees();
      await this.debridge.burn(
        debridgeId,
        receiver,
        amount,
        chainIdTo,
        deadline,
        signature,
        false,
        {
          from: bob,
          value: supportedChainInfo.fixedNativeFee,
        }
      );
      const newCollectedNativeFees = await this.debridge.collectedFees();
      const newBalance = toBN(await wrappedAsset.balanceOf(bob));
      assert.equal(balance.sub(amount).toString(), newBalance.toString());
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      const fees = toBN(supportedChainInfo.transferFeeBPS)
        .mul(amount)
        .div(BPS);
      assert.equal(
        debridge.collectedFees.add(fees).toString(),
        newDebridge.collectedFees.toString()
      );
      assert.equal(
        collectedNativeFees
        //TODO: check wrong native + token fee
          .add(toBN(supportedChainInfo.fixedNativeFee))
          .toString(),
        newCollectedNativeFees.toString()
      );
    });

    it("should reject burning from current chain", async function() {
      const tokenAddress = ZERO_ADDRESS;
      const chainId = await this.debridge.chainId();
      const receiver = bob;
      const amount = toBN(toWei("1"));
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const deadline = 0;
      const signature = "0x";
      await expectRevert(
        this.debridge.burn(
          debridgeId,
          receiver,
          amount,
          42,
          deadline,
          signature,
          {
            from: alice,
          }
        ),
        "burn: native asset"
      );
    });

  //TODO: check 'send: amount does not cover fees' when pay by token
  //   it("should reject burning too few tokens", async function() {
  //     const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
  //     const chainIdTo = 56;
  //     const receiver = bob;
  //     const amount = toBN("10");
  //     const debridgeId = await this.debridge.getDebridgeId(
  //       chainIdTo,
  //       tokenAddress
  //       );
  //     const debridge = await this.debridge.getDebridge(debridgeId);
  //     const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);
  //     //const balance = toBN(await wrappedAsset.balanceOf(bob));
  //     const deadline = 0;
  //     const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);
  //     //const signature = "0x";
  //     const signature = await permit(
  //           wrappedAsset,
  //           bob,
  //           this.debridge.address,
  //           amount,
  //           deadline,
  //           bobPrivKey
  //       );
  //     await expectRevert(
  //       this.debridge.burn(
  //         debridgeId,
  //         receiver,
  //         amount,
  //         chainIdTo,
  //         deadline,
  //         signature,
  //         false,
  //         {
  //           from: bob,
  //           value: supportedChainInfo.fixedNativeFee,
  //         }
  //       ),
  //       "burn: amount too low"
  //     );
  //   });
  });

  context("Test claim method", () => {
    const tokenAddress = ZERO_ADDRESS;
    const receiver = bob;
    const amount = toBN(toWei("0.9"));
    const nonce = 4;
    let chainId;
    let chainIdFrom = 87;
    let debridgeId;
    let erc20DebridgeId;

    before(async function() {
      chainId = await this.debridge.chainId();
      debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
      erc20DebridgeId = await this.debridge.getDebridgeId(
        chainId,
        this.mockToken.address
      );
      const curentChainSubmission = await this.debridge.getSubmisionId(
        debridgeId,
        chainIdFrom,
        chainId,
        amount,
        receiver,
        nonce
      );
      this.ethSignatures = [];
      for (let i = 0; i < oracleKeys.length; i++) {
        const oracleKey = oracleKeys[i];
        this.ethSignatures.push(
          (await bscWeb3.eth.accounts.sign(curentChainSubmission, oracleKey))
            .signature
        );
      }
      const erc20Submission = await this.debridge.getSubmisionId(
        erc20DebridgeId,
        chainIdFrom,
        chainId,
        amount,
        receiver,
        nonce
      );
      this.erc20Signatures = [];
      for (let i = 0; i < oracleKeys.length; i++) {
        const oracleKey = oracleKeys[i];
        this.erc20Signatures.push(
          (await bscWeb3.eth.accounts.sign(erc20Submission, oracleKey))
            .signature
        );
      }
    });

    it("should claim native token when the submission is approved", async function() {
      const debridge = await this.debridge.getDebridge(debridgeId);
      const balance = toBN(await web3.eth.getBalance(receiver));
      await this.debridge.claim(
        debridgeId,
        chainIdFrom,
        receiver,
        amount,
        nonce,
        this.ethSignatures,
        {
          from: alice,
        }
      );
      const newBalance = toBN(await web3.eth.getBalance(receiver));
      const submissionId = await this.debridge.getSubmisionId(
        debridgeId,
        chainIdFrom,
        chainId,
        amount,
        receiver,
        nonce
      );
      const isSubmissionUsed = await this.debridge.isSubmissionUsed(
        submissionId
      );
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridge.collectedFees.toString(),
        newDebridge.collectedFees.toString()
      );
      assert.ok(isSubmissionUsed);
    });

    it("should claim ERC20 when the submission is approved", async function() {
      const debridge = await this.debridge.getDebridge(erc20DebridgeId);
      const balance = toBN(await this.mockToken.balanceOf(receiver));
      await this.debridge.claim(
        erc20DebridgeId,
        chainIdFrom,
        receiver,
        amount,
        nonce,
        this.erc20Signatures,
        {
          from: alice,
        }
      );
      const newBalance = toBN(await this.mockToken.balanceOf(receiver));
      const submissionId = await this.debridge.getSubmisionId(
        erc20DebridgeId,
        chainIdFrom,
        chainId,
        amount,
        receiver,
        nonce
      );
      const isSubmissionUsed = await this.debridge.isSubmissionUsed(
        submissionId
      );
      const newDebridge = await this.debridge.getDebridge(erc20DebridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridge.collectedFees.toString(),
        newDebridge.collectedFees.toString()
      );
      assert.ok(isSubmissionUsed);
    });

    it("should reject claiming with unconfirmed submission", async function() {
      const wrongnonce = 122;
      await expectRevert(
        this.debridge.claim(
          debridgeId,
          chainIdFrom,
          receiver,
          amount,
          wrongnonce,
          this.ethSignatures,
          {
            from: alice,
          }
        ),
        "onlyOracle: bad role"
        //"not confirmed"
      );
    });

    it("should reject claiming twice", async function() {
      await expectRevert(
        this.debridge.claim(
          debridgeId,
          chainIdFrom,
          receiver,
          amount,
          nonce,
          this.ethSignatures,
          {
            from: alice,
          }
        ),
        //"claim: already used"
        "submit: submitted already"
      );
    });
  });

  context("Test fee maangement", () => {
    const tokenAddress = ZERO_ADDRESS;
    const receiver = bob;
    const amount = toBN(toWei("0.00001"));
    let chainId;
    let debridgeId;
    let outsideDebridgeId;
    let erc20DebridgeId;

    before(async function() {
      chainId = await this.debridge.chainId();
      debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
      outsideDebridgeId = await this.debridge.getDebridgeId(42, tokenAddress);
      erc20DebridgeId = await this.debridge.getDebridgeId(
        chainId,
        this.mockToken.address
      );
    });

    it("should withdraw fee of native token if it is called by the admin", async function() {
      const debridge = await this.debridge.getDebridge(debridgeId);
      const balance = toBN(await web3.eth.getBalance(receiver));
      await this.debridge.withdrawFee(debridgeId, receiver, amount, {
        from: alice,
      });
      const newBalance = toBN(await web3.eth.getBalance(receiver));
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(
        debridge.collectedFees.sub(amount).toString(),
        newDebridge.collectedFees.toString()
      );
      assert.equal(balance.add(amount).toString(), newBalance.toString());
    });

    it("should withdraw fee of ERC20 token if it is called by the admin", async function() {
      const debridge = await this.debridge.getDebridge(erc20DebridgeId);
      const balance = toBN(await this.mockToken.balanceOf(receiver));
      await this.debridge.withdrawFee(erc20DebridgeId, receiver, amount, {
        from: alice,
      });
      const newBalance = toBN(await this.mockToken.balanceOf(receiver));
      const newDebridge = await this.debridge.getDebridge(erc20DebridgeId);
      assert.equal(
        debridge.collectedFees.sub(amount).toString(),
        newDebridge.collectedFees.toString()
      );
      assert.equal(balance.add(amount).toString(), newBalance.toString());
    });

    it("should reject withdrawing fee by non-admin", async function() {
      await expectRevert(
        this.debridge.withdrawFee(debridgeId, receiver, amount, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject withdrawing too many fees", async function() {
      const amount = toBN(toWei("100"));
      await expectRevert(
        this.debridge.withdrawFee(debridgeId, receiver, amount, {
          from: alice,
        }),
        "withdrawFee: not enough fee"
      );
    });

    it("should reject withdrawing fees if the token not from current chain", async function() {
      const amount = toBN(toWei("100"));
      await expectRevert(
        this.debridge.withdrawFee(outsideDebridgeId, receiver, amount, {
          from: alice,
        }),
        "withdrawFee: not enough fee"
      );
    });
  });
});
