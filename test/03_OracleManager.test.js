const { expectRevert } = require("@openzeppelin/test-helpers");
const { current } = require("@openzeppelin/test-helpers/src/balance");
const { MAX_UINT256, ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const OracleManager = artifacts.require("OracleManager");
const MockLinkToken = artifacts.require("MockLinkToken");
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
    this.mockStrategy = await MockStrategy.new({ from: alice });
    this.mockPriceConsumer = await MockPriceConsumer.new({ from: alice });
    this.oracleManager = await OracleManager.new(
      this.timelock,
      this.mockPriceConsumer.address,
      {
        from: alice,
      }
    );
    await this.oracleManager.addCollateral(this.linkToken.address, 18, false);
    await this.oracleManager.updateCollateral(this.linkToken.address, false, 0);
    await this.oracleManager.addOracle(bob, alice);
    await this.oracleManager.setProfitSharing(bob, 0);
    await this.oracleManager.addOracle(david, alice);
    await this.oracleManager.setProfitSharing(david, 25);
    await this.mockPriceConsumer.addPriceFeed(this.linkToken.address, 5);
    await this.oracleManager.updateStrategy(this.mockStrategy.address);
    await this.oracleManager.addStrategy(this.mockStrategy.address, this.linkToken.address, this.linkToken.address);
    await this.oracleManager.setTimelockForTransfer(this.timelock);
  });

  context("Test staking different amounts by oracle", () => {
    it("should stake 0 tokens", async function() {
      const amount = 0;
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const prevCollateral = await this.oracleManager.collaterals(collateral);
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: alice });
      await this.oracleManager.stake(bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const currentCollateral = await this.oracleManager.collaterals(collateral);
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(prevCollateral.totalLocked.toString(), currentCollateral.totalLocked.toString());
    });

    it("should stake 100 tokens", async function() {
      const amount = toWei("100");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const prevCollateral = await this.oracleManager.collaterals(collateral);
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: alice });
      await this.oracleManager.stake(bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const currentCollateral = await this.oracleManager.collaterals(collateral);
      assert.equal(
        prevOracleStaking.add(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollateral.totalLocked.add(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
    });

    it("fail in case of staking too many tokens", async function() {
      const amount = toWei("3200000");
      const collateral = this.linkToken.address;
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: alice });
      await expectRevert(
        this.oracleManager.stake(bob, collateral, amount, {
          from: alice,
        }),
        "ERC20: transfer amount exceeds balance"
      );
    });

    it("fail in case of staking undefined collateral", async function() {
      const amount = toWei("10");
      const collateral = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: alice });
      await expectRevert(
        this.oracleManager.stake(bob, collateral, amount, {
          from: alice,
        }),
        "stake: collateral is not enabled"
      );
    });

    it("fail in case of staking collateral not enabled", async function() {
      const amount = toWei("10");
      await this.oracleManager.updateCollateral(this.linkToken.address, false);
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: alice });
      await expectRevert(
        this.oracleManager.stake(bob, collateral, amount, {
          from: alice,
        }),
        "stake: collateral is not enabled"
      );
    });

    it("pass in case of collateral staking not exceeded", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.oracleManager.updateCollateral(collateral, true, 100);
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const prevCollateral = await this.oracleManager.collaterals(collateral)
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: alice });
      await this.oracleManager.stake(bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const currentCollateral = await this.oracleManager.collaterals(collateral);
      assert.equal(
        prevOracleStaking.add(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollateral.totalLocked.add(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
    });

    it("fail in case of collateral staking exceeded", async function() {
      const amount = toWei("1000");
      await this.oracleManager.updateCollateral(this.linkToken.address, true, 100);
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: alice });
      await expectRevert(
        this.oracleManager.stake(bob, collateral, amount, {
          from: alice,
        }),
        "stake: amount of collateral staking is limited"
      );
    });

    it("fail in case of sender not oracle admin", async function() {
      const amount = toWei("10");
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: alice });
      await expectRevert(
        this.oracleManager.stake(bob, collateral, amount, {
          from: carol,
        }),
      "stake: only callable by admin"
      );
    });
  });

  context("Test staking different amounts by delegator", () => {
    it("should stake 0 tokens", async function() {
      const amount = 0;
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(david, collateral);
      const prevCollateral = await this.oracleManager.collaterals(collateral);
      const prevDelegation = await this.oracleManager.getTotalDelegation(david, collateral);
      const prevDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collateral);
      const prevDelegatorShares = await this.oracleManager.getDelegatorShares(david, eve, collateral);
      const prevTotalOracleShares = await this.oracleManager.getOracle(david).stake[collateral].shares;
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: eve });
      await this.oracleManager.stake(david, collateral, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(david, collateral);
      const currentCollateral = await this.oracleManager.collaterals(collateral);
      const currentDelegation = await this.oracleManager.getTotalDelegation(david, collateral);
      const currentDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collateral);
      const currentDelegatorShares = await this.oracleManager.getDelegatorShares(david, eve, collateral);
      const currentTotalOracleShares = await this.oracleManager.getOracle(david).stake[collateral].shares;
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(prevCollateral.totalLocked.toString(), currentCollateral.totalLocked.toString());
      assert.equal(prevDelegation.toString(), currentDelegation.toString());
      assert.equal(prevDelegatorStaking.toString(), currentDelegatorStaking.toString());
      assert.equal(prevDelegatorShares.toString(), currentDelegatorShares.toString());
      assert.equal(prevTotalOracleShares.toString(), currentTotalOracleShares.toString());
    });

    it("should stake 50 tokens", async function() {
      const amount = toWei("50");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(david, collateral);
      const prevCollateral = await this.oracleManager.collaterals(collateral);
      const prevDelegation = await this.oracleManager.getTotalDelegation(david, collateral);
      const prevDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collateral);
      const prevDelegatorShares = await this.oracleManager.getDelegatorShares(david, eve, collateral);
      const prevTotalOracleShares = await this.oracleManager.getOracle(david).stake[collateral].shares;
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: eve });
      await this.oracleManager.stake(david, collateral, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(david, collateral);
      const currentCollateral = await this.oracleManager.collaterals(collateral);
      const currentDelegation = await this.oracleManager.getTotalDelegation(david, collateral);
      const currentDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collateral);
      const currentDelegatorShares = await this.oracleManager.getDelegatorShares(david, eve, collateral);
      const currentTotalOracleShares = await this.oracleManager.getOracle(david).stake[collateral].shares;
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollateral.totalLocked.add(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
      assert.equal(
        prevDelegation.add(toBN(amount)).toString(),
        currentDelegation.toString()
      );
      assert.equal(
        prevDelegatorStaking.add(toBN(amount)).toString(),
        currentDelegatorStaking.toString()
      );
      assert.isAbove(currentDelegatorShares, prevDelegatorShares, "number of delegator shares increases");
      assert.isAbove(currentTotalOracleShares, prevTotalOracleShares, "number of total oracle shares increases");
    });

    it("pass in case of collateral staking not exceeded", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.oracleManager.updateCollateral(collateral, true, 100);
      const prevOracleStaking = await this.oracleManager.getOracleStaking(eve, collateral);
      const prevCollateral = await this.oracleManager.collaterals(collateral);
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: eve });
      await this.oracleManager.stake(david, collateral, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(eve, collateral);
      const currentCollateral = await this.oracleManager.collaterals(collateral);
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollateral.totalLocked.add(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
    });

    it("fail in case of collateral staking exceed", async function() {
      const amount = toWei("1000");
      await this.oracleManager.updateCollateral(this.linkToken.address, true, 100);
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: eve });
      await expectRevert(
        this.oracleManager.stake(david, collateral, amount, {
          from: eve,
        }),
        "stake: amount of collateral staking is limited"
      );
    });

    it("test delegator admin is set to sender if admin zero address", async function() {
      const amount = toWei("50");
      const previousAdmin = await this.oracleManager.getOracle(carol).admin;
      assert.equal(
        previousAdmin.toString(),
        ZERO_ADDRESS
      );
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: carol });
      await this.oracleManager.stake(david, this.linkToken.address, amount, {
        from: carol,
      });
      const currentAdmin = await this.oracleManager.getOracle(carol).admin;
      assert.equal(
        currentAdmin.toString(),
        carol
      );
    });
    
    it("should fail if delagation to address is not oracle", async function() {
      const amount = toWei("50");
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: carol });
      await expectRevert(
        this.oracleManager.stake(eve, collateral, amount, {
          from: carol,
        }),
        "stake: only delegation to oracle"
      );
    });

    it("should increment oracle delegator count if not exist", async function() {
      const amount = toWei("50");
      const previousCount = await this.oracleManager.getOracle(david).delegatorCount;
      assert.equal(
        previousCount.toString(),
        "0"
      );
      assert.equal(await this.oracleManager.getOracle(david).delegators[eve].exist, false);
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: eve });
      await this.oracleManager.stake(david, this.linkToken.address, amount, {
        from: eve,
      });
      const currentCount = await this.oracleManager.getOracle(david).delegatorCount;
      assert.equal(await this.oracleManager.getOracle(david).delegators[eve].exist, true);
      assert.equal(
        previousCount.add(1).toString(),
        currentCount.toString()
      );
    });

    it("should not increment oracle delegator count if already exist", async function() {
      const amount = toWei("10");
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: eve });
      await this.oracleManager.stake(david, this.linkToken.address, amount, {
        from: eve,
      });
      const previousCount = await this.oracleManager.getOracle(david).delegatorCount;
      assert.equal(
        previousCount.toString(),
        "1"
      );
      assert.equal(await this.oracleManager.getOracle(david).delegators[eve].exist, true);
      await this.oracleManager.stake(david, this.linkToken.address, amount, {
        from: eve,
      });
      const currentCount = await this.oracleManager.getOracle(david).delegatorCount;
      assert.equal(
        previousCount.toString(),
        currentCount.toString()
      );
    });

    it("should give all shares to first depositor, equal to amount", async function() {
      const amount = toWei("50");
      const collateral = this.linkToken.address;
      const previousShares = await this.oracleManager.getOracle(david).stake[collateral].shares;
      assert.equal(
        previousShares.toString(),
        "0"
      );
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: eve });
      await this.oracleManager.stake(david, collateral, amount, {
        from: eve,
      });
      const currentShares = await this.oracleManager.getOracle(david).stake[collateral].shares;
      assert.equal(
        previousShares.add(amount).toString(),
        currentShares.toString()
      );
      const delegatorShares = await this.oracleManager.getOracle(david).delegators[eve].stakes[collateral].shares;
      assert.equal(
        delegatorShares.toString(),
        amount.toString()
      );
    });

    it("should correctly calculate shares for subsequent deposits", async function() {
      const amount = toWei("50");
      const collateral = this.linkToken.address;
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: eve });
      await this.oracleManager.stake(david, collateral, amount, {
        from: eve,
      });
      const previousShares = await this.oracleManager.getOracle(david).stake[collateral].shares;
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: carol });
      await this.oracleManager.stake(david, collateral, amount, {
        from: carol,
      });
      const currentShares = await this.oracleManager.getOracle(david).stake[collateral].shares;
      assert.isAbove(currentShares, previousShares, "shares increase with deposits");
      const firstDelegatorShares = await this.oracleManager.getOracle(david).delegators[eve].stakes[collateral].shares;
      const secondDelegatorShares = await this.oracleManager.getOracle(david).delegators[carol].stakes[collateral].shares;
      assert.isAtMost(secondDelegatorShares, firstDelegatorShares, 
        "subsequent delegators receive equal or fewer shares per amount");
    });
  });

  context("Test request unstaking of different amounts by oracle", () => {
    it("should unstake 0 tokens", async function() {
      const amount = 0;
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const prevCollateral = await this.oracleManager.collaterals(collateral);
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256);
      await this.oracleManager.requestUnstake(bob, collateral, alice, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const currentCollateral = await this.oracleManager.collaterals(collateral);
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(prevCollateral.totalLocked.toString(), currentCollateral.totalLocked.toString());
    });

    it("should unstake 5 tokens", async function() {
      const amount = toWei("5");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const prevCollateral = await this.oracleManager.collaterals(collateral);
      await this.oracleManager.requestUnstake(bob, collateral, alice, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const currentCollateral = await this.oracleManager.collaterals(collateral);
      assert.equal(
        prevOracleStaking.sub(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
    });

    it("fail in case of unstaking too many tokens", async function() {
      const amount = toWei("3200000");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.oracleManager.requestUnstake(bob, collateral, alice, amount, {
          from: alice,
        }),
        "requestUnstake: insufficient withdrawable funds"
      );
    });

    it("fail in case of unstaking undefined collateral", async function() {
      const amount = toWei("10");
      const collateral = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      await expectRevert(
        this.oracleManager.requestUnstake(bob, collateral, alice, amount, {
          from: alice,
        }),
        "requestUnstake: collateral is not enabled"
      );
    });

    it("fail in case of staking collateral not enabled", async function() {
      const amount = toWei("10");
      await this.oracleManager.updateCollateral(this.linkToken.address, false);
      await expectRevert(
        this.oracleManager.requestUnstake(bob, collateral, alice, amount, {
          from: alice,
        }),
        "requestUnstake: collateral is not enabled"
      );
    });
  });

  context("Test request unstaking of different amounts by delegator", () => {
    before(async function() {
      const amount = toWei("100");
      const collateral = this.linkToken.address;
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: david });
      await this.oracleManager.stake(david, collateral, amount, {
        from: david,
      });
    });

    it("should unstake 0 tokens", async function() {
      const amount = 0;
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(david, collateral);
      const prevCollateral = await this.oracleManager.collaterals(collateral);
      const prevDelegation = await this.oracleManager.getTotalDelegation(david, collateral);
      const prevDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collateral);
      const prevDelegatorShares = await this.oracleManager.getDelegatorShares(david, eve, collateral);
      const prevTotalOracleShares = await this.oracleManager.getOracle(david).stake[collateral].shares;
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256, { from: david });
      await this.oracleManager.requestUnstake(david, collateral, alice, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(david, collateral);
      const currentCollateral = await this.oracleManager.collaterals(collateral);
      const currentDelegation = await this.oracleManager.getTotalDelegation(david, collateral);
      const currentDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collateral);
      const currentDelegatorShares = await this.oracleManager.getDelegatorShares(david, eve, collateral);
      const currentTotalOracleShares = await this.oracleManager.getOracle(david).stake[collateral].shares;
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(prevCollateral.totalLocked.toString(), currentCollateral.totalLocked.toString());
      assert.equal(prevDelegation.toString(), currentDelegation.toString());
      assert.equal(
        prevDelegatorStaking.toString(),
        currentDelegatorStaking.toString()
      );
      assert.equal(
        prevDelegatorShares.toString(),
        currentDelegatorShares.toString()
      );
      assert.equal(
        prevTotalOracleShares.toString(),
        currentTotalOracleShares.toString()
      );
    });

    it("should unstake 5 tokens", async function() {
      const amount = toWei("5");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(david, collateral);
      const prevCollateral = await this.oracleManager.collaterals(collateral);
      const prevDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collateral);
      await this.oracleManager.requestUnstake(david, collateral, alice, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(david, collateral);
      const currentCollateral = await this.oracleManager.collaterals(collateral);
      const currentDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collateral);
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
      assert.equal(
        prevDelegation.sub(toBN(amount)).toString(), 
        currentDelegation.toString()
      );
      assert.equal(
        prevDelegatorStaking.toString(),
        currentDelegatorStaking.add(toBN(amount)).toString()
      );
      assert.isBelow(
        currentDelegatorShares.toString(),
        prevDelegatorShares.toString(),
        "number of shares decrease"
      );
      assert.isBelow(
        currentTotalOracleShares.toString(),
        prevTotalOracleShares.toString(),
        "number of shares decrease"
      );
    });
    
    it("should fail in case of request unstaking insufficient amount by delegator", async function() {
      const amount = toWei("55");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.oracleManager.requestUnstake(david, collateral, alice, amount, {
          from: eve,
        }),
        "requestUnstake: insufficient amount"
      );
    });
  });

  context("Test request unstaking permissions", () => {
    it("should unstake by admin", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const prevCollateral = await this.oracleManager.collaterals(collateral);
      await this.linkToken.approve(this.oracleManager.address, MAX_UINT256);
      await this.oracleManager.requestUnstake(bob, collateral, alice, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const currentCollateral = await this.oracleManager.collaterals(collateral);
      assert.equal(
        prevOracleStaking.sub(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
    });

    it("fail in case of unstaking by non admin", async function() {
      const amount = toWei("3");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.oracleManager.requestUnstake(bob, collateral, alice, amount, {
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
      const collateral = prevWithdrawalInfo.collateral;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const prevCollateral = await this.oracleManager.collaterals(collateral);
      await this.oracleManager.executeUnstake(bob, withdrawalId, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const currentCollateral = await this.oracleManager.collaterals(collateral);
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
      assert.equal(prevCollateral.totalLocked.toString(), currentCollateral.totalLocked.toString());
    });

    it("fail in case of execute unstaking before timelock", async function() {
      const amount = toWei("1");
      const collateral = this.linkToken.address;
      await this.oracleManager.requestUnstake(bob, collateral, alice, amount, {
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
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const prevCollateral = await this.oracleManager.collaterals(collateral);
      await this.oracleManager.liquidate(bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const currentCollateral = await this.oracleManager.collaterals(collateral);
      assert.equal(
        prevOracleStaking.sub(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
      assert.equal(
        prevCollateral.confiscatedFunds.add(toBN(amount)).toString(),
        currentCollateral.confiscatedFunds.toString()
      );
    });

    it("should execute liquidate of normal amount of tokens", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const prevCollateral = await this.oracleManager.collaterals(collateral);
      await this.oracleManager.liquidate(bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const currentCollateral = await this.oracleManager.collaterals(collateral);
      assert.equal(
        prevOracleStaking.sub(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
      assert.equal(
        prevCollateral.confiscatedFunds.add(toBN(amount)).toString(),
        currentCollateral.confiscatedFunds.toString()
      );
    });

    it("fail in case of liquidate of too many tokens", async function() {
      const amount = toWei("1000");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.oracleManager.liquidate(bob, collateral, amount, {
          from: alice,
        }),
        "liquidate: insufficient balance"
      );
    });
  });

  context("Test liquidate by different users", () => {
    it("should execute liquidate by admin", async function() {
      const amount = toWei("2");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const prevCollateral = await this.oracleManager.collaterals(collateral);
      await this.oracleManager.liquidate(bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.oracleManager.getOracleStaking(bob, collateral);
      const currentCollateral = await this.oracleManager.collaterals(collateral);
      assert.equal(
        prevOracleStaking.sub(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
      assert.equal(
        prevCollateral.confiscatedFunds.add(toBN(amount)).toString(),
        currentCollateral.confiscatedFunds.toString()
      );
    });

    it("fail in case of liquidate by non-admin", async function() {
      const amount = toWei("1");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.oracleManager.liquidate(bob, collateral, amount, {
          from: carol,
        }),
        "Ownable: caller is not the owner"
      );
    });
  });

  context("Test withdraw different liquidated amounts", () => {
    it("should execute withdrawal of 0 liquidated tokens", async function() {
      const amount = toWei("0");
      const collateral = this.linkToken.address;
      const recepient = alice;
      const prevAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const prevCollateral = await this.oracleManager.collaterals(collateral);
      await this.oracleManager.withdrawFunds(recepient, collateral, amount, {
        from: alice,
      });
      const currentAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const currentCollateral = await this.oracleManager.collaterals(collateral);
      assert.equal(
        prevAliceGovBalance.add(toBN(amount)).toString(),
        currentAliceGovBalance.toString()
      );
      assert.equal(
        prevCollateral.confiscatedFunds.sub(toBN(amount)).toString(),
        currentCollateral.confiscatedFunds.toString()
      );
    });

    it("should execute liquidate of normal amount of tokens", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const recepient = alice;
      const prevAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const prevCollateral = await this.oracleManager.collaterals(collateral);
      await this.oracleManager.withdrawFunds(recepient, collateral, amount, {
        from: alice,
      });
      const currentAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const currentCollateral = await this.oracleManager.collaterals(collateral);
      assert.equal(
        prevAliceGovBalance.add(toBN(amount)).toString(),
        currentAliceGovBalance.toString()
      );
      assert.equal(
        prevCollateral.confiscatedFunds.sub(toBN(amount)).toString(),
        currentCollateral.confiscatedFunds.toString()
      );
    });

    it("fail in case of withdrawal of too many tokens", async function() {
      const amount = toWei("1000");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.oracleManager.withdrawFunds(alice, collateral, amount, {
          from: alice,
        }),
        "withdrawFunds: insufficient reserve funds"
      );
    });
  });

  context("Test withdraw liquidated funds by different users", () => {
    it("should execute withdrawal by the admin", async function() {
      const amount = toWei("1");
      const collateral = this.linkToken.address;
      const recepient = alice;
      const prevAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const prevCollateral = await this.oracleManager.collaterals(collateral);
      await this.oracleManager.withdrawFunds(recepient, collateral, amount, {
        from: alice,
      });
      const currentAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const currentCollateral = await this.oracleManager.collaterals(collateral);
      assert.equal(
        prevAliceGovBalance.add(toBN(amount)).toString(),
        currentAliceGovBalance.toString()
      );
      assert.equal(
        prevCollateral.confiscatedFunds.sub(toBN(amount)).toString(),
        currentCollateral.confiscatedFunds.toString()
      );
    });

    it("fail in case of withdrawal by non-admin", async function() {
      const amount = toWei("1");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.oracleManager.withdrawFunds(alice, collateral, amount, {
          from: bob,
        }),
        "Ownable: caller is not the owner"
      );
    });
  });

  context("Test request transfering assets", () => {
    it("should request transfer non asset", async function() {
      const amount = toWei("0");
      const collateral = this.linkToken.address;
      const prevOracleFromStake = await this.oracleManager.getOracleStaking(david, collateral);
      const prevOracleToStake = await this.oracleManager.getOracleStaking(bob, collateral);
      await this.oracleManager.requestTransfer(david, bob, collateral, amount, { from: eve });
      const currentOracleFromStake = await this.oracleManager.getOracleStaking(david, collateral);
      const currentOracleToStake = await this.oracleManager.getOracleStaking(bob, collateral);
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
      const collateral = this.linkToken.address;
      const prevOracleFromStake = await this.oracleManager.getOracleStaking(david, collateral);
      const prevOracleToStake = await this.oracleManager.getOracleStaking(bob, collateral);
      const prevDelegatorStakingFrom = await this.oracleManager.getDelegatorStakes(david, eve, collateral);
      const prevDelegatorStakingTo = await this.oracleManager.getDelegatorStakes(bob, eve, collateral);
      await this.oracleManager.requestTransfer(david, bob, collateral, amount, { from: eve });
      const currentOracleFromStake = await this.oracleManager.getOracleStaking(david, collateral);
      const currentOracleToStake = await this.oracleManager.getOracleStaking(bob, collateral);
      const currentDelegatorStakingFrom = await this.oracleManager.getDelegatorStakes(david, eve, collateral);
      const currentDelegatorStakingTo = await this.oracleManager.getDelegatorStakes(bob, eve, collateral);

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
      const collateral = this.linkToken.address;
      await expectRevert(this.oracleManager.requestTransfer(david, bob, collateral, amount, { from: eve }), "transferAssets: Insufficient amount for delegator");
    });
    it("should reject when transfer by oracle", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await expectRevert(this.oracleManager.requestTransfer(david, bob, collateral, amount, { from: bob }), "requestTransfer: callable by delegator");
    });
  });

  context("Test execute transfering asset", () => {
    it("should execute transfer", async function() {
      sleep(2000);
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
      const collateral = this.linkToken.address;
      const amount = toWei("100");
      const prevOracleStake = await this.oracleManager.getOracleStaking(bob, collateral);
      await this.oracleManager.account_asset(bob, collateral, amount);
      const currentOracleStake = await this.oracleManager.getOracleStaking(bob, collateral);

      assert.equal(prevOracleStake.add(toBN(amount)).toString(), currentOracleStake.toString());
    });
    it ("should pay for oracle who shares profit with delegators", async function() {
      const collateral = this.linkToken.address;
      const amount = toWei("100"), amountForDelegator = toWei("25");
      const prevOracleStake = await this.oracleManager.getOracleStaking(david, collateral);
      const prevDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collateral);
      await this.oracleManager.account_asset(david, collateral, amount);
      const currentOracleStake = await this.oracleManager.getOracleStaking(david, collateral);
      const currentDelegatorStaking = await this.oracleManager.getDelegatorStakes(david, eve, collateral);

      assert.equal(prevOracleStake.add(toBN(amount)).toString(), currentOracleStake.toString(), "oracle staking");
      assert.equal(prevDelegatorStaking.add(toBN(amountForDelegator)).toString(), currentDelegatorStaking.toString(), "delegator staking");
    });
  });

  context("Test deposit to strategy", () => {
    it("should decrease staking after deposit", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const strategy = this.mockStrategy.address;

      const prevOracleStake = await this.oracleManager.getOracleStaking(bob, collateral);
      await this.oracleManager.depositToStrategy(bob, amount, strategy);
      const currentOracleStake = await this.oracleManager.getOracleStaking(bob, collateral);
      
      assert.equal(
        prevOracleStake.toString(),
        currentOracleStake.add(toBN(amount)).toString()
      );
    });
    it("should fail when deposit insufficient fund", async function() {
      const amount = toWei("320000");
      const strategy = this.mockStrategy.address;
      await expectRevert(this.oracleManager.depositToStrategy(bob, amount, strategy, { from: alice }), "depositToStrategy: Insufficient fund");
    });
  });

  context("Test withdraw from strategy", () => {
    it("should increase staking after withdraw", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const strategy = this.mockStrategy.address;

      const prevOracleStake = await this.oracleManager.getOracleStaking(bob, collateral);
      await this.oracleManager.withdrawFromStrategy(bob, amount, strategy);
      const currentOracleStake = await this.oracleManager.getOracleStaking(bob, collateral);
      
      assert.equal(
        prevOracleStake.add(toBN(amount)).toString(),
        currentOracleStake.toString()
      );
    });
  });
});
