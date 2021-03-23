const { expectRevert } = require("@openzeppelin/test-helpers");
const WhiteAggregator = artifacts.require("WhiteAggregator");
const MockLinkToken = artifacts.require("MockLinkToken");
const { toWei, fromWei } = web3.utils;

contract("WhiteAggregator", function ([alice, bob, carol, eve, devid]) {
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
  });

  it("should have correct initial values", async function () {
    const minConfirmations = await this.whiteAggregator.minConfirmations();
    const allocatedFunds = await this.whiteAggregator.allocatedFunds();
    const availableFunds = await this.whiteAggregator.availableFunds();
    const payment = await this.whiteAggregator.payment();
    const link = await this.whiteAggregator.link();
    assert.equal(minConfirmations, this.minConfirmations);
    assert.equal(allocatedFunds, 0);
    assert.equal(availableFunds, 0);
    assert.equal(payment, this.oraclePayment);
    assert.equal(link, this.linkToken.address);
  });
  // `setMinConfirmations`, `setPayment`, `addOracle`, `removeOracle`
  context("Test setting configurations by different users", () => {
    it("should set min confirmations if called by the admin", async function () {
      const newConfirmations = 2;
      await this.whiteAggregator.setMinConfirmations(newConfirmations, {
        from: alice,
      });
      const minConfirmations = await this.whiteAggregator.minConfirmations();
      assert.equal(minConfirmations, newConfirmations);
    });

    it("should set oracle payment if called by the admin", async function () {
      const newPayment = toWei("0.0001");
      await this.whiteAggregator.setPayment(newPayment, {
        from: alice,
      });
      const payment = await this.whiteAggregator.payment();
      assert.equal(newPayment, payment);
    });

    it("should add new oracle if called by the admin", async function () {
      await this.whiteAggregator.addOracle(devid, eve, {
        from: alice,
      });
      const oracleInfo = await this.whiteAggregator.getRracleInfo(devid);
      assert.ok(oracleInfo.withdrawable, 0);
      assert.ok(oracleInfo.admin, eve);
    });

    it("should remove existed oracle if called by the admin", async function () {
      await this.whiteAggregator.removeOracle(devid, {
        from: alice,
      });
      const oracleInfo = await this.whiteAggregator.getRracleInfo(devid);
      assert.ok(oracleInfo.withdrawable, 0);
      assert.ok(oracleInfo.admin, eve);
    });

    it("should reject setting min confirmations if called by the non-admin", async function () {
      const newConfirmations = 2;
      expectRevert(
        this.whiteAggregator.setMinConfirmations(newConfirmations, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject setting oracle payment if called by the non-admin", async function () {
      const newPayment = toWei("0.0001");
      expectRevert(
        this.whiteAggregator.setPayment(newPayment, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject adding the new oracle if called by the non-admin", async function () {
      expectRevert(
        this.whiteAggregator.addOracle(devid, eve, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject removing the new oracle if called by the non-admin", async function () {
      expectRevert(
        this.whiteAggregator.removeOracle(devid, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });
  });
});
