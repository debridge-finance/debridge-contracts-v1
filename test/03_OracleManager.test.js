const { expectRevert } = require("@openzeppelin/test-helpers");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const OracleManager = artifacts.require("OracleManager");
const MockLinkToken = artifacts.require("MockLinkToken");
const StrategyController = artifacts.require('StrategyController');
const MockStrategy = artifacts.require('MockStrategy');
const MockPriceConsumer = artifacts.require('MockPriceConsumer');
const { toWei, fromWei, toBN } = web3.utils;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

contract("OracleManager", function([alice, bob, carol, eve, david]) {
  before(async function() {
    this.linkToken = await MockLinkToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    await this.linkToken.mint(alice, toWei("3200000"), {
      from: alice,
    });
    await this.linkToken.mint(david, toWei("3200000"), {
      from: alice,
    });
    await this.linkToken.mint(eve, toWei("3200000"), {
      from: alice,
    });
    this.timelock = 2;
    this.strategyController = await StrategyController.new({ from: alice });
    this.mockStrategy = await MockStrategy.new({ from: alice });
    this.mockPriceConsumer = await MockPriceConsumer.new({ from: alice });
    this.oracleManager = await OracleManager.new(
      this.timelock,
      this.strategyController.address,
      this.mockPriceConsumer.address,
      {
        from: alice,
      }
    );
    await this.oracleManager.addCollatoral(this.linkToken.address);
    await this.oracleManager.addOracle(bob, alice);
    await this.oracleManager.setProfitSharing(bob, 0);
    await this.oracleManager.setUsdAmountOfDelegation(bob, toBN(0));
    await this.oracleManager.addOracle(david, alice);
    await this.oracleManager.setProfitSharing(david, 25);
    await this.oracleManager.setUsdAmountOfDelegation(david, toBN(toWei("500")));
    await this.oracleManager.addDelegator(eve);
    await this.mockPriceConsumer.addPriceFeed(this.linkToken.address, 5);
    await this.strategyController.approveStrategy(this.mockStrategy.address);
    await this.oracleManager.addStrategy(this.mockStrategy.address, 0, 0);
    await this.oracleManager.setTimelockForTransfer(this.timelock);
  });

  context("Test staking different amounts by oracle", () => {
    it("should stake 0 tokens", async function() {
      const amount = 0;
      const collatoralId = 0;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const prevCollatoral = await this.oracleManager.collatorals(collatoralId);
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256);
      await this.oracleManager.stake(bob, collatoralId, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const currentCollatoral = await this.oracleManager.collatorals(collatoralId);
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(prevCollatoral.totalLocked.toString(), currentCollatoral.totalLocked.toString());
    });

    it("should stake 100 tokens", async function() {
      const amount = toWei("100");
      const collatoralId = 0;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const prevCollatoral = await this.oracleManager.collatorals(collatoralId);
      await this.oracleManager.stake(bob, collatoralId, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const currentCollatoral = await this.oracleManager.collatorals(collatoralId);
      assert.equal(
        prevOracleStaking.add(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollatoral.totalLocked.add(toBN(amount)).toString(),
        currentCollatoral.totalLocked.toString()
      );
    });

    it("fail in case of staking too many tokens", async function() {
      const amount = toWei("3200000");
      const collatoralId = 0;
      await expectRevert(
        this.oracleManager.stake(bob, collatoralId, amount, {
          from: alice,
        }),
        "ERC20: transfer amount exceeds balance"
      );
    });

    it("fail in case of staking undefined collatoral", async function() {
      const amount = toWei("10");
      const collatoralId = 1;
      await expectRevert(
        this.oracleManager.stake(bob, collatoralId, amount, {
          from: alice,
        }),
        "stake: undefined collatoral"
      );
    });
  });

  context("Test staking different amounts by delegator", () => {
    it("should stake 0 tokens", async function() {
      const amount = 0;
      const collatoralId = 0;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(david, collatoralId);
      const prevCollatoral = await this.oracleManager.collatorals(collatoralId);
      const prevDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collatoralId);
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: eve });
      await this.oracleManager.stake(david, collatoralId, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(david, collatoralId);
      const currentCollatoral = await this.oracleManager.collatorals(collatoralId);
      const currentDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collatoralId);
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(prevCollatoral.totalLocked.toString(), currentCollatoral.totalLocked.toString());
      assert.equal(prevDelegatorStaking.toString(), currentDelegatorStaking.toString());
    });

    it("should stake 50 tokens", async function() {
      const amount = toWei("50");
      const collatoralId = 0;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(david, collatoralId);
      const prevCollatoral = await this.oracleManager.collatorals(collatoralId);
      const prevDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collatoralId);;
      await this.oracleManager.stake(david, collatoralId, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(david, collatoralId);
      const currentCollatoral = await this.oracleManager.collatorals(collatoralId);
      const currentDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collatoralId);
      assert.equal(
        prevOracleStaking.add(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollatoral.totalLocked.add(toBN(amount)).toString(),
        currentCollatoral.totalLocked.toString()
      );
      assert.equal(
        prevDelegatorStaking.add(toBN(amount)).toString(),
        currentDelegatorStaking.toString()
      )
    });

    it("fail in case of staking to oracle which does not accept delegation", async function() {
      const amount = toWei("100");
      const collatoralId = 0;
      await expectRevert(
        this.oracleManager.stake(bob, collatoralId, amount, {
          from: eve,
        }),
        "stake: amount of delegation is limited"
      );
    });

    it("fail in case of staking exceed for delegators", async function() {
      const amount = toWei("20");
      const collatoralId = 0;
      await expectRevert(
        this.oracleManager.stake(david, collatoralId, amount, {
          from: eve,
        }),
        "stake: amount of delegation is limited"
      );
    });
  });

  context("Test request unstaking of different amounts by oracle", () => {
    it("should unstake 0 tokens", async function() {
      const amount = 0;
      const collatoralId = 0;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const prevCollatoral = await this.oracleManager.collatorals(collatoralId);
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256);
      await this.oracleManager.requestUnstake(bob, collatoralId, alice, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const currentCollatoral = await this.oracleManager.collatorals(collatoralId);
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(prevCollatoral.totalLocked.toString(), currentCollatoral.totalLocked.toString());
    });

    it("should unstake 5 tokens", async function() {
      const amount = toWei("5");
      const collatoralId = 0;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const prevCollatoral = await this.oracleManager.collatorals(collatoralId);
      await this.oracleManager.requestUnstake(bob, collatoralId, alice, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const currentCollatoral = await this.oracleManager.collatorals(collatoralId);
      assert.equal(
        prevOracleStaking.sub(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollatoral.totalLocked.sub(toBN(amount)).toString(),
        currentCollatoral.totalLocked.toString()
      );
    });

    it("fail in case of unstaking too many tokens", async function() {
      const amount = toWei("3200000");
      const collatoralId = 0;
      await expectRevert(
        this.oracleManager.requestUnstake(bob, collatoralId, alice, amount, {
          from: alice,
        }),
        "requestUnstake: insufficient withdrawable funds"
      );
    });

    it("fail in case of unstaking undefined collatoral", async function() {
      const amount = toWei("10");
      const collatoralId = 1;
      await expectRevert(
        this.oracleManager.requestUnstake(bob, collatoralId, alice, amount, {
          from: alice,
        }),
        "requestUnstake: undefined collatoral"
      );
    });
  });

  context("Test request unstaking of different amounts by delegator", () => {
    before(async function() {
      const amount = toWei("100");
      const collatoralId = 0;
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: david });
      await this.oracleManager.stake(david, collatoralId, amount, {
        from: david,
      });
    });

    it("should unstake 0 tokens", async function() {
      const amount = 0;
      const collatoralId = 0;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(david, collatoralId);
      const prevCollatoral = await this.oracleManager.collatorals(collatoralId);
      const prevDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collatoralId);
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: david });
      await this.oracleManager.requestUnstake(david, collatoralId, alice, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(david, collatoralId);
      const currentCollatoral = await this.oracleManager.collatorals(collatoralId);
      const currentDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collatoralId);
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(prevCollatoral.totalLocked.toString(), currentCollatoral.totalLocked.toString());
      assert.equal(
        prevDelegatorStaking.toString(),
        currentDelegatorStaking.toString()
      );
    });

    it("should unstake 5 tokens", async function() {
      const amount = toWei("5");
      const collatoralId = 0;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(david, collatoralId);
      const prevCollatoral = await this.oracleManager.collatorals(collatoralId);
      const prevDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collatoralId);
      await this.oracleManager.requestUnstake(david, collatoralId, alice, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(david, collatoralId);
      const currentCollatoral = await this.oracleManager.collatorals(collatoralId);
      const currentDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collatoralId);
      assert.equal(
        prevOracleStaking.sub(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollatoral.totalLocked.sub(toBN(amount)).toString(),
        currentCollatoral.totalLocked.toString()
      );
      assert.equal(
        prevDelegatorStaking.toString(),
        currentDelegatorStaking.add(toBN(amount)).toString()
      )
    });
    
    it("should fail in case of request unstaking insufficient amount by delegator", async function() {
      const amount = toWei("55");
      const collatoralId = 0;
      await expectRevert(
        this.oracleManager.requestUnstake(david, collatoralId, alice, amount, {
          from: eve,
        }),
        "requestUnstake: insufficient amount"
      );
    });
  });

  context("Test request unstaking permissions", () => {
    it("should unstake by admin", async function() {
      const amount = toWei("10");
      const collatoralId = 0;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const prevCollatoral = await this.oracleManager.collatorals(collatoralId);
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256);
      await this.oracleManager.requestUnstake(bob, collatoralId, alice, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const currentCollatoral = await this.oracleManager.collatorals(collatoralId);
      assert.equal(
        prevOracleStaking.sub(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollatoral.totalLocked.sub(toBN(amount)).toString(),
        currentCollatoral.totalLocked.toString()
      );
    });

    it("fail in case of unstaking by non admin", async function() {
      const amount = toWei("3");
      const collatoralId = 0;
      await expectRevert(
        this.oracleManager.requestUnstake(bob, collatoralId, alice, amount, {
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
      const collatoralId = prevWithdrawalInfo.collatoralId;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const prevCollatoral = await this.oracleManager.collatorals(collatoralId);
      await this.oracleManager.executeUnstake(bob, withdrawalId, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const currentCollatoral = await this.oracleManager.collatorals(collatoralId);
      const currentWithdrawalInfo = await this.oracleManager.getWithdrawalRequest(
        bob,
        withdrawalId
      );
      assert.equal(prevWithdrawalInfo.executed, false);
      assert.equal(currentWithdrawalInfo.executed, true);
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(prevCollatoral.totalLocked.toString(), currentCollatoral.totalLocked.toString());
    });

    it("fail in case of execute unstaking before timelock", async function() {
      const amount = toWei("1");
      const collatoralId = 0;
      await this.oracleManager.requestUnstake(bob, collatoralId, alice, amount, {
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
      const collatoralId = 0;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const prevCollatoral = await this.oracleManager.collatorals(collatoralId);
      await this.oracleManager.liquidate(bob, collatoralId, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const currentCollatoral = await this.oracleManager.collatorals(collatoralId);
      assert.equal(
        prevOracleStaking.sub(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollatoral.totalLocked.sub(toBN(amount)).toString(),
        currentCollatoral.totalLocked.toString()
      );
      assert.equal(
        prevCollatoral.confiscatedFunds.add(toBN(amount)).toString(),
        currentCollatoral.confiscatedFunds.toString()
      );
    });

    it("should execute liquidate of normal amount of tokens", async function() {
      const amount = toWei("10");
      const collatoralId = 0;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const prevCollatoral = await this.oracleManager.collatorals(collatoralId);
      await this.oracleManager.liquidate(bob, collatoralId, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const currentCollatoral = await this.oracleManager.collatorals(collatoralId);
      assert.equal(
        prevOracleStaking.sub(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollatoral.totalLocked.sub(toBN(amount)).toString(),
        currentCollatoral.totalLocked.toString()
      );
      assert.equal(
        prevCollatoral.confiscatedFunds.add(toBN(amount)).toString(),
        currentCollatoral.confiscatedFunds.toString()
      );
    });

    it("fail in case of liquidate of too many tokens", async function() {
      const amount = toWei("1000");
      const collatoralId = 0;
      await expectRevert(
        this.oracleManager.liquidate(bob, collatoralId, amount, {
          from: alice,
        }),
        "liquidate: insufficient balance"
      );
    });
  });

  context("Test liquidate by different users", () => {
    it("should execute liquidate by admin", async function() {
      const amount = toWei("2");
      const collatoralId = 0;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const prevCollatoral = await this.oracleManager.collatorals(collatoralId);
      await this.oracleManager.liquidate(bob, collatoralId, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const currentCollatoral = await this.oracleManager.collatorals(collatoralId);
      assert.equal(
        prevOracleStaking.sub(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollatoral.totalLocked.sub(toBN(amount)).toString(),
        currentCollatoral.totalLocked.toString()
      );
      assert.equal(
        prevCollatoral.confiscatedFunds.add(toBN(amount)).toString(),
        currentCollatoral.confiscatedFunds.toString()
      );
    });

    it("fail in case of liquidate by non-admin", async function() {
      const amount = toWei("1");
      const collatoralId = 0;
      await expectRevert(
        this.oracleManager.liquidate(bob, collatoralId, amount, {
          from: carol,
        }),
        "Ownable: caller is not the owner"
      );
    });
  });

  context("Test withdraw different liquidated amounts", () => {
    it("should execute withdrawal of 0 liquidated tokens", async function() {
      const amount = toWei("0");
      const collatoralId = 0;
      const recepient = alice;
      const prevAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const prevCollatoral = await this.oracleManager.collatorals(collatoralId);
      await this.oracleManager.withdrawFunds(recepient, collatoralId, amount, {
        from: alice,
      });
      const currentAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const currentCollatoral = await this.oracleManager.collatorals(collatoralId);
      assert.equal(
        prevAliceGovBalance.add(toBN(amount)).toString(),
        currentAliceGovBalance.toString()
      );
      assert.equal(
        prevCollatoral.confiscatedFunds.sub(toBN(amount)).toString(),
        currentCollatoral.confiscatedFunds.toString()
      );
    });

    it("should execute liquidate of normal amount of tokens", async function() {
      const amount = toWei("10");
      const collatoralId = 0;
      const recepient = alice;
      const prevAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const prevCollatoral = await this.oracleManager.collatorals(collatoralId);
      await this.oracleManager.withdrawFunds(recepient, collatoralId, amount, {
        from: alice,
      });
      const currentAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const currentCollatoral = await this.oracleManager.collatorals(collatoralId);
      assert.equal(
        prevAliceGovBalance.add(toBN(amount)).toString(),
        currentAliceGovBalance.toString()
      );
      assert.equal(
        prevCollatoral.confiscatedFunds.sub(toBN(amount)).toString(),
        currentCollatoral.confiscatedFunds.toString()
      );
    });

    it("fail in case of withdrawal of too many tokens", async function() {
      const amount = toWei("1000");
      const collatoralId = 0;
      await expectRevert(
        this.oracleManager.withdrawFunds(alice, collatoralId, amount, {
          from: alice,
        }),
        "withdrawFunds: insufficient reserve funds"
      );
    });
  });

  context("Test withdraw liquidated funds by different users", () => {
    it("should execute withdrawal by the admin", async function() {
      const amount = toWei("1");
      const collatoralId = 0;
      const recepient = alice;
      const prevAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const prevCollatoral = await this.oracleManager.collatorals(collatoralId);
      await this.oracleManager.withdrawFunds(recepient, collatoralId, amount, {
        from: alice,
      });
      const currentAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const currentCollatoral = await this.oracleManager.collatorals(collatoralId);
      assert.equal(
        prevAliceGovBalance.add(toBN(amount)).toString(),
        currentAliceGovBalance.toString()
      );
      assert.equal(
        prevCollatoral.confiscatedFunds.sub(toBN(amount)).toString(),
        currentCollatoral.confiscatedFunds.toString()
      );
    });

    it("fail in case of withdrawal by non-admin", async function() {
      const amount = toWei("1");
      const collatoralId = 0;
      await expectRevert(
        this.oracleManager.withdrawFunds(alice, collatoralId, amount, {
          from: bob,
        }),
        "Ownable: caller is not the owner"
      );
    });
  });

  context("Test request transfering assets", () => {
    it("should request transfer non asset", async function() {
      const amount = toWei("0");
      const collatoralId = 0;
      const prevOracleFromStake = await this.oracleManager.getOracleStaking(david, collatoralId);
      const prevOracleToStake = await this.oracleManager.getOracleStaking(bob, collatoralId);
      await this.oracleManager.requestTransfer(david, bob, collatoralId, amount, { from: eve });
      const currentOracleFromStake = await this.oracleManager.getOracleStaking(david, collatoralId);
      const currentOracleToStake = await this.oracleManager.getOracleStaking(bob, collatoralId);
      assert.equal(
        prevOracleFromStake.toString(),
        currentOracleFromStake.add(toBN(amount)).toString()
      );
      assert.equal(
        prevOracleToStake.add(toBN(amount)).toString(),
        currentOracleToStake.toString()
      );
    });
    it("should transfer normal amount of assets", async function() {
      const amount = toWei("10");
      const collatoralId = 0;
      const prevOracleFromStake = await this.oracleManager.getOracleStaking(david, collatoralId);
      const prevOracleToStake = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const prevDelegatorStakingFrom = await this.oracleManager.getDelegatorStakes(david, eve, collatoralId);
      const prevDelegatorStakingTo = await this.oracleManager.getDelegatorStakes(bob, eve, collatoralId);
      await this.oracleManager.requestTransfer(david, bob, collatoralId, amount, { from: eve });
      const currentOracleFromStake = await this.oracleManager.getOracleStaking(david, collatoralId);
      const currentOracleToStake = await this.oracleManager.getOracleStaking(bob, collatoralId);
      const currentDelegatorStakingFrom = await this.oracleManager.getDelegatorStakes(david, eve, collatoralId);
      const currentDelegatorStakingTo = await this.oracleManager.getDelegatorStakes(bob, eve, collatoralId);

      assert.equal(
        prevOracleFromStake.toString(),
        currentOracleFromStake.add(toBN(amount)).toString()
      );
      assert.equal(
        prevOracleToStake.add(toBN(amount)).toString(),
        currentOracleToStake.toString()
      );
      assert.equal(
        prevDelegatorStakingFrom.toString(),
        currentDelegatorStakingFrom.add(toBN(amount)).toString(),
      );
      assert.equal(
        prevDelegatorStakingTo.add(toBN(amount)).toString(),
        currentDelegatorStakingTo.toString()
      );
    });
    it("should reject while transferring too many assets", async function() {
      const amount = toWei("50");
      const collatoralId = 0;
      await expectRevert(this.oracleManager.requestTransfer(david, bob, collatoralId, amount, { from: eve }), "transferAssets: Insufficient amount for delegator");
    });
    it("should reject when transfer by oracle", async function() {
      const amount = toWei("10");
      const collatoralId = 0;
      await expectRevert(this.oracleManager.requestTransfer(david, bob, collatoralId, amount, { from: bob }), "requestTransfer: callable by delegator");
    });
  });

  context("Test execute transfering asset", () => {
    it("should execute transfer", async function() {
      sleep(2);
      const transferId = 1;
      await this.oracleManager.executeTransfer(transferId, { from: eve });
      const currentTransferRequest = await this.oracleManager.getTransferRequest(eve, transferId, { from: eve });
      assert.equal(currentTransferRequest.executed, true);
    });
    it("should fail if called by oracle", async function() {
      const transferId = 0;
      await expectRevert(
        this.oracleManager.executeTransfer(transferId, { from: bob }),
        "executeTransfer: callable by delegator"
      );
    });
    it("should fail if transfer does not exist", async function() {
      const transferId = 2;
      await expectRevert(
        this.oracleManager.executeTransfer(transferId, { from: eve }),
        "executeTransfer: transfer request not exist"
      );
    });
  });

  context("Test account asset", () => {
    it ("should pay for oracle who set profit sharing as zero", async function() {
      const collatoralId = 0;
      const amount = toWei("100");
      const prevOracleStake = await this.oracleManager.getOracleStaking(bob, collatoralId);
      await this.oracleManager.account_asset(bob, collatoralId, amount);
      const currentOracleStake = await this.oracleManager.getOracleStaking(bob, collatoralId);

      assert.equal(prevOracleStake.add(toBN(amount)).toString(), currentOracleStake.toString());
    });
    it ("should pay for oracle who shares profit with delegators", async function() {
      const collatoralId = 0;
      const amount = toWei("100"), amountForDelegator = toWei("25");
      const prevOracleStake = await this.oracleManager.getOracleStaking(david, collatoralId);
      const prevDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collatoralId);
      await this.oracleManager.account_asset(david, collatoralId, amount);
      const currentOracleStake = await this.oracleManager.getOracleStaking(david, collatoralId);
      const currentDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collatoralId);

      assert.equal(prevOracleStake.add(toBN(amount)).toString(), currentOracleStake.toString(), "oracle staking");
      assert.equal(prevDelegatorStaking.add(toBN(amountForDelegator)).toString(), currentDelegatorStaking.toString(), "delegator staking");
    });
  });

  context("Test deposit to strategy", () => {
    it("should decrease staking after deposit", async function() {
      const amount = toWei("10");
      const collatoralId = 0;
      const strategy = 0;

      const prevOracleStake = await this.oracleManager.getOracleStaking(bob, collatoralId);
      await this.oracleManager.depositToStrategy(bob, amount, strategy);
      const currentOracleStake = await this.oracleManager.getOracleStaking(bob, collatoralId);
      
      assert.equal(
        prevOracleStake.toString(),
        currentOracleStake.add(toBN(amount)).toString()
      );
    });
    it("should fail when deposit insufficient fund", async function() {
      const amount = toWei("320000");
      const strategy = 0;
      await expectRevert(this.oracleManager.depositToStrategy(bob, amount, strategy, { from: alice }), "depositToStrategy: Insufficient fund");
    });
  });

  context("Test withdraw from strategy", () => {
    it("should increase staking after withdraw", async function() {
      const amount = toWei("10");
      const collatoralId = 0;
      const strategy = 0;

      const prevOracleStake = await this.oracleManager.getOracleStaking(bob, collatoralId);
      await this.oracleManager.withdrawFromStrategy(bob, amount, strategy);
      const currentOracleStake = await this.oracleManager.getOracleStaking(bob, collatoralId);
      
      assert.equal(
        prevOracleStake.add(toBN(amount)).toString(),
        currentOracleStake.toString()
      );
    });
  });
});
