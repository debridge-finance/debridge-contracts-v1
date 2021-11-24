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
    this.dbrToken = await MockToken.new("DBR", "DBR", 18, {
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
      const balances = await this.batchBalance.balanceOf(
        [this.mockToken.address,this.linkToken.address, this.dbrToken.address],
        alice);

      assert.equal(balances[0].toString(), toWei("1"));
      assert.equal(balances[1].toString(), toWei("2"));
      assert.equal(balances[2].toString(), toWei("3"));
    });
  });
});
