const Web3 = require("web3");
const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = require("./utils.spec");
const WhiteFullAggregator = artifacts.require("WhiteFullAggregator");
const WhiteLightAggregator = artifacts.require("WhiteLightAggregator");
const MockLinkToken = artifacts.require("MockLinkToken");
const MockToken = artifacts.require("MockToken");
const WhiteDebridge = artifacts.require("WhiteLightDebridge");
const WrappedAsset = artifacts.require("WrappedAsset");
const DefiController = artifacts.require("DefiController");
const WETH9 = artifacts.require("WETH9");
const { toWei, fromWei, toBN } = web3.utils;
const MAX = web3.utils.toTwosComplement(-1);
const Tx = require("ethereumjs-tx");
const bscWeb3 = new Web3(process.env.BSC_PROVIDER);
const oracleKey = process.env.TEST_ORACLE_KEY;

web3.extend({
  property: "eth",
  methods: [
    {
      name: "getTransaction",
      call: "eth_getTransactionByHash",
      params: 1,
    },
    {
      name: "getRawTransaction",
      call: "eth_getRawTransactionByHash",
      params: 1,
    },
  ],
});

contract("WhiteLightDebridge", function ([alice, bob, carol, eve, devid]) {
  before(async function () {
    this.mockToken = await MockToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.linkToken = await MockLinkToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.oraclePayment = toWei("0.001");
    this.minConfirmations = 1;
    this.fullAggregatorAddress = "0x72736f8c88bd1e438b05acc28c58ac21c5dc76ce";
    this.aggregatorInstance = new web3.eth.Contract(
      WhiteFullAggregator.abi,
      this.fullAggregatorAddress
    );
    this.whiteLightAggregator = await WhiteLightAggregator.new(
      this.minConfirmations,
      [this.fullAggregatorAddress + "80a4", "0x8080"],
      "0x38",
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
      await this.whiteLightAggregator.addOracle(oracle.address, {
        from: alice,
      });
    }
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
      {
        from: alice,
      }
    );
  });

  context("Test setting configurations by different users", () => {
    it("should set aggregator if called by the admin", async function () {
      const aggregator = this.whiteLightAggregator.address;
      await this.whiteDebridge.setAggregator(aggregator, {
        from: alice,
      });
      const newAggregator = await this.whiteDebridge.aggregator();
      assert.equal(aggregator, newAggregator);
    });

    it("should set defi controller if called by the admin", async function () {
      const defiController = this.defiController.address;
      await this.whiteDebridge.setDefiController(defiController, {
        from: alice,
      });
      const newDefiController = await this.whiteDebridge.defiController();
      assert.equal(defiController, newDefiController);
    });

    it("should reject setting aggregator if called by the non-admin", async function () {
      await expectRevert(
        this.whiteDebridge.setAggregator(ZERO_ADDRESS, {
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

    it("should add external native asset if called by the admin", async function () {
      const tokenAddress = "0x0000000000000000000000000000000000000000";
      const chainId = 42;
      const minAmount = toWei("0.0001");
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
    let debridgeId;
    const receiver = bob;
    const amount = toBN(toWei("10"));
    const nonce = 1;
    const tokenAddress = "0x0000000000000000000000000000000000000000";
    const chainId = 42;

    before(async function () {
      debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const submission = await this.whiteDebridge.getSubmisionId(
        debridgeId,
        amount,
        receiver,
        nonce
      );
      const tx = {
        from: bob,
        to: this.fullAggregatorAddress,
        gas: "3000000",
        value: 0,
        gasPrice: toWei("5", "gwei"),
        nonce: 10,
        data: this.aggregatorInstance.methods
          .submitMint(submission)
          .encodeABI(),
      };
      this.signedTx = await bscWeb3.eth.accounts.signTransaction(tx, oracleKey);
    });

    it("should mint when the submission is approved", async function () {
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);
      const balance = toBN(await wrappedAsset.balanceOf(receiver));
      const tx = new Tx(this.signedTx.rawTransaction);
      const rawTx = (({ nonce, from, to, value, gas, gasPrice, input }) => ({
        nonce,
        from,
        to,
        value,
        gas,
        gasPrice,
        input,
      }))(tx);
      const unsignedTx = new Tx(rawTx);
      const serializedUnsignedTx = unsignedTx.serialize().toString("hex");
      const trxData = [
        "0x" +
          serializedUnsignedTx.substr(
            0,
            serializedUnsignedTx.indexOf(
              this.fullAggregatorAddress.slice(2).toLowerCase()
            )
          ),
        "0x" +
          ("00" + tx.r.toString("hex")).slice(-64) +
          ("00" + tx.s.toString("hex")).slice(-64) +
          (tx.v.toString("hex") == "94" ? "1c" : "1b"),
      ];
      await this.whiteDebridge.mint(
        debridgeId,
        receiver,
        amount,
        nonce,
        [trxData],
        {
          from: alice,
        }
      );
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
        this.whiteDebridge.mint(debridgeId, receiver, amount, nonce, [], {
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
        this.whiteDebridge.mint(debridgeId, receiver, amount, nonce, [], {
          from: alice,
        }),
        "mint: already used"
      );
    });
  });

  context("Test burn method", () => {
    it("should burning when the amount is suficient", async function () {
      const tokenAddress = "0x0000000000000000000000000000000000000000";
      const chainId = 42;
      const receiver = alice;
      const amount = toBN("999000000000000");
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
      await this.whiteDebridge.burn(debridgeId, receiver, amount, {
        from: bob,
      });
      const newBalance = toBN(await wrappedAsset.balanceOf(bob));
      assert.equal(balance.sub(amount).toString(), newBalance.toString());
    });

    it("should reject burning from current chain", async function () {
      const tokenAddress = ZERO_ADDRESS;
      const chainId = await this.whiteDebridge.chainId();
      const receiver = bob;
      const amount = toBN(toWei("1"));
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.whiteDebridge.burn(debridgeId, receiver, amount, {
          from: alice,
        }),
        "burn: native asset"
      );
    });

    it("should reject burning too few tokens", async function () {
      const tokenAddress = "0x0000000000000000000000000000000000000000";
      const chainId = 42;
      const receiver = bob;
      const amount = toBN("10");
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.whiteDebridge.burn(debridgeId, receiver, amount, {
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
    before(async function () {
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
      const curentChainSubmission = await this.whiteDebridge.getSubmisionId(
        debridgeId,
        amount,
        receiver,
        nonce
      );
      // const outsideChainSubmission = await this.whiteDebridge.getSubmisionId(
      //   outsideDebridgeId,
      //   amount,
      //   receiver,
      //   nonce
      // );
      // await this.whiteAggregator.submitBurn(outsideChainSubmission, {
      //   from: bob,
      // });
      let tx = {
        from: bob,
        to: this.fullAggregatorAddress,
        gas: "3000000",
        value: 0,
        gasPrice: toWei("5", "gwei"),
        nonce: 10,
        data: this.aggregatorInstance.methods
          .submitBurn(curentChainSubmission)
          .encodeABI(),
      };
      this.signedEthTx = await bscWeb3.eth.accounts.signTransaction(
        tx,
        oracleKey
      );
      const erc20Submission = await this.whiteDebridge.getSubmisionId(
        erc20DebridgeId,
        amount,
        receiver,
        nonce
      );
      tx = {
        from: bob,
        to: this.fullAggregatorAddress,
        gas: "3000000",
        value: 0,
        gasPrice: toWei("5", "gwei"),
        nonce: 10,
        data: this.aggregatorInstance.methods
          .submitBurn(erc20Submission)
          .encodeABI(),
      };
      this.signedErc20Tx = await bscWeb3.eth.accounts.signTransaction(
        tx,
        oracleKey
      );
    });

    it("should claim native token when the submission is approved", async function () {
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      const balance = toBN(await web3.eth.getBalance(receiver));
      const tx = new Tx(this.signedEthTx.rawTransaction);
      const rawTx = (({ nonce, from, to, value, gas, gasPrice, input }) => ({
        nonce,
        from,
        to,
        value,
        gas,
        gasPrice,
        input,
      }))(tx);
      const unsignedTx = new Tx(rawTx);
      const serializedUnsignedTx = unsignedTx.serialize().toString("hex");
      const trxData = [
        "0x" +
          serializedUnsignedTx.substr(
            0,
            serializedUnsignedTx.indexOf(
              this.fullAggregatorAddress.slice(2).toLowerCase()
            )
          ),
        "0x" +
          ("00" + tx.r.toString("hex")).slice(-64) +
          ("00" + tx.s.toString("hex")).slice(-64) +
          (tx.v.toString("hex") == "94" ? "1c" : "1b"),
      ];
      await this.whiteDebridge.claim(
        debridgeId,
        receiver,
        amount,
        nonce,
        [trxData],
        {
          from: alice,
        }
      );
      const newBalance = toBN(await web3.eth.getBalance(receiver));
      const submissionId = await this.whiteDebridge.getSubmisionId(
        debridgeId,
        amount,
        receiver,
        nonce
      );
      const isSubmissionUsed = await this.whiteDebridge.isSubmissionUsed(
        submissionId
      );
      const fees = debridge.transferFee.mul(amount).div(toBN(toWei("1")));
      const newDebridge = await this.whiteDebridge.getDebridge(debridgeId);
      assert.equal(
        balance.add(amount).sub(fees).toString(),
        newBalance.toString()
      );
      assert.equal(
        debridge.collectedFees.add(fees).toString(),
        newDebridge.collectedFees.toString()
      );
      assert.ok(isSubmissionUsed);
    });

    it("should claim ERC20 when the submission is approved", async function () {
      const debridge = await this.whiteDebridge.getDebridge(erc20DebridgeId);
      const balance = toBN(await this.mockToken.balanceOf(receiver));
      const tx = new Tx(this.signedErc20Tx.rawTransaction);
      const rawTx = (({ nonce, from, to, value, gas, gasPrice, input }) => ({
        nonce,
        from,
        to,
        value,
        gas,
        gasPrice,
        input,
      }))(tx);
      const unsignedTx = new Tx(rawTx);
      const serializedUnsignedTx = unsignedTx.serialize().toString("hex");
      const trxData = [
        "0x" +
          serializedUnsignedTx.substr(
            0,
            serializedUnsignedTx.indexOf(
              this.fullAggregatorAddress.slice(2).toLowerCase()
            )
          ),
        "0x" +
          ("00" + tx.r.toString("hex")).slice(-64) +
          ("00" + tx.s.toString("hex")).slice(-64) +
          (tx.v.toString("hex") == "94" ? "1c" : "1b"),
      ];
      await this.whiteDebridge.claim(
        erc20DebridgeId,
        receiver,
        amount,
        nonce,
        [trxData],
        {
          from: alice,
        }
      );
      const newBalance = toBN(await this.mockToken.balanceOf(receiver));
      const submissionId = await this.whiteDebridge.getSubmisionId(
        erc20DebridgeId,
        amount,
        receiver,
        nonce
      );
      const isSubmissionUsed = await this.whiteDebridge.isSubmissionUsed(
        submissionId
      );
      const fees = debridge.transferFee.mul(amount).div(toBN(toWei("1")));
      const newDebridge = await this.whiteDebridge.getDebridge(erc20DebridgeId);
      assert.equal(
        balance.add(amount).sub(fees).toString(),
        newBalance.toString()
      );
      assert.equal(
        debridge.collectedFees.add(fees).toString(),
        newDebridge.collectedFees.toString()
      );
      assert.ok(isSubmissionUsed);
    });

    it("should reject claiming with unconfirmed submission", async function () {
      const nonce = 1;
      await expectRevert(
        this.whiteDebridge.claim(debridgeId, receiver, amount, nonce, [], {
          from: alice,
        }),
        "claim: not confirmed"
      );
    });

    it("should reject claiming twice", async function () {
      await expectRevert(
        this.whiteDebridge.claim(debridgeId, receiver, amount, nonce, [], {
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

    before(async function () {
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

    it("should withdraw fee of native token if it is called by the admin", async function () {
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

    it("should withdraw fee of ERC20 token if it is called by the admin", async function () {
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

    it("should reject withdrawing fee by non-admin", async function () {
      await expectRevert(
        this.whiteDebridge.withdrawFee(debridgeId, receiver, amount, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject withdrawing too many fees", async function () {
      const amount = toBN(toWei("100"));
      await expectRevert(
        this.whiteDebridge.withdrawFee(debridgeId, receiver, amount, {
          from: alice,
        }),
        "withdrawFee: not enough fee"
      );
    });

    it("should reject withdrawing fees if the token not from current chain", async function () {
      const amount = toBN(toWei("100"));
      await expectRevert(
        this.whiteDebridge.withdrawFee(outsideDebridgeId, receiver, amount, {
          from: alice,
        }),
        "withdrawFee: wrong target chain"
      );
    });
  });
});
