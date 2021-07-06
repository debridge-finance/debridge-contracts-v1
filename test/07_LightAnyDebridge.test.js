const Web3 = require("web3");
const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS, permit } = require("./utils.spec");
const { deployProxy } = require("@openzeppelin/truffle-upgrades");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const FullAggregator = artifacts.require("FullAggregator");
const LightVerifier = artifacts.require("LightVerifier");
const MockLinkToken = artifacts.require("MockLinkToken");
const WrappedAssetFactory = artifacts.require("WrappedAssetFactory");
const MockToken = artifacts.require("MockToken");
const Debridge = artifacts.require("LightAnyDebridge");
const WrappedAsset = artifacts.require("WrappedAsset");
const CallProxy = artifacts.require("CallProxy");
const DefiController = artifacts.require("DefiController");
const WETH9 = artifacts.require("WETH9");
const { toWei, fromWei, toBN } = web3.utils;
const bscWeb3 = new Web3(process.env.TEST_BSC_PROVIDER);
const oracleKeys = JSON.parse(process.env.TEST_ORACLE_KEYS);
const bobPrivKey =
  "0x79b2a2a43a1e9f325920f99a720605c9c563c61fb5ae3ebe483f83f1230512d3";

contract("LightAnyDebridge", function([alice, bob, carol, eve, fei, devid]) {
  before(async function() {
    this.mockToken = await MockToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.wrappedAssetFactory = await WrappedAssetFactory.new(alice, [], {
      from: alice,
    });
    this.amountThreshold = toWei("1000");
    this.oraclePayment = toWei("0.001");
    this.minConfirmations = 3;
    this.fullAggregatorAddress = "0x72736f8c88bd1e438b05acc28c58ac21c5dc76ce";
    this.aggregatorInstance = new web3.eth.Contract(
      FullAggregator.abi,
      this.fullAggregatorAddress
    );
    this.confirmationThreshold = 5; //Confirmations per block before extra check enabled.
    this.excessConfirmations = 3; //Confirmations count in case of excess activity.
    this.lightAggregator = await LightVerifier.new(
      this.minConfirmations,
      this.confirmationThreshold,
      this.excessConfirmations,
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
      await this.lightAggregator.addOracle(oracle.address, {
        from: alice,
      });
    }
    this.defiController = await DefiController.new({
      from: alice,
    });
    this.callProxy = await CallProxy.new({
      from: alice,
    });
    const minAmount = toWei("1");
    const maxAmount = toWei("100000000000");
    const fixedFee = toWei("0.00001");
    const assetFee = toWei("0.001");
    const minReserves = toWei("0.2");
    const isSupported = true;
    const supportedChainIds = [42, 56];
    this.weth = await WETH9.new({
      from: alice,
    });
    console.log(
      maxAmount,
      minReserves,
      alice,
      ZERO_ADDRESS,
      this.callProxy.address.toString(),
      supportedChainIds,
      [
        {
          assetFee,
          fixedFee,
          isSupported,
        },
        {
          assetFee,
          fixedFee,
          isSupported,
        },
      ],
      ZERO_ADDRESS,
      this.wrappedAssetFactory.address.toString()
    );
    this.debridge = await deployProxy(Debridge, [
      maxAmount,
      minReserves,
      alice,
      ZERO_ADDRESS,
      this.callProxy.address.toString(),
      supportedChainIds,
      [
        {
          assetFee,
          fixedFee,
          isSupported,
        },
        {
          assetFee,
          fixedFee,
          isSupported,
        },
      ],
      ZERO_ADDRESS,
      this.wrappedAssetFactory.address.toString(),
    ]);
    const minterRole = await this.wrappedAssetFactory.DEPLOYER_ROLE();
    await this.wrappedAssetFactory.grantRole(
      minterRole,
      this.debridge.address.toString(),
      {
        from: alice,
      }
    );
  });

  context("Test setting configurations by different users", () => {
    it("should set aggregator if called by the admin", async function() {
      const aggregator = this.lightAggregator.address;
      await this.debridge.setAggregator(aggregator, {
        from: alice,
      });
      const newAggregator = await this.debridge.aggregator();
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
        this.debridge.setAggregator(ZERO_ADDRESS, {
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
      const fees = toBN(supportedChainInfo.assetFee)
        .mul(amount)
        .div(toBN(toWei("1")));
      await this.debridge.send(tokenAddress, receiver, amount, chainIdTo, {
        value: amount,
        from: alice,
      });
      const newBalance = toBN(await web3.eth.getBalance(this.debridge.address));
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridge.collectedAssetFees.add(fees).toString(),
        newDebridge.collectedAssetFees.toString()
      );
      assert.equal(
        debridge.collectedNativeFees
          .add(toBN(supportedChainInfo.fixedFee))
          .toString(),
        newDebridge.collectedNativeFees.toString()
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
      const fees = toBN(supportedChainInfo.assetFee)
        .mul(amount)
        .div(toBN(toWei("1")));
      await this.debridge.send(tokenAddress, receiver, amount, chainIdTo, {
        from: alice,
        value: supportedChainInfo.fixedFee,
      });
      const newBalance = toBN(
        await this.mockToken.balanceOf(this.debridge.address)
      );
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridge.collectedAssetFees.add(fees).toString(),
        newDebridge.collectedAssetFees.toString()
      );
      assert.equal(
        debridge.collectedNativeFees
          .add(toBN(supportedChainInfo.fixedFee))
          .toString(),
        newDebridge.collectedNativeFees.toString()
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
        this.debridge.send(tokenAddress, receiver, amount, chainIdTo, {
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
        this.debridge.send(tokenAddress, receiver, amount, chainIdTo, {
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
    const amount = toBN(toWei("10"));
    const nonce = 1;
    const tokenAddress = "0x0000000000000000000000000000000000000000";
    const chainId = 42;
    let currentChainId;

    before(async function() {
      debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
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
      await this.debridge.mint(
        tokenAddress,
        chainId,
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
      const balance = toBN(0);
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

    it("should reject minting with unconfirmed submission", async function() {
      const nonce = 4;
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.debridge.mint(
          tokenAddress,
          chainId,
          chainId,
          receiver,
          amount,
          nonce,
          [],
          {
            from: alice,
          }
        ),
        "mint: not confirmed"
      );
    });

    it("should reject minting twice", async function() {
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.debridge.mint(
          tokenAddress,
          chainId,
          chainId,
          receiver,
          amount,
          nonce,
          [],
          {
            from: alice,
          }
        ),
        "mint: already used"
      );
    });
  });

  context("Test burn method", () => {
    it("should burning when the amount is suficient", async function() {
      const tokenAddress = ZERO_ADDRESS;
      const chainIdTo = 42;
      const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);
      const receiver = alice;
      const amount = toBN("999000000000000");
      const debridgeId = await this.debridge.getDebridgeId(
        chainIdTo,
        tokenAddress
      );
      const debridge = await this.debridge.getDebridge(debridgeId);
      const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);
      const balance = toBN(await wrappedAsset.balanceOf(bob));
      await wrappedAsset.approve(this.debridge.address, amount, {
        from: bob,
      });
      const deadline = MAX_UINT256;
      const signature = await permit(
        wrappedAsset,
        bob,
        this.debridge.address,
        amount,
        deadline,
        bobPrivKey
      );
      await this.debridge.burn(
        debridgeId,
        receiver,
        amount,
        chainIdTo,
        deadline,
        signature,
        {
          from: bob,
          value: supportedChainInfo.fixedFee,
        }
      );
      const newBalance = toBN(await wrappedAsset.balanceOf(bob));
      assert.equal(balance.sub(amount).toString(), newBalance.toString());
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      const fees = toBN(supportedChainInfo.assetFee)
        .mul(amount)
        .div(toBN(toWei("1")));
      assert.equal(
        debridge.collectedAssetFees.add(fees).toString(),
        newDebridge.collectedAssetFees.toString()
      );
      assert.equal(
        debridge.collectedNativeFees
          .add(toBN(supportedChainInfo.fixedFee))
          .toString(),
        newDebridge.collectedNativeFees.toString()
      );
    });

    it("should reject burning from current chain", async function() {
      const supportedChainInfo = await this.debridge.getChainSupport(42);
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
            value: supportedChainInfo.fixedFee,
          }
        ),
        "burn: native asset"
      );
    });
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
        debridge.collectedAssetFees.toString(),
        newDebridge.collectedAssetFees.toString()
      );
      assert.equal(
        debridge.collectedNativeFees.toString(),
        newDebridge.collectedNativeFees.toString()
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
        debridge.collectedAssetFees.toString(),
        newDebridge.collectedAssetFees.toString()
      );
      assert.equal(
        debridge.collectedNativeFees.toString(),
        newDebridge.collectedNativeFees.toString()
      );
      assert.ok(isSubmissionUsed);
    });

    it("should reject claiming with unconfirmed submission", async function() {
      const nonce = 1;
      await expectRevert(
        this.debridge.claim(
          debridgeId,
          chainIdFrom,
          receiver,
          amount,
          nonce,
          [],
          {
            from: alice,
          }
        ),
        "claim: not confirmed"
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
          [],
          {
            from: alice,
          }
        ),
        "claim: already used"
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
      await this.debridge.withdrawFee(debridgeId, receiver, amount, false, {
        from: alice,
      });
      const newBalance = toBN(await web3.eth.getBalance(receiver));
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(
        debridge.collectedAssetFees.sub(amount).toString(),
        newDebridge.collectedAssetFees.toString()
      );
      assert.equal(
        debridge.collectedNativeFees.toString(),
        newDebridge.collectedNativeFees.toString()
      );
      assert.equal(balance.add(amount).toString(), newBalance.toString());
    });

    it("should withdraw fee of ERC20 token if it is called by the admin", async function() {
      const debridge = await this.debridge.getDebridge(erc20DebridgeId);
      const balance = toBN(await this.mockToken.balanceOf(receiver));
      await this.debridge.withdrawFee(
        erc20DebridgeId,
        receiver,
        amount,
        false,
        {
          from: alice,
        }
      );
      const newBalance = toBN(await this.mockToken.balanceOf(receiver));
      const newDebridge = await this.debridge.getDebridge(erc20DebridgeId);
      assert.equal(
        debridge.collectedAssetFees.sub(amount).toString(),
        newDebridge.collectedAssetFees.toString()
      );
      assert.equal(
        debridge.collectedNativeFees.toString(),
        newDebridge.collectedNativeFees.toString()
      );
      assert.equal(balance.add(amount).toString(), newBalance.toString());
    });

    it("should reject withdrawing fee by non-admin", async function() {
      await expectRevert(
        this.debridge.withdrawFee(debridgeId, receiver, amount, false, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject withdrawing too many fees", async function() {
      const amount = toBN(toWei("100"));
      await expectRevert(
        this.debridge.withdrawFee(debridgeId, receiver, amount, false, {
          from: alice,
        }),
        "withdrawFee: not enough fee"
      );
    });

    it("should reject withdrawing fees if the token not from current chain", async function() {
      const amount = toBN(toWei("100"));
      await expectRevert(
        this.debridge.withdrawFee(outsideDebridgeId, receiver, amount, false, {
          from: alice,
        }),
        "withdrawFee: not enough fee"
      );
    });
  });
});
