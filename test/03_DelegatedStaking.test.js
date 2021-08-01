const { expectRevert } = require("@openzeppelin/test-helpers");
const { current } = require("@openzeppelin/test-helpers/src/balance");
const { MAX_UINT256, ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { MaxUint256 } = require("ethers/constants");
const DelegatedStaking = artifacts.require("DelegatedStaking");
const MockLinkToken = artifacts.require("MockLinkToken");
const MockStrategy = artifacts.require('MockStrategy');
const MockPriceConsumer = artifacts.require('MockPriceConsumer');
const { toWei, fromWei, toBN } = web3.utils;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

contract("DelegatedStaking", function([alice, bob, carol, eve, david, sam]) {
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
    await this.linkToken.mint(carol, toWei("3200000"), {
      from: alice,
    });
    await this.linkToken.mint(sam, toWei("3200000"), {
      from: alice,
    });
    this.timelock = 2;
    this.mockStrategy = await MockStrategy.new({ from: alice });
    this.mockPriceConsumer = await MockPriceConsumer.new({ from: alice });
    this.delegatedStaking = await DelegatedStaking.new();
    await this.delegatedStaking.initialize(
      this.timelock,
      this.mockPriceConsumer.address,
      {
        from: alice,
      }
    );
    await this.delegatedStaking.addCollateral(this.linkToken.address, 18, false);
    await this.delegatedStaking.methods['updateCollateral(address,bool)'](this.linkToken.address, true);
    await this.delegatedStaking.methods['updateCollateral(address,uint256)'](this.linkToken.address, MAX_UINT256);
    await this.delegatedStaking.addOracle(bob, alice);
    await this.delegatedStaking.setProfitSharing(bob, 0);
    await this.delegatedStaking.addOracle(david, alice);
    await this.delegatedStaking.setProfitSharing(david, 2500);
    await this.mockPriceConsumer.addPriceFeed(this.linkToken.address, 5);
    await this.delegatedStaking.addStrategy(this.mockStrategy.address, this.linkToken.address, this.linkToken.address);
    await this.delegatedStaking.setTimelockForTransfer(this.timelock);
  });

  context("Test staking different amounts by oracle", async () => {
    it("should stake 0 tokens", async function() {
      const amount = 0;
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevDelegation = await this.delegatedStaking.getTotalDelegation(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.delegatedStaking.stake(bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentDelegation = await this.delegatedStaking.getTotalDelegation(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevDelegation[0].toString(),
        currentDelegation[0].toString()
      );
      assert.equal(prevCollateral.totalLocked.toString(), currentCollateral.totalLocked.toString());
    });

    it("should stake 100 tokens", async function() {
      const amount = toWei("100");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevDelegation = await this.delegatedStaking.getTotalDelegation(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.delegatedStaking.stake(bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentDelegation = await this.delegatedStaking.getTotalDelegation(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevOracleStaking.add(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevDelegation[0].toString(),
        currentDelegation[0].toString()
      );
      assert.equal(
        prevCollateral.totalLocked.add(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
    });

    it("fail in case of staking too many tokens", async function() {
      const amount = toWei("3200000");
      const collateral = this.linkToken.address;
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await expectRevert(
        this.delegatedStaking.stake(bob, collateral, amount, {
          from: alice,
        }),
        "ERC20: transfer amount exceeds balance"
      );
    });

    it("fail in case of staking undefined collateral", async function() {
      const amount = toWei("10");
      const collateral = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await expectRevert(
        this.delegatedStaking.stake(bob, collateral, amount, {
          from: alice,
        }),
        "stake: collateral disabled"
      );
    });

    it("fail in case of staking collateral not enabled", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.delegatedStaking.methods['updateCollateral(address,bool)'](collateral, false);
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await expectRevert(
        this.delegatedStaking.stake(bob, collateral, amount, {
          from: alice,
        }),
        "stake: collateral disabled"
      );
      await this.delegatedStaking.methods['updateCollateral(address,bool)'](collateral, true);
    });

    it("pass in case of collateral staking not exceeded", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.delegatedStaking.methods['updateCollateral(address,uint256)'](collateral, toWei("1000"));
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral)
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.delegatedStaking.stake(bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevOracleStaking.add(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollateral.totalLocked.add(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
      await this.delegatedStaking.methods['updateCollateral(address,uint256)'](this.linkToken.address, MAX_UINT256);
    });

    it("fail in case of collateral staking exceeded", async function() {
      const amount = toWei("1000");
      const collateral = this.linkToken.address;
      await this.delegatedStaking.methods['updateCollateral(address,uint256)'](collateral, toWei("100"));
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await expectRevert(
        this.delegatedStaking.stake(bob, collateral, amount, {
          from: alice,
        }),
        "stake: collateral staking limited"
      );
      await this.delegatedStaking.methods['updateCollateral(address,uint256)'](this.linkToken.address, MAX_UINT256);
    });
  });

  context("Test staking different amounts by delegator", async () => {
    it("should stake 0 tokens", async function() {
      const amount = 0;
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevDelegation = await this.delegatedStaking.getTotalDelegation(david, collateral);
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: eve });
      await this.delegatedStaking.stake(david, collateral, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentDelegation = await this.delegatedStaking.getTotalDelegation(david, collateral);
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(prevCollateral.totalLocked.toString(), currentCollateral.totalLocked.toString());
      assert.equal(prevDelegation[0].toString(), currentDelegation[0].toString());
      assert.equal(prevDelegatorStakes[0].toString(), currentDelegatorStakes[0].toString());
      assert.equal(prevDelegatorStakes[1].toString(), currentDelegatorStakes[1].toString());
      assert.equal(prevDelegation[1].toString(), prevDelegation[1].toString());
    });

    it("should stake 50 tokens", async function() {
      const amount = toWei("50");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevDelegation = await this.delegatedStaking.getTotalDelegation(david, collateral);
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: eve });
      await this.delegatedStaking.stake(david, collateral, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentDelegation = await this.delegatedStaking.getTotalDelegation(david, collateral);
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollateral.totalLocked.add(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
      assert.equal(
        prevDelegation[0].add(toBN(amount)).toString(),
        currentDelegation[0].toString()
      );
      assert.equal(
        prevDelegatorStakes[0].add(toBN(amount)).toString(),
        currentDelegatorStakes[0].toString()
      );
      assert(currentDelegatorStakes[1].toString() > prevDelegatorStakes[1].toString(), "number of delegator shares increases");
      assert(currentDelegation[1].toString() > prevDelegation[1].toString(), "number of total oracle shares increases");
    });

    it("pass in case of collateral staking not exceeded", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.delegatedStaking.methods['updateCollateral(address,uint256)'](collateral, toWei("1000"));
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: eve });
      await this.delegatedStaking.stake(david, collateral, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevDelegatorStakes[0].add(toBN(amount)).toString(),
        currentDelegatorStakes[0].toString()
      );
      assert.equal(
        prevCollateral.totalLocked.add(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
      await this.delegatedStaking.methods['updateCollateral(address,uint256)'](this.linkToken.address, MAX_UINT256);
    });

    it("fail in case of collateral staking exceed", async function() {
      const amount = toWei("1000");
      const collateral = this.linkToken.address;
      await this.delegatedStaking.methods['updateCollateral(address,uint256)'](collateral, toWei("1000"));
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: eve });
      await expectRevert(
        this.delegatedStaking.stake(david, collateral, amount, {
          from: eve,
        }),
        "stake: collateral staking limited"
      );
      await this.delegatedStaking.methods['updateCollateral(address,uint256)'](this.linkToken.address, MAX_UINT256);
    });

    it("test delegator admin is set to sender if admin zero address", async function() {
      const amount = toWei("50");
      const previousAdmin = await this.delegatedStaking.getAccountAdmin(carol);
      assert.equal(
        previousAdmin.toString(),
        ZERO_ADDRESS
      );
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: carol });
      await this.delegatedStaking.stake(david, this.linkToken.address, amount, {
        from: carol,
      });
      const currentAdmin = await this.delegatedStaking.getAccountAdmin(carol);
      assert.equal(
        currentAdmin.toString(),
        carol
      );
    });

    it("should increment oracle delegator count if does not exist", async function() {
      const amount = toWei("50");
      const previousCount = await this.delegatedStaking.getDelegatorCount(david);
      assert.equal(await this.delegatedStaking.doesDelegatorExist(david, sam), false);
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: sam });
      await this.delegatedStaking.stake(david, this.linkToken.address, amount, {
        from: sam,
      });
      const currentCount = await this.delegatedStaking.getDelegatorCount(david);
      assert.equal(await this.delegatedStaking.doesDelegatorExist(david, sam), true);
      assert.equal(
        previousCount.add(toBN(1)).toString(),
        currentCount.toString()
      );
    });

    it("should not increment oracle delegator count if already exists", async function() {
      const amount = toWei("10");
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: eve });
      await this.delegatedStaking.stake(david, this.linkToken.address, amount, {
        from: eve,
      });
      const previousCount = await this.delegatedStaking.getDelegatorCount(david);
      assert.equal(await this.delegatedStaking.doesDelegatorExist(david, eve), true);
      await this.delegatedStaking.stake(david, this.linkToken.address, amount, {
        from: eve,
      });
      const currentCount = await this.delegatedStaking.getDelegatorCount(david);
      assert.equal(
        previousCount.toString(),
        currentCount.toString()
      );
    });

    it("should give all shares to first depositor, equal to amount", async function() {
      const amount = toWei("50");
      const collateral = this.linkToken.address;
      const previousDelegation = await this.delegatedStaking.getTotalDelegation(bob, collateral);
      assert.equal(
        previousDelegation[1].toString(),
        "0"
      );
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: eve });
      await this.delegatedStaking.stake(bob, collateral, amount, {
        from: eve,
      });
      const currentDelegation = await this.delegatedStaking.getTotalDelegation(bob, collateral);
      assert.equal(
        previousDelegation[1].add(toBN(amount)).toString(),
        currentDelegation[1].toString()
      );
      const delegatorStakes = await this.delegatedStaking.getDelegatorStakes(bob, eve, collateral);
      assert.equal(
        delegatorStakes[1].toString(),
        amount.toString()
      );
    });

    it("should correctly calculate shares for subsequent deposits", async function() {
      const amount = toWei("50");
      const collateral = this.linkToken.address;
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: eve });
      await this.delegatedStaking.stake(david, collateral, amount, {
        from: eve,
      });
      const previousDelegation = await this.delegatedStaking.getTotalDelegation(david, collateral);
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: carol });
      await this.delegatedStaking.stake(david, collateral, amount, {
        from: carol,
      });
      const currentDelegation = await this.delegatedStaking.getTotalDelegation(david, collateral);
      assert(currentDelegation[1].toString() > previousDelegation[1].toString(), "shares increase with deposits");
      const firstDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      const secondDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, carol, collateral);
      assert(secondDelegatorStakes[1].toString() <= firstDelegatorStakes[1].toString(), 
        "subsequent delegators receive equal or fewer shares per amount");
    });
  });

  context("Test request unstaking of different amounts by oracle", async () => {
    it("should unstake 0 tokens", async function() {
      const amount = 0;
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256);
      await this.delegatedStaking.requestUnstake(bob, collateral, alice, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(prevCollateral.totalLocked.toString(), currentCollateral.totalLocked.toString());
    });

    it("should unstake 5 tokens", async function() {
      const amount = toWei("5");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.requestUnstake(bob, collateral, alice, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevOracleStaking.sub(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
    });

    //TODO: add another test that passes collateral decrement but the fails with bad amount
    it("fail in case of unstaking too many tokens", async function() {
      const amount = toWei("3200000");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.delegatedStaking.requestUnstake(bob, collateral, bob, amount, {
          from: alice,
        }),
        "revert" // doesn't get to "requestUnstake: bad amount" if collateral decrement underflows beforehand
      );
    });

    it("fail in case of unstaking undefined collateral", async function() {
      const amount = toWei("10");
      const collateral = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      await expectRevert.unspecified(
        this.delegatedStaking.requestUnstake(bob, collateral, alice, amount, {
          from: alice,
        })
      );
    });
  });

  context("Test request unstaking of different amounts by delegator", async () => {
    before(async function() {
      const amount = toWei("100");
      const collateral = this.linkToken.address;
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.delegatedStaking.stake(david, collateral, amount, {
        from: alice,
      });
    });

    it("should unstake 0 tokens", async function() {
      const amount = 0;
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevDelegation = await this.delegatedStaking.getTotalDelegation(david, collateral);
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: david });
      await this.delegatedStaking.requestUnstake(david, collateral, alice, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentDelegation = await this.delegatedStaking.getTotalDelegation(david, collateral);
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(prevCollateral.totalLocked.toString(), currentCollateral.totalLocked.toString());
      assert.equal(prevDelegation.toString(), currentDelegation.toString());
      assert.equal(
        prevDelegatorStakes[0].toString(),
        currentDelegatorStakes[0].toString()
      );
      assert.equal(
        prevDelegatorStakes[1].toString(),
        currentDelegatorStakes[1].toString()
      );
      assert.equal(
        prevDelegation[1].toString(),
        currentDelegation[1].toString()
      );
    });

    it("should unstake 5 tokens", async function() { // TODO: failing need to unstake shares
      const amount = toWei("5");
      const collateral = this.linkToken.address;
      await this.linkToken.approve(this.delegatedStaking.address, amount, { from: eve });
      await this.delegatedStaking.stake(david, collateral, amount, { from: eve });
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevDelegation = await this.delegatedStaking.getTotalDelegation(david, collateral);
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      await this.delegatedStaking.requestUnstake(david, collateral, eve, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentDelegation = await this.delegatedStaking.getTotalDelegation(david, collateral);
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      assert.equal(
        prevOracleStaking.toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
      assert.equal(
        prevDelegation[0].sub(toBN(amount)).toString(), 
        currentDelegation[0].toString()
      );
      assert.equal(
        prevDelegatorStakes[0].toString(),
        currentDelegatorStakes[0].add(toBN(amount)).toString()
      );
      assert(
        currentDelegatorStakes[1].toString() <
        prevDelegatorStakes[1].toString(),
        "number of shares decrease"
      );
      assert(
        currentDelegation[1].toString() <
        prevDelegation[1].toString(),
        "number of shares decrease"
      );
    });
    
    it("should fail in case of request unstaking insufficient amount by delegator", async function() {
      const collateral = this.linkToken.address;
      await expectRevert(
        this.delegatedStaking.requestUnstake(david, collateral, eve, MaxUint256, {
          from: eve,
        }),
        "requestUnstake: bad share"
      );
    });

    it("should fail in case of delegator does not exist", async function() {
      const amount = toWei("55");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.delegatedStaking.requestUnstake(bob, collateral, alice, amount, {
          from: carol,
        }),
        "requestUnstake: delegator !exist"
      );
    });
  });

  context("Test request unstaking permissions", async () => {
    it("should unstake by admin", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevDelegation = await this.delegatedStaking.getTotalDelegation(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256);
      await this.delegatedStaking.requestUnstake(bob, collateral, alice, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentDelegation = await this.delegatedStaking.getTotalDelegation(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevOracleStaking.sub(toBN(amount)).toString(),
        currentOracleStaking.toString()
      );
      assert.equal(
        prevDelegation[0].toString(),
        currentDelegation[0].toString()
      );
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
    });
  });

  context("Test execute unstaking of different amounts", async () => {
    it("should execute unstake", async function() {
      await sleep(2000);
      const withdrawalId = 0;
      const prevWithdrawalInfo = await this.delegatedStaking.getWithdrawalRequest(
        bob,
        withdrawalId
      );
      const collateral = prevWithdrawalInfo.collateral;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.executeUnstake(bob, withdrawalId, {
        from: alice,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentWithdrawalInfo = await this.delegatedStaking.getWithdrawalRequest(
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
      await this.delegatedStaking.requestUnstake(bob, collateral, alice, amount, {
        from: alice,
      });
      await expectRevert(
        this.delegatedStaking.executeUnstake(bob, 2, {
          from: alice,
        }),
        "executeUnstake: too early"
      );
    });

    it("fail in case of execute unstaking twice", async function() {
      await expectRevert(
        this.delegatedStaking.executeUnstake(bob, 0, {
          from: alice,
        }),
        "executeUnstake: already executed"
      );
    });

    it("fail in case of execute unstaking from future", async function() {
      await expectRevert(
        this.delegatedStaking.executeUnstake(bob, 10, {
          from: alice,
        }),
        "execUnstake: withdrawal !exist"
      );
    });
  });

  context("Test liquidate different amounts", async () => {
    it("should execute liquidate 0 tokens", async function() {
      const amount = toWei("0");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.methods['liquidate(address,address,address)'](bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
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
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.methods['liquidate(address,address,address)'](bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
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
        this.delegatedStaking.methods['liquidate(address,address,address)'](bob, collateral, amount, {
          from: alice,
        }),
        "liquidate: insufficient balance"
      );
    });
  });

  context("Test liquidate by different users", async () => {
    it("should execute liquidate by admin", async function() {
      const amount = toWei("2");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.methods['liquidate(address,address,address)'](bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
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
        this.delegatedStaking.methods['liquidate(address,address,address)'](bob, collateral, amount, {
          from: carol,
        }),
        "onlyAdmin: bad role"
      );
    });
  });

  context("Test withdraw different liquidated amounts", async () => {
    it("should execute withdrawal of 0 liquidated tokens", async function() {
      const amount = toWei("0");
      const collateral = this.linkToken.address;
      const recepient = alice;
      const prevAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.withdrawFunds(recepient, collateral, amount, {
        from: alice,
      });
      const currentAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
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
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.withdrawFunds(recepient, collateral, amount, {
        from: alice,
      });
      const currentAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
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
        this.delegatedStaking.withdrawFunds(alice, collateral, amount, {
          from: alice,
        }),
        "withdrawFunds: insufficient reserve funds"
      );
    });
  });

  context("Test withdraw liquidated funds by different users", async () => {
    it("should execute withdrawal by the admin", async function() {
      const amount = toWei("1");
      const collateral = this.linkToken.address;
      const recepient = alice;
      const prevAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.withdrawFunds(recepient, collateral, amount, {
        from: alice,
      });
      const currentAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
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
        this.delegatedStaking.withdrawFunds(alice, collateral, amount, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });
  });

  context("Test request transfering assets", async () => {
    it("should fail request transfer none of asset", async function() {
      const amount = toWei("0");
      await expectRevert(
        this.delegatedStaking.requestTransfer(david, bob, this.linkToken.address, amount, { 
          from: eve 
        }),
        "requestTransfer: bad shares == 0"
      );
    });
    it("should transfer normal amount of assets", async function() { // TODO: failing
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const prevOracleFromStake = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevOracleToStake = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevOracleFromDelegation = await this.delegatedStaking.getTotalDelegation(david, collateral);
      const prevOracleToDelegation = await this.delegatedStaking.getTotalDelegation(bob, collateral);
      const prevDelegatorFromStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      const prevDelegatorToStakes = await this.delegatedStaking.getDelegatorStakes(bob, eve, collateral);
      const prevDelegatorTransferCount = await this.delegatedStaking.getAccountTransferCount(eve);
      await this.delegatedStaking.requestTransfer(david, bob, collateral, amount, { from: eve });
      const currentOracleFromStake = await this.delegatedStaking.getOracleStaking(david, collateral);
      const currentOracleToStake = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentOracleFromDelegation = await this.delegatedStaking.getTotalDelegation(david, collateral);
      const currentOracleToDelegation = await this.delegatedStaking.getTotalDelegation(bob, collateral);
      const currentDelegatorFromStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      const currentDelegatorToStakes = await this.delegatedStaking.getDelegatorStakes(bob, eve, collateral);
      const currentDelegatorTransferCount = await this.delegatedStaking.getAccountTransferCount(eve);

      assert.equal(
        prevOracleFromStake[0].toString(),
        currentOracleFromStake[0].toString()
      );
      assert.equal(
        prevOracleToStake[0].toString(),
        currentOracleToStake[0].toString()
      );
      assert.equal(
        prevOracleFromDelegation[0].sub(toBN(amount)).toString(), 
        currentOracleFromDelegation[0].toString()
      );
      assert.equal(
        prevOracleToDelegation[0].toString(), 
        currentOracleToDelegation[0].toString()
      );
      assert.equal(
        prevDelegatorFromStakes[0].sub(toBN(amount)).toString(), 
        currentDelegatorFromStakes[0].toString()
      );
      assert(
        prevOracleFromDelegation[1].toString() >
        currentOracleFromDelegation[1].toString()
      );
      assert.equal(
        prevDelegatorToStakes[0].toString(), 
        currentDelegatorToStakes[0].toString()
      );
      assert.equal(
        prevOracleToDelegation[1].toString(), 
        currentOracleToDelegation[1].toString()
      );
      assert.equal(
        prevDelegatorTransferCount.add(toBN(1)).toString(),
        currentDelegatorTransferCount.toString()
      );
    });
    it("should reject while transferring too many assets", async function() {
      const collateral = this.linkToken.address;
      await expectRevert(this.delegatedStaking.requestTransfer(david, bob, collateral, MAX_UINT256, { from: eve }), "transferAssets: bad oracle share");
    });
    it("should reject when transfer by oracle", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await expectRevert(this.delegatedStaking.requestTransfer(david, bob, collateral, amount, { from: bob }), "requestTransfer: delegator only");
    });
  });

  context("Test execute transfering asset", async () => {
    it("should fail if execute transfer before timelock", async function() {
      // TODO: possibly mock DelegatedStaking to set up this kind of test
      // and add before block to make subsequent tests independent of behaviour
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: eve });
      await this.delegatedStaking.stake(david, this.linkToken.address, toWei("200"), { from: eve });
      await this.delegatedStaking.requestTransfer(david, bob, this.linkToken.address, 1, { from: eve });
      const currentTransferRequest = await this.delegatedStaking.getTransferRequest(eve, 0, { from: eve });
      assert.equal(currentTransferRequest.executed, false);
      await expectRevert(
        this.delegatedStaking.executeTransfer(0, { from: eve }),
        "revert executeTransfer: too early"
      );
    });
    it("should execute transfer", async function() { // TODO: failing - too early
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: eve });
      await this.delegatedStaking.stake(david, this.linkToken.address, toWei("200"), { from: eve });
      await this.delegatedStaking.requestTransfer(david, bob, this.linkToken.address, 1, { from: eve });
      await sleep(2000);
      const currentTransferRequest = await this.delegatedStaking.getTransferRequest(eve, 1, { from: eve });
      assert.equal(currentTransferRequest.executed, false);
      const oracleTo = currentTransferRequest.oracleTo;
      const collateral = currentTransferRequest.collateral;
      const amount = currentTransferRequest.amount;
      const prevOracleToDelegation = await this.delegatedStaking.getTotalDelegation(oracleTo, collateral);
      const prevDelegatorToStakes = await this.delegatedStaking.getDelegatorStakes(oracleTo, eve, collateral);
      await this.delegatedStaking.executeTransfer(1, { from: eve });
      const currentOracleToDelegation = await this.delegatedStaking.getTotalDelegation(oracleTo, collateral);
      const currentDelegatorToStakes = await this.delegatedStaking.getDelegatorStakes(oracleTo, eve, collateral);
      assert.equal(currentTransferRequest.executed, true);
      assert.equal(
        prevOracleToDelegation[0].add(toBN(amount)).toString(), 
        currentOracleToDelegation[0].toString()
      );
      assert.equal(
        prevDelegatorToStakes[0].sub(toBN(amount)).toString(), 
        currentDelegatorToStakes[0].toString()
      );
      assert(
        prevDelegatorToStakes[1].toString() <
        currentDelegatorToStakes[1].toString()
      );
    });
    it("should fail if transfer already executed", async function() { // TODO: failing
      const transferId = 1;
      await expectRevert(
        this.delegatedStaking.executeTransfer(transferId, { from: eve }),
        "execTransfer: already executed"
      );
    });
    it("should fail if called by oracle", async function() {
      const transferId = 0;
      await expectRevert(
        this.delegatedStaking.executeTransfer(transferId, { from: bob }),
        "executeTransfer: delegator only"
      );
    });
    it("should fail if transfer does not exist", async function() {
      const transferId = 100;
      await expectRevert(
        this.delegatedStaking.executeTransfer(transferId, { from: eve }),
        "executeTransfer: request !exist"
      );
    });
  });

  context("Test rewards distribution", async () => {
    it ("should pay for oracle who set profit sharing as zero", async function() {
      const collateral = this.linkToken.address;
      const amount = toWei("100");
      const prevOracleStake = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.distributeRewards(bob, collateral, amount);
      const currentOracleStake = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);

      assert.equal(prevOracleStake[0].add(toBN(amount)).toString(), currentOracleStake[0].toString());
      assert.equal(prevCollateral.totalLocked.add(toBN(amount)).toString(), currentCollateral.totalLocked.toString());
    });
    it("should pay for oracle who shares profit with delegators", async function() { // TODO: failing
      const collateral = this.linkToken.address;
      const amount = toWei("100"), amountForDelegator = toWei("25");
      const prevOracleStake = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevDelegation = await this.delegatedStaking.getTotalDelegation(david, collateral);
      await this.delegatedStaking.distributeRewards(david, collateral, amount, { from: alice });
      const currentOracleStake = await this.delegatedStaking.getOracleStaking(david, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentDelegation = await this.delegatedStaking.getTotalDelegation(david, collateral);

      assert.equal(prevOracleStake[0].add(toBN(amount - amountForDelegator)).toString(), currentOracleStake[0].toString(), "oracle staking");
      assert.equal(prevCollateral.totalLocked.add(toBN(amount)).toString(), currentCollateral.totalLocked.toString());
      assert.equal(prevDelegation[0].toString(), currentDelegation[0].toString(), "delegator staking"); // TODO: change to test accTokensPerShare
    });
    it("fail in case of reward collateral not enabled", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.delegatedStaking.methods['updateCollateral(address,bool)'](collateral, false);
      await expectRevert(
        this.delegatedStaking.distributeRewards(david, collateral, amount),
        "collateral disabled"
      );
      await this.delegatedStaking.methods['updateCollateral(address,bool)'](collateral, true);
    });
  });

  context("Test deposit to strategy", async () => {
    it("should fail if strategy not enabled", async function() {
      const amount = toWei("10");
      const strategy = this.mockStrategy.address;
      await this.delegatedStaking.updateStrategy(strategy, false);
      await expectRevert(
        this.delegatedStaking.depositToStrategy(bob, amount, strategy, { 
          from: alice 
        }), 
        "depositToStrategy: !enabled"
      );
      await this.delegatedStaking.updateStrategy(strategy, true);
    });
    it("should fail if delegator does not exist", async function() {
      const amount = toWei("10");
      const strategy = this.mockStrategy.address;
      await expectRevert(
        this.delegatedStaking.depositToStrategy(eve, amount, strategy, { 
          from: bob 
        }), 
        "depositToStrat: delegator !exist"
      );
    });
    it("should update balances after deposit", async function() { // TODO: failing
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const strategy = this.mockStrategy.address;

      const prevOracleStake = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.depositToStrategy(bob, amount, strategy);
      const currentOracleStake = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);

      assert.equal(
        prevOracleStake[0].toString(),
        currentOracleStake[0].toString()
      );
      assert(
        prevStrategyStakes[1].toString() <
        currentStrategyStakes[1].toString(),
        "shares increase"
      );
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
      // TODO: increase depositInfo.stakedAmount by amount
      // increase depositInfo.shares
    });
    it("should fail when deposit insufficient fund", async function() {
      const amount = toWei("320000");
      const strategy = this.mockStrategy.address;
      await expectRevert(this.delegatedStaking.depositToStrategy(bob, amount, strategy, { from: alice }), "depositToStrategy: bad amount");
    });
  });

  context("Test withdraw from strategy", async () => {
    it("should increase staking after withdraw", async function() { // TODO: change name of (failing) test
      const collateral = this.linkToken.address;
      const strategy = this.mockStrategy.address;

      const prevOracleStake = await this.delegatedStaking.getOracleStaking(bob, collateral);
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.delegatedStaking.stake(bob, collateral, toWei("1000"), { from: alice });
      await this.delegatedStaking.depositToStrategy(bob, toWei("100"), strategy, { from: alice });
      await this.delegatedStaking.withdrawFromStrategy(bob, 10, strategy, { from: alice });
      const currentOracleStake = await this.delegatedStaking.getOracleStaking(bob, collateral);
      
      assert.equal(
        prevOracleStake[0].toString(),
        currentOracleStake[0].toString()
      );

      // TODO: test locked

    });
  });

  // const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');
  // const DelegatedStakingV2 = artifacts.require('DelegatedStakingV2');
  // context('upgrades', (network) => {
  //   it('works', async (network) => {
  //     const DelegatedStakingInitParams = require("../assets/delegatedStakingInitParams")[network];
  //     const delegatedStaking = await deployProxy(DelegatedStaking, 
  //     [
  //       DelegatedStakingInitParams.timelock, 
  //       link
  //     ]);
  //     const delegatedStaking2 = await upgradeProxy(delegatedStaking.address, DelegatedStakingV2);
  //     const value = await delegatedStaking2.value();
  //     assert.equal(value.toString(), '42');
  //   });
  // });
});
