const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = require("./utils.spec");
const WhiteAggregator = artifacts.require("WhiteAggregator");
const MockLinkToken = artifacts.require("MockLinkToken");
const MockToken = artifacts.require("MockToken");
const WhiteDebridge = artifacts.require("WhiteDebridge");
const WrappedAsset = artifacts.require("WrappedAsset");
const FeeProxy = artifacts.require("FeeProxy");
const DefiController = artifacts.require("DefiController");
const WETH9 = artifacts.require("WETH9");
const { toWei, fromWei, toBN } = web3.utils;

contract("WhiteDebridge", function ([alice, bob, carol, eve, devid]) {
  before(async function () {
    this.mockToken = await MockToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.linkToken = await MockLinkToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.oraclePayment = toWei("0.001");
    this.minConfirmations = 1;
    this.whiteAggregator = await WhiteAggregator.new(
      this.minConfirmations,
      this.oraclePayment,
      this.linkToken.address,
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
      await this.whiteAggregator.addOracle(oracle.address, oracle.admin, {
        from: alice,
      });
    }
    this.feeProxy = await FeeProxy.new(this.linkToken.address, ZERO_ADDRESS, {
      from: alice,
    });
    this.defiController = await DefiController.new({
      from: alice,
    });
    const minAmount = toWei("1");
    const transferFee = toWei("0.001");
    const minReserves = toWei("0.2");
    const supportedChainIds = [42];
    this.weth = await WETH9.new({
      from: alice,
    });
    this.whiteDebridge = await WhiteDebridge.new(
      minAmount,
      transferFee,
      minReserves,
      ZERO_ADDRESS,
      supportedChainIds,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      {
        from: alice,
      }
    );
  });

  context("Test setting configurations by different users", () => {
    it("should set aggregator if called by the admin", async function () {
      const aggregator = this.whiteAggregator.address;
      await this.whiteDebridge.setAggregator(aggregator, {
        from: alice,
      });
      const newAggregator = await this.whiteDebridge.aggregator();
      assert.equal(aggregator, newAggregator);
    });

    it("should set fee proxy if called by the admin", async function () {
      const feeProxy = this.feeProxy.address;
      await this.whiteDebridge.setFeeProxy(feeProxy, {
        from: alice,
      });
      const newFeeProxy = await this.whiteDebridge.feeProxy();
      assert.equal(feeProxy, newFeeProxy);
    });

    it("should set defi controller if called by the admin", async function () {
      const defiController = this.defiController.address;
      await this.whiteDebridge.setDefiController(defiController, {
        from: alice,
      });
      const newDefiController = await this.whiteDebridge.defiController();
      assert.equal(defiController, newDefiController);
    });

    it("should set weth if called by the admin", async function () {
      const weth = this.weth.address;
      await this.whiteDebridge.setWeth(weth, {
        from: alice,
      });
      const newWeth = await this.whiteDebridge.weth();
      assert.equal(weth, newWeth);
    });

    it("should reject setting aggregator if called by the non-admin", async function () {
      await expectRevert(
        this.whiteDebridge.setAggregator(ZERO_ADDRESS, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject setting fee proxy if called by the non-admin", async function () {
      await expectRevert(
        this.whiteDebridge.setFeeProxy(ZERO_ADDRESS, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject setting defi controller if called by the non-admin", async function () {
      await expectRevert(
        this.whiteDebridge.setDefiController(ZERO_ADDRESS, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject setting weth if called by the non-admin", async function () {
      await expectRevert(
        this.whiteDebridge.setWeth(ZERO_ADDRESS, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });
  });

  context("Test managing assets", () => {
    it("should add external asset if called by the admin", async function () {
      const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      const chainId = 56;
      const minAmount = toWei("100");
      const transferFee = toWei("0.01");
      const minReserves = toWei("0.2");
      const supportedChainIds = [42, 3];
      const name = "MUSD";
      const symbol = "Magic Dollar";
      await this.whiteDebridge.addExternalAsset(
        tokenAddress,
        chainId,
        minAmount,
        transferFee,
        minReserves,
        supportedChainIds,
        name,
        symbol,
        {
          from: alice,
        }
      );
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      assert.equal(debridge.chainId.toString(), chainId);
      assert.equal(debridge.minAmount.toString(), minAmount);
      assert.equal(debridge.transferFee.toString(), transferFee);
      assert.equal(debridge.collectedFees.toString(), "0");
      assert.equal(debridge.balance.toString(), "0");
      assert.equal(debridge.minReserves.toString(), minReserves);
    });

    it("should add native asset if called by the admin", async function () {
      const tokenAddress = this.mockToken.address;
      const chainId = await this.whiteDebridge.chainId();
      const minAmount = toWei("100");
      const transferFee = toWei("0.01");
      const minReserves = toWei("0.2");
      const supportedChainIds = [42, 3];
      await this.whiteDebridge.addNativeAsset(
        tokenAddress,
        minAmount,
        transferFee,
        minReserves,
        supportedChainIds,
        {
          from: alice,
        }
      );
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      assert.equal(debridge.tokenAddress, tokenAddress);
      assert.equal(debridge.chainId.toString(), chainId);
      assert.equal(debridge.minAmount.toString(), minAmount);
      assert.equal(debridge.transferFee.toString(), transferFee);
      assert.equal(debridge.collectedFees.toString(), "0");
      assert.equal(debridge.balance.toString(), "0");
      assert.equal(debridge.minReserves.toString(), minReserves);
    });

    it("should reject adding external asset if called by the non-admin", async function () {
      await expectRevert(
        this.whiteDebridge.addExternalAsset(
          ZERO_ADDRESS,
          0,
          0,
          0,
          0,
          [0],
          "name",
          "symbol",
          {
            from: bob,
          }
        ),
        "onlyAdmin: bad role"
      );
    });

    it("should reject setting native asset if called by the non-admin", async function () {
      await expectRevert(
        this.whiteDebridge.addNativeAsset(ZERO_ADDRESS, 0, 0, 0, [0], {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });
  });

  context("Test send method", () => {
    it("should send native tokens from the current chain", async function () {
      const tokenAddress = ZERO_ADDRESS;
      const chainId = await this.whiteDebridge.chainId();
      const receiver = bob;
      const amount = toBN(toWei("1"));
      const chainIdTo = 42;
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const balance = toBN(
        await web3.eth.getBalance(this.whiteDebridge.address)
      );
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      const fees = debridge.transferFee.mul(amount).div(toBN(toWei("1")));
      await this.whiteDebridge.send(debridgeId, receiver, amount, chainIdTo, {
        value: amount,
        from: alice,
      });
      const newBalance = toBN(
        await web3.eth.getBalance(this.whiteDebridge.address)
      );
      const newDebridge = await this.whiteDebridge.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridge.collectedFees.add(fees).toString(),
        newDebridge.collectedFees.toString()
      );
    });

    it("should send ERC20 tokens from the current chain", async function () {
      const tokenAddress = this.mockToken.address;
      const chainId = await this.whiteDebridge.chainId();
      const receiver = bob;
      const amount = toBN(toWei("100"));
      const chainIdTo = 42;
      await this.mockToken.mint(alice, amount, {
        from: alice,
      });
      await this.mockToken.approve(this.whiteDebridge.address, amount, {
        from: alice,
      });
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const balance = toBN(
        await this.mockToken.balanceOf(this.whiteDebridge.address)
      );
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      const fees = debridge.transferFee.mul(amount).div(toBN(toWei("1")));
      await this.whiteDebridge.send(debridgeId, receiver, amount, chainIdTo, {
        from: alice,
      });
      const newBalance = toBN(
        await this.mockToken.balanceOf(this.whiteDebridge.address)
      );
      const newDebridge = await this.whiteDebridge.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridge.collectedFees.add(fees).toString(),
        newDebridge.collectedFees.toString()
      );
    });

    it("should reject sending too mismatched amount of native tokens", async function () {
      const tokenAddress = ZERO_ADDRESS;
      const receiver = bob;
      const chainId = await this.whiteDebridge.chainId();
      const amount = toBN(toWei("1"));
      const chainIdTo = 42;
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.whiteDebridge.send(debridgeId, receiver, amount, chainIdTo, {
          value: toWei("0.1"),
          from: alice,
        }),
        "send: amount mismatch"
      );
    });

    it("should reject sending too few tokens", async function () {
      const tokenAddress = ZERO_ADDRESS;
      const receiver = bob;
      const chainId = await this.whiteDebridge.chainId();
      const amount = toBN(toWei("0.1"));
      const chainIdTo = 42;
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.whiteDebridge.send(debridgeId, receiver, amount, chainIdTo, {
          value: amount,
          from: alice,
        }),
        "send: amount too low"
      );
    });

    it("should reject sending tokens to unsupported chain", async function () {
      const tokenAddress = ZERO_ADDRESS;
      const receiver = bob;
      const chainId = await this.whiteDebridge.chainId();
      const amount = toBN(toWei("1"));
      const chainIdTo = chainId;
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.whiteDebridge.send(debridgeId, receiver, amount, chainIdTo, {
          value: amount,
          from: alice,
        }),
        "send: wrong targed chain"
      );
    });

    it("should reject sending tokens originated on the other chain", async function () {
      const tokenAddress = ZERO_ADDRESS;
      const receiver = bob;
      const amount = toBN(toWei("1"));
      const chainIdTo = 42;
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        42,
        tokenAddress
      );
      await expectRevert(
        this.whiteDebridge.send(debridgeId, receiver, amount, chainIdTo, {
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
    const amount = toBN(toWei("1"));
    const nonce = 2;
    before(async function () {
      const newSupply = toWei("100");
      await this.linkToken.mint(alice, newSupply, {
        from: alice,
      });
      await this.linkToken.transferAndCall(
        this.whiteAggregator.address.toString(),
        newSupply,
        "0x",
        {
          from: alice,
        }
      );
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const submission = await this.whiteDebridge.getSubmisionId(
        debridgeId,
        amount,
        receiver,
        nonce
      );
      await this.whiteAggregator.submitMint(submission, {
        from: bob,
      });
    });

    it("should mint when the submission is approved", async function () {
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);
      const balance = toBN(await wrappedAsset.balanceOf(receiver));
      await this.whiteDebridge.mint(debridgeId, receiver, amount, nonce, {
        from: alice,
      });
      const newBalance = toBN(await wrappedAsset.balanceOf(receiver));
      const submissionId = await this.whiteDebridge.getSubmisionId(
        debridgeId,
        amount,
        receiver,
        nonce
      );
      const isSubmissionUsed = await this.whiteDebridge.isSubmissionUsed(
        submissionId
      );
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.ok(isSubmissionUsed);
    });

    it("should reject minting with unconfirmed submission", async function () {
      const nonce = 4;
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.whiteDebridge.mint(debridgeId, receiver, amount, nonce, {
          from: alice,
        }),
        "mint: not confirmed"
      );
    });

    it("should reject minting twice", async function () {
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.whiteDebridge.mint(debridgeId, receiver, amount, nonce, {
          from: alice,
        }),
        "mint: already used"
      );
    });
  });
});
