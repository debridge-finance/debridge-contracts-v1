const { expectRevert } = require("@openzeppelin/test-helpers");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const OracleManager = artifacts.require("OracleManager");
const GovToken = artifacts.require("GovToken");
const { toWei, fromWei, toBN } = web3.utils;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

contract("OracleManager", function([alice, bob, carol, eve, devid]) {
  before(async function() {
    this.govToken = await GovToken.new(toWei("3200000"), {
      from: alice,
    });
    this.timelock = 2;
    this.oracleManager = await OracleManager.new(
      this.govToken.address,
      this.timelock,
      {
        from: alice,
      }
    );
    await this.oracleManager.addOracle(bob, alice);
  });

  context("Test staking different amounts", () => {
    it("should stake 0 tokens", async function() {
      const amount = 0;
      const prevOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const prevTotalLocked = await this.oracleManager.totalLocked();
      await this.govToken.approve(this.oracleManager.address, MAX_UINT256);
      await this.oracleManager.stake(bob, amount, {
        from: alice,
      });
      const currentOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const currentTotalLocked = await this.oracleManager.totalLocked();
      assert.equal(
        prevOracleInfo.stake.toString(),
        currentOracleInfo.stake.toString()
      );
      assert.equal(prevTotalLocked.toString(), currentTotalLocked.toString());
    });

    it("should stake 100 tokens", async function() {
      const amount = toWei("100");
      const prevOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const prevTotalLocked = await this.oracleManager.totalLocked();
      await this.oracleManager.stake(bob, amount, {
        from: alice,
      });
      const currentOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const currentTotalLocked = await this.oracleManager.totalLocked();
      assert.equal(
        prevOracleInfo.stake.add(toBN(amount)).toString(),
        currentOracleInfo.stake.toString()
      );
      assert.equal(
        prevTotalLocked.add(toBN(amount)).toString(),
        currentTotalLocked.toString()
      );
    });

    it("fail in case of staking too many tokens", async function() {
      const amount = toWei("3200000");
      await expectRevert(
        this.oracleManager.stake(bob, amount, {
          from: alice,
        }),
        "ERC20: transfer amount exceeds balance"
      );
    });
  });

  context("Test request unstaking of different amounts", () => {
    it("should unstake 0 tokens", async function() {
      const amount = 0;
      const prevOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const prevTotalLocked = await this.oracleManager.totalLocked();
      await this.govToken.approve(this.oracleManager.address, MAX_UINT256);
      await this.oracleManager.requestUnstake(bob, alice, amount, {
        from: alice,
      });
      const currentOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const currentTotalLocked = await this.oracleManager.totalLocked();
      assert.equal(
        prevOracleInfo.stake.toString(),
        currentOracleInfo.stake.toString()
      );
      assert.equal(prevTotalLocked.toString(), currentTotalLocked.toString());
    });

    it("should unstake 5 tokens", async function() {
      const amount = toWei("5");
      const prevOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const prevTotalLocked = await this.oracleManager.totalLocked();
      await this.oracleManager.requestUnstake(bob, alice, amount, {
        from: alice,
      });
      const currentOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const currentTotalLocked = await this.oracleManager.totalLocked();
      assert.equal(
        prevOracleInfo.stake.sub(toBN(amount)).toString(),
        currentOracleInfo.stake.toString()
      );
      assert.equal(
        prevTotalLocked.sub(toBN(amount)).toString(),
        currentTotalLocked.toString()
      );
    });

    it("fail in case of unstaking too many tokens", async function() {
      const amount = toWei("3200000");
      await expectRevert(
        this.oracleManager.requestUnstake(bob, alice, amount, {
          from: alice,
        }),
        "requestUnstake: insufficient withdrawable funds"
      );
    });
  });

  context("Test request unstaking permissions", () => {
    it("should unstake by admin", async function() {
      const amount = toWei("10");
      const prevOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const prevTotalLocked = await this.oracleManager.totalLocked();
      await this.govToken.approve(this.oracleManager.address, MAX_UINT256);
      await this.oracleManager.requestUnstake(bob, alice, amount, {
        from: alice,
      });
      const currentOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const currentTotalLocked = await this.oracleManager.totalLocked();
      assert.equal(
        prevOracleInfo.stake.sub(toBN(amount)).toString(),
        currentOracleInfo.stake.toString()
      );
      assert.equal(
        prevTotalLocked.sub(toBN(amount)).toString(),
        currentTotalLocked.toString()
      );
    });

    it("fail in case of unstaking by non admin", async function() {
      const amount = toWei("3");
      await expectRevert(
        this.oracleManager.requestUnstake(bob, alice, amount, {
          from: bob,
        }),
        "requestUnstake: only callable by admin"
      );
    });
  });

  context("Test execute unstaking of different amounts", () => {
    it("should execute unstake", async function() {
      await sleep(2000);
      const withdrawalId = 0;
      const prevWithdrawalInfo = await this.oracleManager.getWithdrawalRequest(
        bob,
        withdrawalId
      );
      const prevOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const prevTotalLocked = await this.oracleManager.totalLocked();
      await this.oracleManager.executeUnstake(bob, withdrawalId, {
        from: alice,
      });
      const currentOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const currentTotalLocked = await this.oracleManager.totalLocked();
      const currentWithdrawalInfo = await this.oracleManager.getWithdrawalRequest(
        bob,
        withdrawalId
      );
      assert.equal(prevWithdrawalInfo.executed, false);
      assert.equal(currentWithdrawalInfo.executed, true);
      assert.equal(
        prevOracleInfo.stake.toString(),
        currentOracleInfo.stake.toString()
      );
      assert.equal(
        prevOracleInfo.stake.toString(),
        currentOracleInfo.stake.toString()
      );
      assert.equal(prevTotalLocked.toString(), currentTotalLocked.toString());
    });

    it("fail in case of execute unstaking before timelock", async function() {
      const amount = toWei("1");
      await this.oracleManager.requestUnstake(bob, alice, amount, {
        from: alice,
      });
      await expectRevert(
        this.oracleManager.executeUnstake(bob, 2, {
          from: alice,
        }),
        "executeUnstake: too early"
      );
    });

    it("fail in case of execute unstaking twice", async function() {
      await expectRevert(
        this.oracleManager.executeUnstake(bob, 0, {
          from: alice,
        }),
        "executeUnstake: already executed"
      );
    });

    it("fail in case of execute unstaking from future", async function() {
      await expectRevert(
        this.oracleManager.executeUnstake(bob, 10, {
          from: alice,
        }),
        "executeUnstake: withdrawal not exists"
      );
    });
  });

  context("Test liquidate different amounts", () => {
    it("should execute liquidate 0 tokens", async function() {
      const amount = toWei("0");
      const prevOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const prevTotalLocked = await this.oracleManager.totalLocked();
      const prevConfiscatedFunds = await this.oracleManager.confiscatedFunds();
      await this.oracleManager.liquidate(bob, amount, {
        from: alice,
      });
      const currentOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const currentTotalLocked = await this.oracleManager.totalLocked();
      const currentConfiscatedFunds = await this.oracleManager.confiscatedFunds();
      assert.equal(
        prevOracleInfo.stake.sub(toBN(amount)).toString(),
        currentOracleInfo.stake.toString()
      );
      assert.equal(
        prevTotalLocked.sub(toBN(amount)).toString(),
        currentTotalLocked.toString()
      );
      assert.equal(
        prevConfiscatedFunds.add(toBN(amount)).toString(),
        currentConfiscatedFunds.toString()
      );
    });

    it("should execute liquidate of normal amount of tokens", async function() {
      const amount = toWei("10");
      const prevOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const prevTotalLocked = await this.oracleManager.totalLocked();
      const prevConfiscatedFunds = await this.oracleManager.confiscatedFunds();
      await this.oracleManager.liquidate(bob, amount, {
        from: alice,
      });
      const currentOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const currentTotalLocked = await this.oracleManager.totalLocked();
      const currentConfiscatedFunds = await this.oracleManager.confiscatedFunds();
      assert.equal(
        prevOracleInfo.stake.sub(toBN(amount)).toString(),
        currentOracleInfo.stake.toString()
      );
      assert.equal(
        prevTotalLocked.sub(toBN(amount)).toString(),
        currentTotalLocked.toString()
      );
      assert.equal(
        prevConfiscatedFunds.add(toBN(amount)).toString(),
        currentConfiscatedFunds.toString()
      );
    });

    it("fail in case of liquidate of too many tokens", async function() {
      const amount = toWei("1000");
      await expectRevert(
        this.oracleManager.liquidate(bob, amount, {
          from: alice,
        }),
        "liquidate: insufficient balance"
      );
    });
  });

  context("Test liquidate by different users", () => {
    it("should execute liquidate by admin", async function() {
      const amount = toWei("2");
      const prevOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const prevTotalLocked = await this.oracleManager.totalLocked();
      const prevConfiscatedFunds = await this.oracleManager.confiscatedFunds();
      await this.oracleManager.liquidate(bob, amount, {
        from: alice,
      });
      const currentOracleInfo = await this.oracleManager.getOracleInfo(bob);
      const currentTotalLocked = await this.oracleManager.totalLocked();
      const currentConfiscatedFunds = await this.oracleManager.confiscatedFunds();
      assert.equal(
        prevOracleInfo.stake.sub(toBN(amount)).toString(),
        currentOracleInfo.stake.toString()
      );
      assert.equal(
        prevTotalLocked.sub(toBN(amount)).toString(),
        currentTotalLocked.toString()
      );
      assert.equal(
        prevConfiscatedFunds.add(toBN(amount)).toString(),
        currentConfiscatedFunds.toString()
      );
    });

    it("fail in case of liquidate by non-admin", async function() {
      const amount = toWei("1");
      await expectRevert(
        this.oracleManager.liquidate(bob, amount, {
          from: carol,
        }),
        "Ownable: caller is not the owner"
      );
    });
  });

  context("Test withdraw different liquidated amounts", () => {
    it("should execute withdrawal of 0 liquidated tokens", async function() {
      const amount = toWei("0");
      const recepient = alice;
      const prevAliceGovBalance = toBN(
        await this.govToken.balanceOf(recepient)
      );
      const prevConfiscatedFunds = await this.oracleManager.confiscatedFunds();
      await this.oracleManager.withdrawFunds(recepient, amount, {
        from: alice,
      });
      const currentAliceGovBalance = toBN(
        await this.govToken.balanceOf(recepient)
      );
      const currentConfiscatedFunds = await this.oracleManager.confiscatedFunds();
      assert.equal(
        prevAliceGovBalance.add(toBN(amount)).toString(),
        currentAliceGovBalance.toString()
      );
      assert.equal(
        prevConfiscatedFunds.sub(toBN(amount)).toString(),
        currentConfiscatedFunds.toString()
      );
    });

    it("should execute liquidate of normal amount of tokens", async function() {
      const amount = toWei("10");
      const recepient = alice;
      const prevAliceGovBalance = toBN(
        await this.govToken.balanceOf(recepient)
      );
      const prevConfiscatedFunds = await this.oracleManager.confiscatedFunds();
      await this.oracleManager.withdrawFunds(recepient, amount, {
        from: alice,
      });
      const currentAliceGovBalance = toBN(
        await this.govToken.balanceOf(recepient)
      );
      const currentConfiscatedFunds = await this.oracleManager.confiscatedFunds();
      assert.equal(
        prevAliceGovBalance.add(toBN(amount)).toString(),
        currentAliceGovBalance.toString()
      );
      assert.equal(
        prevConfiscatedFunds.sub(toBN(amount)).toString(),
        currentConfiscatedFunds.toString()
      );
    });

    it("fail in case of withdrawal of too many tokens", async function() {
      const amount = toWei("1000");
      await expectRevert(
        this.oracleManager.withdrawFunds(alice, amount, {
          from: alice,
        }),
        "withdrawFunds: insufficient reserve funds"
      );
    });
  });

  context("Test withdraw liquidated funds by different users", () => {
    it("should execute withdrawal by the admin", async function() {
      const amount = toWei("1");
      const recepient = alice;
      const prevAliceGovBalance = toBN(
        await this.govToken.balanceOf(recepient)
      );
      const prevConfiscatedFunds = await this.oracleManager.confiscatedFunds();
      await this.oracleManager.withdrawFunds(recepient, amount, {
        from: alice,
      });
      const currentAliceGovBalance = toBN(
        await this.govToken.balanceOf(recepient)
      );
      const currentConfiscatedFunds = await this.oracleManager.confiscatedFunds();
      assert.equal(
        prevAliceGovBalance.add(toBN(amount)).toString(),
        currentAliceGovBalance.toString()
      );
      assert.equal(
        prevConfiscatedFunds.sub(toBN(amount)).toString(),
        currentConfiscatedFunds.toString()
      );
    });

    it("fail in case of withdrawal by non-admin", async function() {
      const amount = toWei("1");
      await expectRevert(
        this.oracleManager.withdrawFunds(alice, amount, {
          from: bob,
        }),
        "Ownable: caller is not the owner"
      );
    });
  });
});
