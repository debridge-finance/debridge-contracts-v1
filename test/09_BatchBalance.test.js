const MockToken = artifacts.require("MockToken");
const BatchBalance = artifacts.require("BatchBalance");
const { toWei } = web3.utils;
const oracleKeys = JSON.parse(process.env.TEST_ORACLE_KEYS);


contract("Batch balance ", function () {
  before(async function () {
    this.signers = await ethers.getSigners();
    aliceAccount = this.signers[0];
    alice = aliceAccount.address;

    this.batchBalance = await BatchBalance.new({
      from: alice,
    });

    this.mockToken = await MockToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.linkToken = await MockToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.dbrToken = await MockToken.new("DBR", "DBR", 6, {
      from: alice,
    });

    await this.mockToken.mint(alice, toWei("1"), {
      from: alice,
    });

    await this.linkToken.mint(alice, toWei("2"), {
      from: alice,
    });

    await this.dbrToken.mint(alice, toWei("3"), {
      from: alice,
    });

  });

  context("Test balance", () => {
    it("Should return correct balances", async function () {
      const info = await this.batchBalance.balanceFor(
        [this.mockToken.address,this.linkToken.address, this.dbrToken.address],
        alice);
      assert.equal(info[0][0].toString(), toWei("1"));
      assert.equal(info[0][1].toString(), toWei("2"));
      assert.equal(info[0][2].toString(), toWei("3"));

      assert.equal(info[1][0].toString(), "18");
      assert.equal(info[1][1].toString(), "18");
      assert.equal(info[1][2].toString(), "6");
    });
  });
});
