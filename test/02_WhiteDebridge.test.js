const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS } = require("./utils.spec");
const WhiteAggregator = artifacts.require("WhiteAggregator");
const MockLinkToken = artifacts.require("MockLinkToken");
const WhiteDebridge = artifacts.require("WhiteDebridge");
const FeeProxy = artifacts.require("FeeProxy");
const DefiController = artifacts.require("DefiController");
const WETH9 = artifacts.require("WETH9");
const { toWei, fromWei, toBN } = web3.utils;

contract("WhiteDebridge", function ([alice, bob, carol, eve, devid]) {
  before(async function () {
    this.linkToken = await MockLinkToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.oraclePayment = toWei("0.001");
    this.minConfirmations = 2;
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
    const supportedChainIds = [42];
    this.weth = await WETH9.new({
      from: alice,
    });
    this.whiteDebridge = await WhiteDebridge.new(
      minAmount,
      transferFee,
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
});
