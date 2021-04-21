const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = require("./utils.spec");
const WhiteAggregator = artifacts.require("WhiteFullAggregator");
const MockLinkToken = artifacts.require("MockLinkToken");
const MockToken = artifacts.require("MockToken");
const WhiteDebridge = artifacts.require("WhiteFullDebridge");
const WrappedAsset = artifacts.require("WrappedAsset");
const FeeProxy = artifacts.require("FeeProxy");
const UniswapV2Factory = artifacts.require("UniswapV2Factory");
const IUniswapV2Pair = artifacts.require("IUniswapV2Pair");
const DefiController = artifacts.require("DefiController");
const { deployProxy } = require("@openzeppelin/truffle-upgrades");
const WETH9 = artifacts.require("WETH9");
const { toWei, fromWei, toBN } = web3.utils;
const MAX = web3.utils.toTwosComplement(-1);

contract("WhiteFullDebridge", function([alice, bob, carol, eve, devid]) {
  before(async function() {
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
    this.whiteDebridge = await deployProxy(WhiteDebridge, [
      minAmount,
      transferFee,
      minReserves,
      ZERO_ADDRESS,
      supportedChainIds,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
    ]);
  });

  context("Test setting configurations by different users", () => {
    it("should set aggregator if called by the admin", async function() {
      const aggregator = this.whiteAggregator.address;
      await this.whiteDebridge.setAggregator(aggregator, {
        from: alice,
      });
      const newAggregator = await this.whiteDebridge.aggregator();
      assert.equal(aggregator, newAggregator);
    });

    it("should set fee proxy if called by the admin", async function() {
      const feeProxy = this.feeProxy.address;
      await this.whiteDebridge.setFeeProxy(feeProxy, {
        from: alice,
      });
      const newFeeProxy = await this.whiteDebridge.feeProxy();
      assert.equal(feeProxy, newFeeProxy);
    });

    it("should set defi controller if called by the admin", async function() {
      const defiController = this.defiController.address;
      await this.whiteDebridge.setDefiController(defiController, {
        from: alice,
      });
      const newDefiController = await this.whiteDebridge.defiController();
      assert.equal(defiController, newDefiController);
    });

    it("should set weth if called by the admin", async function() {
      const weth = this.weth.address;
      await this.whiteDebridge.setWeth(weth, {
        from: alice,
      });
      const newWeth = await this.whiteDebridge.weth();
      assert.equal(weth, newWeth);
    });

    it("should reject setting aggregator if called by the non-admin", async function() {
      await expectRevert(
        this.whiteDebridge.setAggregator(ZERO_ADDRESS, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject setting fee proxy if called by the non-admin", async function() {
      await expectRevert(
        this.whiteDebridge.setFeeProxy(ZERO_ADDRESS, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject setting defi controller if called by the non-admin", async function() {
      await expectRevert(
        this.whiteDebridge.setDefiController(ZERO_ADDRESS, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject setting weth if called by the non-admin", async function() {
      await expectRevert(
        this.whiteDebridge.setWeth(ZERO_ADDRESS, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });
  });

  context("Test managing assets", () => {
    it("should add external asset if called by the admin", async function() {
      const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      const chainId = 56;
      const minAmount = toWei("100");
      const transferFee = toWei("0.01");
      const minReserves = toWei("0.2");
      const supportedChainIds = [42, 3];
      const name = "MUSD";
      const symbol = "Magic Dollar";
      const wrappedAsset = await WrappedAsset.new(
        name,
        symbol,
        [this.whiteDebridge.address],
        {
          from: alice,
        }
      );
      await this.whiteDebridge.addExternalAsset(
        tokenAddress,
        wrappedAsset.address,
        chainId,
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
      assert.equal(debridge.chainId.toString(), chainId);
      assert.equal(debridge.minAmount.toString(), minAmount);
      assert.equal(debridge.transferFee.toString(), transferFee);
      assert.equal(debridge.collectedFees.toString(), "0");
      assert.equal(debridge.balance.toString(), "0");
      assert.equal(debridge.minReserves.toString(), minReserves);
    });

    it("should add native asset if called by the admin", async function() {
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

    it("should reject adding external asset if called by the non-admin", async function() {
      await expectRevert(
        this.whiteDebridge.addExternalAsset(
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          0,
          0,
          0,
          0,
          [0],
          {
            from: bob,
          }
        ),
        "onlyAdmin: bad role"
      );
    });

    it("should reject setting native asset if called by the non-admin", async function() {
      await expectRevert(
        this.whiteDebridge.addNativeAsset(ZERO_ADDRESS, 0, 0, 0, [0], {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });
  });

  context("Test send method", () => {
    it("should send native tokens from the current chain", async function() {
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

    it("should send ERC20 tokens from the current chain", async function() {
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

    it("should reject sending too mismatched amount of native tokens", async function() {
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

    it("should reject sending too few tokens", async function() {
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

    it("should reject sending tokens to unsupported chain", async function() {
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

    it("should reject sending tokens originated on the other chain", async function() {
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
    const amount = toBN(toWei("100"));
    const nonce = 2;
    before(async function() {
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
        chainId,
        amount,
        receiver,
        nonce
      );
      await this.whiteAggregator.submitMint(submission, {
        from: bob,
      });
    });

    it("should mint when the submission is approved", async function() {
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
        chainId,
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

    it("should reject minting with unconfirmed submission", async function() {
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

    it("should reject minting twice", async function() {
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

  context("Test burn method", () => {
    it("should burning when the amount is suficient", async function() {
      const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      const chainId = 56;
      const receiver = alice;
      const amount = toBN(toWei("100"));
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);
      const balance = toBN(await wrappedAsset.balanceOf(bob));
      await wrappedAsset.approve(this.whiteDebridge.address, amount, {
        from: bob,
      });
      await this.whiteDebridge.burn(debridgeId, receiver, amount, chainId, {
        from: bob,
      });
      const newBalance = toBN(await wrappedAsset.balanceOf(bob));
      assert.equal(balance.sub(amount).toString(), newBalance.toString());
      const newDebridge = await this.whiteDebridge.getDebridge(debridgeId);
      const fees = debridge.transferFee.mul(amount).div(toBN(toWei("1")));
      assert.equal(
        debridge.collectedFees.add(fees).toString(),
        newDebridge.collectedFees.toString()
      );
    });

    it("should reject burning from current chain", async function() {
      const tokenAddress = ZERO_ADDRESS;
      const chainId = await this.whiteDebridge.chainId();
      const receiver = bob;
      const amount = toBN(toWei("1"));
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.whiteDebridge.burn(debridgeId, receiver, amount, 42, {
          from: alice,
        }),
        "burn: native asset"
      );
    });

    it("should reject burning too few tokens", async function() {
      const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      const chainId = 56;
      const receiver = bob;
      const amount = toBN(toWei("0.1"));
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.whiteDebridge.burn(debridgeId, receiver, amount, chainId, {
          from: alice,
        }),
        "burn: amount too low"
      );
    });
  });

  context("Test claim method", () => {
    const tokenAddress = ZERO_ADDRESS;
    const receiver = bob;
    const amount = toBN(toWei("0.9"));
    const nonce = 4;
    let chainId;
    let debridgeId;
    let outsideDebridgeId;
    let erc20DebridgeId;
    before(async function() {
      chainId = await this.whiteDebridge.chainId();
      debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      outsideDebridgeId = await this.whiteDebridge.getDebridgeId(
        56,
        "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984"
      );
      erc20DebridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        this.mockToken.address
      );
      const cuurentChainSubmission = await this.whiteDebridge.getSubmisionId(
        debridgeId,
        chainId,
        amount,
        receiver,
        nonce
      );
      await this.whiteAggregator.submitBurn(cuurentChainSubmission, {
        from: bob,
      });
      const outsideChainSubmission = await this.whiteDebridge.getSubmisionId(
        outsideDebridgeId,
        56,
        amount,
        receiver,
        nonce
      );
      await this.whiteAggregator.submitBurn(outsideChainSubmission, {
        from: bob,
      });
      const erc20Submission = await this.whiteDebridge.getSubmisionId(
        erc20DebridgeId,
        chainId,
        amount,
        receiver,
        nonce
      );
      await this.whiteAggregator.submitBurn(erc20Submission, {
        from: bob,
      });
    });

    it("should claim native token when the submission is approved", async function() {
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      const balance = toBN(await web3.eth.getBalance(receiver));
      await this.whiteDebridge.claim(debridgeId, receiver, amount, nonce, {
        from: alice,
      });
      const newBalance = toBN(await web3.eth.getBalance(receiver));
      const submissionId = await this.whiteDebridge.getSubmisionId(
        debridgeId,
        await this.whiteDebridge.chainId(),
        amount,
        receiver,
        nonce
      );
      const isSubmissionUsed = await this.whiteDebridge.isSubmissionUsed(
        submissionId
      );
      const newDebridge = await this.whiteDebridge.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridge.collectedFees.toString(),
        newDebridge.collectedFees.toString()
      );
      assert.ok(isSubmissionUsed);
    });

    it("should claim ERC20 when the submission is approved", async function() {
      const debridge = await this.whiteDebridge.getDebridge(erc20DebridgeId);
      const balance = toBN(await this.mockToken.balanceOf(receiver));
      await this.whiteDebridge.claim(erc20DebridgeId, receiver, amount, nonce, {
        from: alice,
      });
      const newBalance = toBN(await this.mockToken.balanceOf(receiver));
      const submissionId = await this.whiteDebridge.getSubmisionId(
        erc20DebridgeId,
        await this.whiteDebridge.chainId(),
        amount,
        receiver,
        nonce
      );
      const isSubmissionUsed = await this.whiteDebridge.isSubmissionUsed(
        submissionId
      );
      const newDebridge = await this.whiteDebridge.getDebridge(erc20DebridgeId);
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
        this.whiteDebridge.claim(debridgeId, receiver, amount, nonce, {
          from: alice,
        }),
        "claim: not confirmed"
      );
    });

    it("should reject claiming the token from outside chain", async function() {
      await expectRevert(
        this.whiteDebridge.claim(outsideDebridgeId, receiver, amount, nonce, {
          from: alice,
        }),
        "claim: wrong target chain"
      );
    });

    it("should reject claiming twice", async function() {
      await expectRevert(
        this.whiteDebridge.claim(debridgeId, receiver, amount, nonce, {
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
      chainId = await this.whiteDebridge.chainId();
      debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      outsideDebridgeId = await this.whiteDebridge.getDebridgeId(
        42,
        tokenAddress
      );
      erc20DebridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        this.mockToken.address
      );
    });

    it("should withdraw fee of native token if it is called by the admin", async function() {
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      const balance = toBN(await web3.eth.getBalance(receiver));
      await this.whiteDebridge.withdrawFee(debridgeId, receiver, amount, {
        from: alice,
      });
      const newBalance = toBN(await web3.eth.getBalance(receiver));
      const newDebridge = await this.whiteDebridge.getDebridge(debridgeId);
      assert.equal(
        debridge.collectedFees.sub(amount).toString(),
        newDebridge.collectedFees.toString()
      );
      assert.equal(balance.add(amount).toString(), newBalance.toString());
    });

    it("should withdraw fee of ERC20 token if it is called by the admin", async function() {
      const debridge = await this.whiteDebridge.getDebridge(erc20DebridgeId);
      const balance = toBN(await this.mockToken.balanceOf(receiver));
      await this.whiteDebridge.withdrawFee(erc20DebridgeId, receiver, amount, {
        from: alice,
      });
      const newBalance = toBN(await this.mockToken.balanceOf(receiver));
      const newDebridge = await this.whiteDebridge.getDebridge(erc20DebridgeId);
      assert.equal(
        debridge.collectedFees.sub(amount).toString(),
        newDebridge.collectedFees.toString()
      );
      assert.equal(balance.add(amount).toString(), newBalance.toString());
    });

    it("should reject withdrawing fee by non-admin", async function() {
      await expectRevert(
        this.whiteDebridge.withdrawFee(debridgeId, receiver, amount, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject withdrawing too many fees", async function() {
      const amount = toBN(toWei("100"));
      await expectRevert(
        this.whiteDebridge.withdrawFee(debridgeId, receiver, amount, {
          from: alice,
        }),
        "withdrawFee: not enough fee"
      );
    });

    it("should reject withdrawing fees if the token not from current chain", async function() {
      const amount = toBN(toWei("100"));
      await expectRevert(
        this.whiteDebridge.withdrawFee(outsideDebridgeId, receiver, amount, {
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
      receiver = this.whiteAggregator.address.toString();
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

      chainId = await this.whiteDebridge.chainId();
      debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      outsideDebridgeId = await this.whiteDebridge.getDebridgeId(
        42,
        tokenAddress
      );
      erc20DebridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        this.mockToken.address
      );
    });

    it("should fund aggregator of native token if it is called by the admin", async function() {
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      const balance = toBN(await this.linkToken.balanceOf(receiver));
      await this.whiteDebridge.fundAggregator(debridgeId, amount, {
        from: alice,
      });
      const newBalance = toBN(await this.linkToken.balanceOf(receiver));
      const newDebridge = await this.whiteDebridge.getDebridge(debridgeId);
      assert.equal(
        debridge.collectedFees.sub(amount).toString(),
        newDebridge.collectedFees.toString()
      );
      assert.ok(newBalance.gt(balance));
    });

    it("should fund aggregator of ERC20 token if it is called by the admin", async function() {
      const debridge = await this.whiteDebridge.getDebridge(erc20DebridgeId);
      const balance = toBN(await this.linkToken.balanceOf(receiver));
      await this.whiteDebridge.fundAggregator(erc20DebridgeId, amount, {
        from: alice,
      });
      const newBalance = toBN(await this.linkToken.balanceOf(receiver));
      const newDebridge = await this.whiteDebridge.getDebridge(erc20DebridgeId);
      assert.equal(
        debridge.collectedFees.sub(amount).toString(),
        newDebridge.collectedFees.toString()
      );
      assert.ok(newBalance.gt(balance));
    });

    it("should reject funding aggregator by non-admin", async function() {
      await expectRevert(
        this.whiteDebridge.fundAggregator(debridgeId, amount, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject funding aggregator with too many fees", async function() {
      const amount = toBN(toWei("100"));
      await expectRevert(
        this.whiteDebridge.fundAggregator(debridgeId, amount, {
          from: alice,
        }),
        "fundAggregator: not enough fee"
      );
    });

    it("should reject funding aggregator if the token not from current chain", async function() {
      const amount = toBN(toWei("0.1"));
      await expectRevert(
        this.whiteDebridge.fundAggregator(outsideDebridgeId, amount, {
          from: alice,
        }),
        "fundAggregator: not enough fee"
      );
    });
  });
});
