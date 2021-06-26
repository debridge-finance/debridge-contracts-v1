const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS, permit } = require("./utils.spec");
const Aggregator = artifacts.require("FullAggregator");
const MockLinkToken = artifacts.require("MockLinkToken");
const MockToken = artifacts.require("MockToken");
const Debridge = artifacts.require("FullDebridge");
const WrappedAsset = artifacts.require("WrappedAsset");
const FeeProxy = artifacts.require("FeeProxy");
const CallProxy = artifacts.require("CallProxy");
const UniswapV2Factory = artifacts.require("UniswapV2Factory");
const IUniswapV2Pair = artifacts.require("IUniswapV2Pair");
const DefiController = artifacts.require("DefiController");
const { deployProxy } = require("@openzeppelin/truffle-upgrades");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const WETH9 = artifacts.require("WETH9");
const { toWei, fromWei, toBN } = web3.utils;
const MAX = web3.utils.toTwosComplement(-1);
const bobPrivKey =
  "0x79b2a2a43a1e9f325920f99a720605c9c563c61fb5ae3ebe483f83f1230512d3";

contract("FullDebridge", function([alice, bob, carol, eve, devid]) {
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
    this.amountThreshols = toWei("1000");
    this.oraclePayment = toWei("0.001");
    this.bonusPayment = toWei("0.001");
    this.minConfirmations = 1;
    this.confirmationThreshold = 5; //Confirmations per block before extra check enabled.
    this.excessConfirmations = 3; //Confirmations count in case of excess activity.

    this.aggregator = await Aggregator.new(
      this.minConfirmations,
      this.oraclePayment,
      this.bonusPayment,
      this.linkToken.address,
      this.dbrToken.address,
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
        address: eve,
        admin: carol,
      },
    ];
    for (let oracle of this.initialOracles) {
      await this.aggregator.addOracle(oracle.address, oracle.admin, {
        from: alice,
      });
    }
    this.uniswapFactory = await UniswapV2Factory.new(carol, {
      from: alice,
    });
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
    const minAmount = toWei("1");
    const maxAmount = toWei("1000000");
    const fixedFee = toWei("0.00001");
    const transferFee = toWei("0.001");
    const minReserves = toWei("0.2");
    const isSupported = true;
    const supportedChainIds = [42, 56];
    this.weth = await WETH9.new({
      from: alice,
    });
    this.debridge = await deployProxy(Debridge, [
      this.excessConfirmations,
      minAmount,
      maxAmount,
      minReserves,
      this.amountThreshols,
      ZERO_ADDRESS,
      this.callProxy.address.toString(),
      supportedChainIds,
      [
        {
          transferFee,
          fixedFee,
          isSupported,
        },
        {
          transferFee,
          fixedFee,
          isSupported,
        },
      ],
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
    ]);
  });

  context("Test setting configurations by different users", () => {
    it("should set aggregator if called by the admin", async function() {
      const aggregator = this.aggregator.address;
      await this.debridge.setAggregator(aggregator, {
        from: alice,
      });
      const newAggregator = await this.debridge.aggregator();
      assert.equal(aggregator, newAggregator);
    });

    it("should set fee proxy if called by the admin", async function() {
      const feeProxy = this.feeProxy.address;
      await this.debridge.setFeeProxy(feeProxy, {
        from: alice,
      });
      const newFeeProxy = await this.debridge.feeProxy();
      assert.equal(feeProxy, newFeeProxy);
    });

    it("should set defi controller if called by the admin", async function() {
      const defiController = this.defiController.address;
      await this.debridge.setDefiController(defiController, {
        from: alice,
      });
      const newDefiController = await this.debridge.defiController();
      assert.equal(defiController, newDefiController);
    });

    it("should set weth if called by the admin", async function() {
      const weth = this.weth.address;
      await this.debridge.setWeth(weth, {
        from: alice,
      });
      const newWeth = await this.debridge.weth();
      assert.equal(weth, newWeth);
    });

    it("should reject setting aggregator if called by the non-admin", async function() {
      await expectRevert(
        this.debridge.setAggregator(ZERO_ADDRESS, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject setting fee proxy if called by the non-admin", async function() {
      await expectRevert(
        this.debridge.setFeeProxy(ZERO_ADDRESS, {
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

    it("should reject setting weth if called by the non-admin", async function() {
      await expectRevert(
        this.debridge.setWeth(ZERO_ADDRESS, {
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
      const minAmount = toWei("100");
      const maxAmount = toWei("100000000000000000");
      const amountThreshold = toWei("10000000000000");
      const fixedFee = toWei("0.00001");
      const transferFee = toWei("0.01");
      const minReserves = toWei("0.2");
      const supportedChainIds = [42, 3, 56];
      const name = "MUSD";
      const symbol = "Magic Dollar";
      const wrappedAsset = await WrappedAsset.new(
        name,
        symbol,
        [this.debridge.address],
        {
          from: alice,
        }
      );
      await this.debridge.addExternalAsset(
        tokenAddress,
        wrappedAsset.address,
        chainId,
        minAmount,
        maxAmount,
        minReserves,
        amountThreshold,
        supportedChainIds,
        [
          {
            transferFee,
            fixedFee,
            isSupported,
          },
          {
            transferFee,
            fixedFee,
            isSupported,
          },
          {
            transferFee,
            fixedFee,
            isSupported,
          },
        ],
        {
          from: alice,
        }
      );
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const debridge = await this.debridge.getDebridge(debridgeId);
      const supportedChainInfo = await this.debridge.getChainIdSupport(
        debridgeId,
        3
      );
      assert.equal(debridge.chainId.toString(), chainId);
      assert.equal(debridge.minAmount.toString(), minAmount);
      assert.equal(debridge.maxAmount.toString(), maxAmount);
      assert.equal(supportedChainInfo.fixedFee.toString(), fixedFee);
      assert.equal(supportedChainInfo.transferFee.toString(), transferFee);
      assert.equal(debridge.collectedFees.toString(), "0");
      assert.equal(debridge.balance.toString(), "0");
      assert.equal(debridge.minReserves.toString(), minReserves);
    });

    it("should add native asset if called by the admin", async function() {
      const tokenAddress = this.mockToken.address;
      const chainId = await this.debridge.chainId();
      const minAmount = toWei("100");
      const maxAmount = toWei("100000000000");
      const amountThreshold = toWei("10000000000000");
      const fixedFee = toWei("0.00001");
      const transferFee = toWei("0.01");
      const minReserves = toWei("0.2");
      const supportedChainIds = [42, 3];
      await this.debridge.addNativeAsset(
        tokenAddress,
        minAmount,
        maxAmount,
        minReserves,
        amountThreshold,
        supportedChainIds,
        [
          {
            transferFee,
            fixedFee,
            isSupported,
          },
          {
            transferFee,
            fixedFee,
            isSupported,
          },
        ],
        {
          from: alice,
        }
      );
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const debridge = await this.debridge.getDebridge(debridgeId);
      const supportedChainInfo = await this.debridge.getChainIdSupport(
        debridgeId,
        3
      );
      assert.equal(debridge.tokenAddress, tokenAddress);
      assert.equal(debridge.chainId.toString(), chainId);
      assert.equal(debridge.minAmount.toString(), minAmount);
      assert.equal(debridge.maxAmount.toString(), maxAmount);
      assert.equal(supportedChainInfo.fixedFee.toString(), fixedFee);
      assert.equal(supportedChainInfo.transferFee.toString(), transferFee);
      assert.equal(debridge.collectedFees.toString(), "0");
      assert.equal(debridge.balance.toString(), "0");
      assert.equal(debridge.minReserves.toString(), minReserves);
    });

    it("should reject adding external asset if called by the non-admin", async function() {
      await expectRevert(
        this.debridge.addExternalAsset(
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          0,
          0,
          0,
          0,
          0,
          [0],
          [
            {
              transferFee: 0,
              fixedFee: 0,
              isSupported: false,
            },
          ],
          {
            from: bob,
          }
        ),
        "onlyAdmin: bad role"
      );
    });

    it("should reject setting native asset if called by the non-admin", async function() {
      await expectRevert(
        this.debridge.addNativeAsset(
          ZERO_ADDRESS,
          0,
          0,
          0,
          0,
          [0],
          [
            {
              transferFee: 0,
              fixedFee: 0,
              isSupported: false,
            },
          ],
          {
            from: bob,
          }
        ),
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
      const supportedChainInfo = await this.debridge.getChainIdSupport(
        debridgeId,
        chainIdTo
      );
      const fees = toBN(supportedChainInfo.transferFee)
        .mul(amount)
        .div(toBN(toWei("1")))
        .add(toBN(supportedChainInfo.fixedFee));
      await this.debridge.send(debridgeId, receiver, amount, chainIdTo, {
        value: amount,
        from: alice,
      });
      const newBalance = toBN(await web3.eth.getBalance(this.debridge.address));
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridge.collectedFees.add(fees).toString(),
        newDebridge.collectedFees.toString()
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
      const supportedChainInfo = await this.debridge.getChainIdSupport(
        debridgeId,
        chainIdTo
      );
      const fees = toBN(supportedChainInfo.transferFee)
        .mul(amount)
        .div(toBN(toWei("1")))
        .add(toBN(supportedChainInfo.fixedFee));
      await this.debridge.send(debridgeId, receiver, amount, chainIdTo, {
        from: alice,
      });
      const newBalance = toBN(
        await this.mockToken.balanceOf(this.debridge.address)
      );
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridge.collectedFees.add(fees).toString(),
        newDebridge.collectedFees.toString()
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
        this.debridge.send(debridgeId, receiver, amount, chainIdTo, {
          value: toWei("0.1"),
          from: alice,
        }),
        "send: amount mismatch"
      );
    });

    it("should reject sending too few tokens", async function() {
      const tokenAddress = ZERO_ADDRESS;
      const receiver = bob;
      const chainId = await this.debridge.chainId();
      const amount = toBN(toWei("0.1"));
      const chainIdTo = 42;
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.debridge.send(debridgeId, receiver, amount, chainIdTo, {
          value: amount,
          from: alice,
        }),
        "send: amount too low"
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
        this.debridge.send(debridgeId, receiver, amount, chainIdTo, {
          value: amount,
          from: alice,
        }),
        "send: wrong targed chain"
      );
    });

    it("should reject sending tokens originated on the other chain", async function() {
      const tokenAddress = ZERO_ADDRESS;
      const receiver = bob;
      const amount = toBN(toWei("1"));
      const chainIdTo = 42;
      const debridgeId = await this.debridge.getDebridgeId(42, tokenAddress);
      await expectRevert(
        this.debridge.send(debridgeId, receiver, amount, chainIdTo, {
          value: amount,
          from: alice,
        }),
        "send: not native chain"
      );
    });
  });

  context("Test mint method", () => {
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const receiver = bob;
    const amount = toBN(toWei("100"));
    const nonce = 2;
    let currentChainId;
    before(async function() {
      currentChainId = await this.debridge.chainId();
      const newSupply = toWei("100");
      await this.linkToken.mint(alice, newSupply, {
        from: alice,
      });
      await this.dbrToken.mint(alice, newSupply, {
        from: alice,
      });
      await this.dbrToken.transferAndCall(
        this.aggregator.address.toString(),
        newSupply,
        "0x",
        {
          from: alice,
        }
      );
      await this.linkToken.transferAndCall(
        this.aggregator.address.toString(),
        newSupply,
        "0x",
        {
          from: alice,
        }
      );
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const submission = await this.debridge.getSubmisionId(
        debridgeId,
        chainId,
        currentChainId,
        amount,
        receiver,
        nonce
      );
      await this.aggregator.submit(submission, {
        from: bob,
      });
    });

    it("should mint when the submission is approved", async function() {
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const debridge = await this.debridge.getDebridge(debridgeId);
      const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);
      const balance = toBN(await wrappedAsset.balanceOf(receiver));
      await this.debridge.mint(debridgeId, chainId, receiver, amount, nonce, {
        from: alice,
      });
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
        this.debridge.mint(debridgeId, chainId, receiver, amount, nonce, {
          from: alice,
        }),
        "mint: not confirmed"
      );
    });

    it("should reject minting twice", async function() {
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.debridge.mint(debridgeId, chainId, receiver, amount, nonce, {
          from: alice,
        }),
        "mint: already used"
      );
    });
  });

  context("Test burn method", () => {
    it("should burning when the amount is suficient", async function() {
      const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      const chainIdTo = 56;
      const receiver = alice;
      const amount = toBN(toWei("100"));
      const debridgeId = await this.debridge.getDebridgeId(
        chainIdTo,
        tokenAddress
      );
      const debridge = await this.debridge.getDebridge(debridgeId);
      const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);
      const balance = toBN(await wrappedAsset.balanceOf(bob));
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
        }
      );
      const newBalance = toBN(await wrappedAsset.balanceOf(bob));
      assert.equal(balance.sub(amount).toString(), newBalance.toString());
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      const supportedChainInfo = await this.debridge.getChainIdSupport(
        debridgeId,
        chainIdTo
      );
      const fees = toBN(supportedChainInfo.transferFee)
        .mul(amount)
        .div(toBN(toWei("1")))
        .add(toBN(supportedChainInfo.fixedFee));
      assert.equal(
        debridge.collectedFees.add(fees).toString(),
        newDebridge.collectedFees.toString()
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

    it("should reject burning too few tokens", async function() {
      const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      const chainId = 56;
      const receiver = bob;
      const amount = toBN(toWei("0.1"));
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
          chainId,
          deadline,
          signature,
          {
            from: alice,
          }
        ),
        "burn: amount too low"
      );
    });
  });

  context("Test claim method", () => {
    const tokenAddress = ZERO_ADDRESS;
    const receiver = bob;
    const amount = toBN(toWei("0.9"));
    const nonce = 4;
    let chainIdFrom = 50;
    let chainId;
    let debridgeId;
    let outsideDebridgeId;
    let erc20DebridgeId;
    before(async function() {
      chainId = await this.debridge.chainId();
      debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
      outsideDebridgeId = await this.debridge.getDebridgeId(
        56,
        "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984"
      );
      erc20DebridgeId = await this.debridge.getDebridgeId(
        chainId,
        this.mockToken.address
      );
      const cuurentChainSubmission = await this.debridge.getSubmisionId(
        debridgeId,
        chainIdFrom,
        chainId,
        amount,
        receiver,
        nonce
      );
      await this.aggregator.submit(cuurentChainSubmission, {
        from: bob,
      });
      const outsideChainSubmission = await this.debridge.getSubmisionId(
        outsideDebridgeId,
        chainIdFrom,
        56,
        amount,
        receiver,
        nonce
      );
      await this.aggregator.submit(outsideChainSubmission, {
        from: bob,
      });
      const erc20Submission = await this.debridge.getSubmisionId(
        erc20DebridgeId,
        chainIdFrom,
        chainId,
        amount,
        receiver,
        nonce
      );
      await this.aggregator.submit(erc20Submission, {
        from: bob,
      });
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
        {
          from: alice,
        }
      );
      const newBalance = toBN(await web3.eth.getBalance(receiver));
      const submissionId = await this.debridge.getSubmisionId(
        debridgeId,
        chainIdFrom,
        await this.debridge.chainId(),
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
        {
          from: alice,
        }
      );
      const newBalance = toBN(await this.mockToken.balanceOf(receiver));
      const submissionId = await this.debridge.getSubmisionId(
        erc20DebridgeId,
        chainIdFrom,
        await this.debridge.chainId(),
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
      const nonce = 1;
      await expectRevert(
        this.debridge.claim(debridgeId, chainIdFrom, receiver, amount, nonce, {
          from: alice,
        }),
        "claim: not confirmed"
      );
    });

    it("should reject claiming the token from outside chain", async function() {
      await expectRevert(
        this.debridge.claim(
          outsideDebridgeId,
          chainIdFrom,
          receiver,
          amount,
          nonce,
          {
            from: alice,
          }
        ),
        "claim: not confirmed"
      );
    });

    it("should reject claiming twice", async function() {
      await expectRevert(
        this.debridge.claim(debridgeId, chainIdFrom, receiver, amount, nonce, {
          from: alice,
        }),
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

  context("Test fund aggregator", async function() {
    const tokenAddress = ZERO_ADDRESS;
    const amount = toBN(toWei("0.0001"));
    let receiver;
    let chainId;
    let debridgeId;
    let outsideDebridgeId;
    let erc20DebridgeId;
    let wethUniPool;
    let mockErc20UniPool;

    before(async function() {
      receiver = this.aggregator.address.toString();
      await this.uniswapFactory.createPair(
        this.linkToken.address,
        this.weth.address,
        {
          from: alice,
        }
      );
      await this.uniswapFactory.createPair(
        this.linkToken.address,
        this.mockToken.address,
        {
          from: alice,
        }
      );
      const wethUniPoolAddres = await this.uniswapFactory.getPair(
        this.linkToken.address,
        this.weth.address
      );
      const mockErc20UniPoolAddress = await this.uniswapFactory.getPair(
        this.linkToken.address,
        this.mockToken.address
      );
      const wethUniPool = await IUniswapV2Pair.at(wethUniPoolAddres);
      const mockErc20UniPool = await IUniswapV2Pair.at(mockErc20UniPoolAddress);
      await this.linkToken.approve(wethUniPool.address, MAX, { from: alice });
      await this.weth.approve(wethUniPool.address, MAX, { from: alice });
      await this.linkToken.approve(mockErc20UniPool.address, MAX, {
        from: alice,
      });
      await this.mockToken.approve(mockErc20UniPool.address, MAX, {
        from: alice,
      });

      await this.linkToken.mint(wethUniPool.address, toWei("100"), {
        from: alice,
      });
      await this.weth.deposit({
        from: carol,
        value: toWei("20"),
      });
      await this.weth.transfer(wethUniPool.address, toWei("10"), {
        from: carol,
      });
      await this.linkToken.mint(mockErc20UniPool.address, toWei("100"), {
        from: alice,
      });
      await this.mockToken.mint(mockErc20UniPool.address, toWei("100"), {
        from: alice,
      });

      await wethUniPool.mint(alice, { from: alice });
      await mockErc20UniPool.mint(alice, { from: alice });

      chainId = await this.debridge.chainId();
      debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
      outsideDebridgeId = await this.debridge.getDebridgeId(42, tokenAddress);
      erc20DebridgeId = await this.debridge.getDebridgeId(
        chainId,
        this.mockToken.address
      );
    });

    it("should fund aggregator of native token if it is called by the admin", async function() {
      const debridge = await this.debridge.getDebridge(debridgeId);
      const balance = toBN(await this.linkToken.balanceOf(receiver));
      await this.debridge.fundAggregator(debridgeId, amount, {
        from: alice,
      });
      const newBalance = toBN(await this.linkToken.balanceOf(receiver));
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(
        debridge.collectedFees.sub(amount).toString(),
        newDebridge.collectedFees.toString()
      );
      assert.ok(newBalance.gt(balance));
    });

    it("should fund aggregator of ERC20 token if it is called by the admin", async function() {
      const debridge = await this.debridge.getDebridge(erc20DebridgeId);
      const balance = toBN(await this.linkToken.balanceOf(receiver));
      await this.debridge.fundAggregator(erc20DebridgeId, amount, {
        from: alice,
      });
      const newBalance = toBN(await this.linkToken.balanceOf(receiver));
      const newDebridge = await this.debridge.getDebridge(erc20DebridgeId);
      assert.equal(
        debridge.collectedFees.sub(amount).toString(),
        newDebridge.collectedFees.toString()
      );
      assert.ok(newBalance.gt(balance));
    });

    it("should reject funding aggregator by non-admin", async function() {
      await expectRevert(
        this.debridge.fundAggregator(debridgeId, amount, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject funding aggregator with too many fees", async function() {
      const amount = toBN(toWei("100"));
      await expectRevert(
        this.debridge.fundAggregator(debridgeId, amount, {
          from: alice,
        }),
        "fundAggregator: not enough fee"
      );
    });

    it("should reject funding aggregator if the token not from current chain", async function() {
      const amount = toBN(toWei("0.1"));
      await expectRevert(
        this.debridge.fundAggregator(outsideDebridgeId, amount, {
          from: alice,
        }),
        "fundAggregator: not enough fee"
      );
    });
  });
});
