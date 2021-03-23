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
      console.log(oracle);
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
});
