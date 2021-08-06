const { expectRevert } = require("@openzeppelin/test-helpers");
const { current } = require("@openzeppelin/test-helpers/src/balance");
const { MAX_UINT256, ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const expectEvent = require("@openzeppelin/test-helpers/src/expectEvent");
const { assert } = require("chai");
const DelegatedStaking = artifacts.require("DelegatedStaking");
const MockLinkToken = artifacts.require("MockLinkToken");
const MockUSDCToken = artifacts.require("MockUSDCToken");
const MockStrategy = artifacts.require('MockStrategy');
const MockPriceConsumer = artifacts.require('MockPriceConsumer');
const { toWei, fromWei, toBN } = web3.utils;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

contract("DelegatedStaking", function([alice, bob, carol, eve, david, sam]) {
  before(async function() {
    this.signers = await ethers.getSigners()
    aliceAccount = this.signers[0]
    bobAccount = this.signers[1]
    carolAccount = this.signers[2]
    eveAccount = this.signers[3]
    davidAccount = this.signers[4]
    samAccount = this.signers[5]
    alice = aliceAccount.address
    bob = bobAccount.address
    carol = carolAccount.address
    eve = eveAccount.address
    david = davidAccount.address
    sam = samAccount.address
    
    this.linkToken = await MockLinkToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.usdcToken = await MockUSDCToken.new("USDC Token", "dUSDC", 6, {
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
    await this.usdcToken.mint(eve, toWei("3200000"), {
      from: alice,
    });
    await this.linkToken.mint(carol, toWei("3200000"), {
      from: alice,
    });
    await this.linkToken.mint(sam, toWei("3200000"), {
      from: alice,
    });
    this.timelock = 1;
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
    await this.delegatedStaking.addCollateral(this.usdcToken.address, 6, true);
    await this.delegatedStaking.methods['updateCollateral(address,bool)'](this.linkToken.address, true);
    await this.delegatedStaking.methods['updateCollateral(address,uint256)'](this.linkToken.address, MAX_UINT256);
    await this.delegatedStaking.methods['updateCollateral(address,bool)'](this.usdcToken.address, true);
    await this.delegatedStaking.methods['updateCollateral(address,uint256)'](this.usdcToken.address, MAX_UINT256);
    await this.delegatedStaking.addOracle(bob, alice);
    await this.delegatedStaking.setMinProfitSharing(0, { from: alice });
    await this.delegatedStaking.setProfitSharing(bob, 0);
    await this.delegatedStaking.addOracle(david, alice);
    await this.delegatedStaking.setProfitSharing(david, 2500);
    await this.mockPriceConsumer.addPriceFeed(this.linkToken.address, 5);
    await this.delegatedStaking.addStrategy(this.mockStrategy.address, this.linkToken.address, this.linkToken.address);
    this.timelock = 2
    await this.delegatedStaking.setTimelock(this.timelock, { from: alice });
    await this.delegatedStaking.setTimelockForTransfer(this.timelock);

    const linkCollateral = await this.delegatedStaking.collaterals(this.linkToken.address);
    const usdcCollateral = await this.delegatedStaking.collaterals(this.usdcToken.address);
    const davidOracle = await this.delegatedStaking.getUserInfo(david);
    const bobOracle = await this.delegatedStaking.getUserInfo(bob);
    const strategy = await this.delegatedStaking.strategies(this.mockStrategy.address);
    assert.equal(linkCollateral.isSupported, true);
    assert.equal(usdcCollateral.isSupported, true);
    assert.equal(linkCollateral.isEnabled, true);
    assert.equal(usdcCollateral.isEnabled, true);
    assert.equal(linkCollateral.maxStakeAmount.toString(), MAX_UINT256);
    assert.equal(usdcCollateral.maxStakeAmount.toString(), MAX_UINT256);
    assert.equal(davidOracle.isOracle, true);
    assert.equal(bobOracle.isOracle, true);
    assert.equal(davidOracle.profitSharingBPS, 2500);
    assert.equal(bobOracle.profitSharingBPS, 0);
    assert.equal(await this.delegatedStaking.minProfitSharingBPS(), 0);
    assert.exists(await this.mockPriceConsumer.priceFeeds(this.linkToken.address));
    assert.equal(strategy.isSupported, true);
    assert.equal(strategy.isEnabled, true);
    assert.equal(await this.delegatedStaking.timelock(), this.timelock);
    assert.equal(await this.delegatedStaking.timelockForDelegate(), this.timelock);
  });

  context("Test staking different amounts by oracle", async () => {
    beforeEach(async function() {
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
    });
    it("should stake 0 tokens", async function() {
      const amount = 0;
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevDelegation = await this.delegatedStaking.getDelegationInfo(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.stake(bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentDelegation = await this.delegatedStaking.getDelegationInfo(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevOracleStaking[0].toString(),
        currentOracleStaking[0].toString()
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
      const prevDelegation = await this.delegatedStaking.getDelegationInfo(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.stake(bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentDelegation = await this.delegatedStaking.getDelegationInfo(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevOracleStaking[0].add(toBN(amount)).toString(),
        currentOracleStaking[0].toString()
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
      await expectRevert(
        this.delegatedStaking.stake(bob, collateral, amount, {
          from: alice,
        }),
        "collateral disabled"
      );
    });

    it("fail in case of staking collateral not enabled", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.delegatedStaking.methods['updateCollateral(address,bool)'](collateral, false);
      await expectRevert(
        this.delegatedStaking.stake(bob, collateral, amount, {
          from: alice,
        }),
        "collateral disabled"
      );
      await this.delegatedStaking.methods['updateCollateral(address,bool)'](collateral, true);
    });

    it("pass in case of collateral staking not exceeded", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.delegatedStaking.methods['updateCollateral(address,uint256)'](collateral, toWei("1000"));
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.stake(bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevOracleStaking[0].add(toBN(amount)).toString(),
        currentOracleStaking[0].toString()
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
      await expectRevert(
        this.delegatedStaking.stake(bob, collateral, amount, {
          from: alice,
        }),
        "collateral limited"
      );
      await this.delegatedStaking.methods['updateCollateral(address,uint256)'](this.linkToken.address, MAX_UINT256);
    });
  });

  context("Test staking different amounts by delegator", async () => {
    beforeEach(async function() {
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: eve });
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: carol });
    });
    it("should stake 0 tokens", async function() {
      const amount = 0;
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      await this.delegatedStaking.stake(david, collateral, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      assert.equal(
        prevOracleStaking[0].toString(),
        currentOracleStaking[0].toString()
      );
      assert.equal(prevCollateral.totalLocked.toString(), currentCollateral.totalLocked.toString());
      assert.equal(prevDelegation[0].toString(), currentDelegation[0].toString());
      assert.equal(prevDelegatorStakes[1].toString(), currentDelegatorStakes[1].toString());
      assert.equal(prevDelegatorStakes[2].toString(), currentDelegatorStakes[2].toString());
      assert.equal(prevDelegation[1].toString(), prevDelegation[1].toString());
    });

    it("should stake 50 tokens", async function() {
      const amount = toWei("50");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      await this.delegatedStaking.stake(david, collateral, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      assert.equal(
        prevOracleStaking[0].toString(),
        currentOracleStaking[0].toString()
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
        prevDelegatorStakes[1].add(toBN(amount)).toString(),
        currentDelegatorStakes[1].toString()
      );
      assert(currentDelegatorStakes[2].toString() > prevDelegatorStakes[2].toString(), "number of delegator shares increases");
      assert(currentDelegation[1].toString() > prevDelegation[1].toString(), "number of total oracle shares increases");
    });

    it("pass in case of collateral staking not exceeded", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.delegatedStaking.methods['updateCollateral(address,uint256)'](collateral, toWei("1000"));
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.stake(david, collateral, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevOracleStaking[0].toString(),
        currentOracleStaking[0].toString()
      );
      assert.equal(
        prevDelegatorStakes[1].add(toBN(amount)).toString(),
        currentDelegatorStakes[1].toString()
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
      await expectRevert(
        this.delegatedStaking.stake(david, collateral, amount, {
          from: eve,
        }),
        "collateral limited"
      );
      await this.delegatedStaking.methods['updateCollateral(address,uint256)'](this.linkToken.address, MAX_UINT256);
    });

    it("test delegator admin is set to sender if admin zero address", async function() {
      const amount = toWei("50");
      const previousInfo = await this.delegatedStaking.getAccountInfo(carol);
      assert.equal(
        previousInfo[0].toString(),
        ZERO_ADDRESS
      );
      await this.delegatedStaking.stake(david, this.linkToken.address, amount, {
        from: carol,
      });
      const currentInfo = await this.delegatedStaking.getAccountInfo(carol);
      assert.equal(
        currentInfo[0].toString(),
        carol
      );
    });

    it("should increment oracle delegator count if does not exist", async function() {
      const collateral = this.linkToken.address;
      const amount = toWei("50");
      const previousDelegation = await this.delegatedStaking.getDelegationInfo(david, this.linkToken.address);
      const previousDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, sam, collateral);
      assert.equal(previousDelegatorStakes[0], false);
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: sam });
      await this.delegatedStaking.stake(david, this.linkToken.address, amount, {
        from: sam,
      });
      const currentDelegation = await this.delegatedStaking.getDelegationInfo(david, this.linkToken.address);
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, sam, collateral);
      assert.equal(currentDelegatorStakes[0], true);
      assert.equal(
        previousDelegation[2].add(toBN(1)).toString(),
        currentDelegation[2].toString()
      );
    });

    it("should not increment oracle delegator count if already exists", async function() {
      const collateral = this.linkToken.address;
      const amount = toWei("10");
      await this.delegatedStaking.stake(david, this.linkToken.address, amount, {
        from: eve,
      });
      const previousDelegationInfo = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const previousDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      assert.equal(previousDelegatorStakes[0], true);
      await this.delegatedStaking.stake(david, collateral, amount, {
        from: eve,
      });
      const currentDelegationInfo = await this.delegatedStaking.getDelegationInfo(david, collateral);
      assert.equal(
        previousDelegationInfo[2].toString(),
        currentDelegationInfo[2].toString()
      );
    });

    it("should give all shares to first depositor, equal to amount", async function() {
      const amount = toWei("50");
      const collateral = this.linkToken.address;
      const previousDelegation = await this.delegatedStaking.getDelegationInfo(bob, collateral);
      assert.equal(
        previousDelegation[1].toString(),
        "0"
      );
      await this.delegatedStaking.stake(bob, collateral, amount, {
        from: eve,
      });
      const currentDelegation = await this.delegatedStaking.getDelegationInfo(bob, collateral);
      assert.equal(
        previousDelegation[1].add(toBN(amount)).toString(),
        currentDelegation[1].toString()
      );
      const delegatorStakes = await this.delegatedStaking.getDelegatorStakes(bob, eve, collateral);
      assert.equal(
        delegatorStakes[2].toString(),
        amount.toString()
      );
    });

    it("should correctly calculate shares for subsequent deposits", async function() {
      const amount = toWei("50");
      const collateral = this.linkToken.address;
      await this.delegatedStaking.stake(david, collateral, amount, {
        from: eve,
      });
      const previousDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      await this.delegatedStaking.stake(david, collateral, amount, {
        from: carol,
      });
      const currentDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      assert(currentDelegation[1].toString() > previousDelegation[1].toString(), "shares increase with deposits");
      const firstDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      const secondDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, carol, collateral);
      assert(secondDelegatorStakes[2].toString() <= firstDelegatorStakes[2].toString(), 
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
        prevOracleStaking[0].toString(),
        currentOracleStaking[0].toString()
      );
      assert.equal(prevCollateral.totalLocked.toString(), currentCollateral.totalLocked.toString());
    });

    before(async function() {
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.delegatedStaking.stake(bob, this.linkToken.address, toWei("5"), { from: alice });
    })
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
        prevOracleStaking[0].sub(toBN(amount)).toString(),
        currentOracleStaking[0].toString()
      );
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
    });

    it("fail in case of unstaking too much collateral", async function() {
      const amount = toWei("3200000");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.delegatedStaking.requestUnstake(bob, collateral, bob, amount, {
          from: alice,
        }),
        "revert" // doesn't get to "bad amount" if collateral decrement underflows beforehand
      );
    });

    it("fail in case of unstaking too many tokens", async function() {
      const amount = toWei("200");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.delegatedStaking.requestUnstake(bob, collateral, bob, amount, {
          from: alice,
        }),
        "bad amount"
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
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: david });
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: eve });
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.delegatedStaking.stake(david, collateral, amount, {
        from: alice,
      });
      await this.delegatedStaking.stake(david, collateral, amount, { from: eve });
    });

    it("should unstake 0 tokens", async function() {
      const amount = 0;
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      await this.delegatedStaking.requestUnstake(david, collateral, alice, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      assert.equal(
        prevOracleStaking[0].toString(),
        currentOracleStaking[0].toString()
      );
      assert.equal(prevCollateral.totalLocked.toString(), currentCollateral.totalLocked.toString());
      assert.equal(prevDelegation.toString(), currentDelegation.toString());
      assert.equal(
        prevDelegatorStakes[1].toString(),
        currentDelegatorStakes[1].toString()
      );
      assert.equal(
        prevDelegatorStakes[2].toString(),
        currentDelegatorStakes[2].toString()
      );
      assert.equal(
        prevDelegation[1].toString(),
        currentDelegation[1].toString()
      );
    });

    it("should unstake 5 shares", async function() {
      const amount = toWei("5");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      await this.delegatedStaking.requestUnstake(david, collateral, eve, amount, {
        from: eve,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      assert.equal(
        prevOracleStaking[0].toString(),
        currentOracleStaking[0].toString()
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
        prevDelegation[1].sub(toBN(amount)).toString(),
        currentDelegation[1].toString()
      );
      assert.equal(
        prevDelegatorStakes[1].toString(),
        currentDelegatorStakes[1].add(toBN(amount)).toString()
      );
      assert.equal(
        currentDelegatorStakes[2].toString(),
        prevDelegatorStakes[2].sub(toBN(amount)).toString(),
        "number of shares decrease"
      );
    });
    
    it("should fail in case of request unstaking insufficient amount by delegator", async function() {
      const collateral = this.linkToken.address;
      await expectRevert(
        this.delegatedStaking.requestUnstake(david, collateral, eve, MAX_UINT256, {
          from: eve,
        }),
        "bad amount"
      );
    });

    it("should fail in case of delegator !exist", async function() {
      const amount = toWei("55");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.delegatedStaking.requestUnstake(bob, collateral, alice, amount, {
          from: carol,
        }),
        "delegator !exist"
      );
    });
  });

  context("Test request unstaking permissions", async () => {
    before(async function() {
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.delegatedStaking.stake(bob, this.linkToken.address, toWei("10"), {
        from: alice,
      });
    })
    it("should unstake by admin", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevDelegation = await this.delegatedStaking.getDelegationInfo(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.requestUnstake(bob, collateral, alice, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentDelegation = await this.delegatedStaking.getDelegationInfo(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevOracleStaking[0].sub(toBN(amount)).toString(),
        currentOracleStaking[0].toString()
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
    before(async function() {
      const amount = toWei("10");
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.delegatedStaking.stake(bob, this.linkToken.address, amount, {
        from: alice,
      });
      await this.delegatedStaking.requestUnstake(bob, this.linkToken.address, alice, amount, {
        from: alice,
      });
    })

    it("fail in case of execute unstaking before timelock", async function() {
      await this.delegatedStaking.requestUnstake(bob, this.linkToken.address, alice, toWei("10"), {
        from: alice,
      });
      await expectRevert(
        this.delegatedStaking.executeUnstake(bob, 1, {
          from: alice,
        }),
        "too early"
      );
    });

    it("fail in case of execute unstaking from future", async function() {
      await expectRevert(
        this.delegatedStaking.executeUnstake(bob, 10, {
          from: alice,
        }),
        "request !exist"
      );
    });

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
        prevOracleStaking[0].toString(),
        currentOracleStaking[0].toString()
      );
      assert.equal(prevCollateral.totalLocked.toString(), currentCollateral.totalLocked.toString());
    });

    it("fail in case of execute unstaking twice", async function() {
      await expectRevert(
        this.delegatedStaking.executeUnstake(bob, 0, {
          from: alice,
        }),
        "already executed"
      );
    });
  });

  context("Test liquidate different amounts", async () => {
    before(async function() {
      const amount = toWei("10");
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.delegatedStaking.stake(bob, this.linkToken.address, amount, {
        from: alice,
      });
    })

    it("should execute liquidate 0 tokens", async function() {
      const amount = toWei("0");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.methods['liquidate(address,address,uint256)'](bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevOracleStaking[0].sub(toBN(amount)).toString(),
        currentOracleStaking[0].toString()
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
      await this.delegatedStaking.methods['liquidate(address,address,uint256)'](bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevOracleStaking[0].sub(toBN(amount)).toString(),
        currentOracleStaking[0].toString()
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
        this.delegatedStaking.methods['liquidate(address,address,uint256)'](bob, collateral, amount, {
          from: alice,
        }),
        "bad amount"
      );
    });
  });

  context("Test liquidate by different users", async () => {
    before(async function() {
      const amount = toWei("10");
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.delegatedStaking.stake(bob, this.linkToken.address, amount, {
        from: alice,
      });
    })
    it("should execute liquidate by admin", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.methods['liquidate(address,address,uint256)'](bob, collateral, amount, {
        from: alice,
      });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevOracleStaking[0].sub(toBN(amount)).toString(),
        currentOracleStaking[0].toString()
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
        this.delegatedStaking.methods['liquidate(address,address,uint256)'](bob, collateral, amount, {
          from: carol,
        }),
        "onlyAdmin"
      );
    });
  });

  context("Test withdraw different liquidated amounts", async () => {
    before(async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.delegatedStaking.stake(bob, collateral, amount, {
        from: alice,
      });
      await this.delegatedStaking.methods['liquidate(address,address,uint256)'](bob, collateral, amount, {
        from: alice,
      });
    })
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
        "bad amount"
      );
    });
  });

  context("Test withdraw liquidated funds by different users", async () => {
    before(async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.delegatedStaking.stake(bob, collateral, amount, {
        from: alice,
      });
      await this.delegatedStaking.methods['liquidate(address,address,uint256)'](bob, collateral, amount, {
        from: alice,
      });
    })
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
        "onlyAdmin"
      );
    });
  });

  context("Test request transfering assets", async () => {
    before(async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: eve });
      await this.delegatedStaking.stake(david, collateral, amount, {
        from: eve,
      });
    })
    it("should fail request transfer none of asset", async function() {
      const amount = toWei("0");
      await expectRevert(
        this.delegatedStaking.requestTransfer(david, bob, this.linkToken.address, amount, { 
          from: eve 
        }),
        "no shares"
      );
    });
    it("should transfer normal amount of assets", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const prevOracleFromStake = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevOracleToStake = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevOracleFromDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const prevOracleToDelegation = await this.delegatedStaking.getDelegationInfo(bob, collateral);
      const prevDelegatorFromStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      const prevDelegatorToStakes = await this.delegatedStaking.getDelegatorStakes(bob, eve, collateral);
      const prevAccountInfo = await this.delegatedStaking.getAccountInfo(eve);
      await this.delegatedStaking.requestTransfer(david, bob, collateral, amount, { from: eve });
      const currentOracleFromStake = await this.delegatedStaking.getOracleStaking(david, collateral);
      const currentOracleToStake = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentOracleFromDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const currentOracleToDelegation = await this.delegatedStaking.getDelegationInfo(bob, collateral);
      const currentDelegatorFromStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      const currentDelegatorToStakes = await this.delegatedStaking.getDelegatorStakes(bob, eve, collateral);
      const currentAccountInfo = await this.delegatedStaking.getAccountInfo(eve);

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
        prevDelegatorFromStakes[1].sub(toBN(amount)).toString(), 
        currentDelegatorFromStakes[1].toString()
      );
      assert(
        prevOracleFromDelegation[1].toString() >
        currentOracleFromDelegation[1].toString()
      );
      assert.equal(
        prevDelegatorToStakes[1].toString(), 
        currentDelegatorToStakes[1].toString()
      );
      assert.equal(
        prevOracleToDelegation[1].toString(), 
        currentOracleToDelegation[1].toString()
      );
      assert.equal(
        prevAccountInfo[1].add(toBN(1)).toString(),
        currentAccountInfo[1].toString()
      );
    });
    it("should reject while transferring too many assets", async function() {
      const collateral = this.linkToken.address;
      await expectRevert(this.delegatedStaking.requestTransfer(david, bob, collateral, MAX_UINT256, { from: eve }), "bad amount");
    });
  });

  context("Test execute transfering asset", async () => {
    before(async function() {
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: eve });
      await this.delegatedStaking.stake(david, this.linkToken.address, toWei("200"), { from: eve });
      await this.delegatedStaking.requestTransfer(david, bob, this.linkToken.address, toWei("10"), { from: eve });
    });
    it("should fail if execute transfer before timelock", async function() {
      const currentTransferRequest = await this.delegatedStaking.getTransferRequest(eve, 0, { from: eve });
      assert.equal(currentTransferRequest.executed, false);
      await expectRevert(
        this.delegatedStaking.executeTransfer(0, { from: eve }),
        "too early"
      );
    });
    it("should execute transfer", async function() {
      await sleep(2000);
      const prevTransferRequest = await this.delegatedStaking.getTransferRequest(eve, 0, { from: eve });
      assert.equal(prevTransferRequest.executed, false);
      const oracleTo = prevTransferRequest.oracleTo;
      const collateral = prevTransferRequest.collateral;
      const amount = prevTransferRequest.amount;
      const prevOracleToDelegation = await this.delegatedStaking.getDelegationInfo(oracleTo, collateral);
      const prevDelegatorToStakes = await this.delegatedStaking.getDelegatorStakes(oracleTo, eve, collateral);
      await this.delegatedStaking.executeTransfer(0, { from: eve });
      const currentTransferRequest = await this.delegatedStaking.getTransferRequest(eve, 0, { from: eve });
      const currentOracleToDelegation = await this.delegatedStaking.getDelegationInfo(oracleTo, collateral);
      const currentDelegatorToStakes = await this.delegatedStaking.getDelegatorStakes(oracleTo, eve, collateral);
      assert.equal(
        prevOracleToDelegation[0].add(toBN(amount)).toString(), 
        currentOracleToDelegation[0].toString()
      );
      assert.equal(
        prevDelegatorToStakes[1].add(toBN(amount)).toString(), 
        currentDelegatorToStakes[1].toString()
      );
      assert(
        prevDelegatorToStakes[2].toString() <
        currentDelegatorToStakes[2].toString(),
        "shares increase"
      );
      assert.equal(currentTransferRequest.executed, true);
    });
    it("should fail if transfer already executed", async function() {
      const transferId = 0;
      await expectRevert(
        this.delegatedStaking.executeTransfer(transferId, { from: eve }),
        "already executed"
      );
    });
    it("should fail if transfer does not exist", async function() {
      const transferId = 100;
      await expectRevert(
        this.delegatedStaking.executeTransfer(transferId, { from: eve }),
        "request !exist"
      );
    });
  });

  context("Test rewards distribution", async () => {
    before(async function() {
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: eve });
      await this.delegatedStaking.stake(david, this.linkToken.address, toWei("200"), { from: eve });
      await this.delegatedStaking.stake(bob, this.linkToken.address, toWei("200"), { from: eve });
    });
    it("should pay for oracle who set profit sharing as zero", async function() {
      const collateral = this.linkToken.address;
      await this.delegatedStaking.methods['updateCollateral(address,bool)'](collateral, true);
      const amount = toWei("100");
      const prevOracleStake = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.distributeRewards(bob, collateral, amount);
      const currentOracleStake = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);

      assert.equal(prevOracleStake[0].add(toBN(amount)).toString(), currentOracleStake[0].toString());
      assert.equal(prevCollateral.totalLocked.add(toBN(amount)).toString(), currentCollateral.totalLocked.toString());
    });
    it("should pay for oracle who shares profit with delegators", async function() {
      const collateral = this.linkToken.address;
      const dependsCollateral = this.usdcToken.address;
      const amount = toWei("100"), amountForDelegator = toWei("25");
      await this.usdcToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: eve });
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.delegatedStaking.stake(david, this.usdcToken.address, toWei("200"), { from: eve });
      const prevOracleStake = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const prevTokensPerShare = await this.delegatedStaking.getTokensPerShare(david, collateral, dependsCollateral);
      await this.delegatedStaking.distributeRewards(david, collateral, amount, { from: alice });
      const currentOracleStake = await this.delegatedStaking.getOracleStaking(david, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const currentTokensPerShare = await this.delegatedStaking.getTokensPerShare(david, collateral, dependsCollateral);

      assert.equal(prevOracleStake[0].add(toBN(amount - amountForDelegator)).toString(), currentOracleStake[0].toString(), "oracle staking");
      assert.equal(prevCollateral.totalLocked.add(toBN(amount)).toString(), currentCollateral.totalLocked.toString());
      assert.equal(prevDelegation[0].toString(), currentDelegation[0].toString(), "delegator staking");
      assert(prevTokensPerShare[0].toString() <= currentTokensPerShare[0].toString(), "accTokensPerShare increase");
      assert(prevTokensPerShare[1].toString() <= currentTokensPerShare[1].toString(), "dependsAccTokensPerShare increase");
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
        "strategy disabled"
      );
      await this.delegatedStaking.updateStrategy(strategy, true);
    });
    it("should fail if delegator !exist", async function() {
      const amount = toWei("10");
      const strategy = this.mockStrategy.address;
      await expectRevert(
        this.delegatedStaking.depositToStrategy(eve, amount, strategy, { 
          from: bob 
        }), 
        "delegator !exist"
      );
    });
    it("should update balances after deposit", async function() { // TODO failing due to mock update reserves
      const amount = toWei("100");
      const collateral = this.linkToken.address;
      const strategy = this.mockStrategy.address;
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.delegatedStaking.stake(david, collateral, amount, { from: alice });
      const prevOracleStake = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy);
      const prevDepositInfo = await this.delegatedStaking.methods['getStrategyDepositInfo(address,address,address)'](david, strategy, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.depositToStrategy(david, toWei("10"), strategy, { from: alice });
      const currentOracleStake = await this.delegatedStaking.getOracleStaking(david, collateral);
      const currentStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy);
      const currentDepositInfo = await this.delegatedStaking.methods['getStrategyDepositInfo(address,address,address)'](david, strategy, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);

      assert.equal(
        prevOracleStake[0].toString(),
        currentOracleStake[0].toString()
      );
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
      assert.equal(
        prevDepositInfo[0].add(toBN(amount)).toString(),
        currentDepositInfo[0].toString()
      );
      assert(
        prevDepositInfo[1].toString() <
        currentDepositInfo[1].toString()
      );
      assert.equal(
        prevStrategyStakes[0].add(toBN(amount)).toString(),
        currentStrategyStakes[0].toString()
      );
      assert(
        prevStrategyStakes[1].toString() <
        currentStrategyStakes[1].toString()
      );
    });
    it("should fail when deposit insufficient fund", async function() {
      const amount = toWei("320000");
      const strategy = this.mockStrategy.address;
      await expectRevert(this.delegatedStaking.depositToStrategy(bob, amount, strategy, { from: alice }), "bad amount");
    });
  });

  context("Test withdraw from strategy", async () => {
    before(async function() {
      const amount = toWei("200");
      const strategy = this.mockStrategy.address;
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: eve });
      await this.delegatedStaking.stake(david, this.linkToken.address, amount, { from: alice });
      await this.delegatedStaking.stake(david, this.linkToken.address, amount, { from: eve });
      await this.delegatedStaking.stake(bob, this.linkToken.address, amount, { from: eve });
      await this.delegatedStaking.depositToStrategy(david, toWei("100"), strategy, { from: alice });
      await this.delegatedStaking.depositToStrategy(david, toWei("100"), strategy, { from: eve });
    })
    it("should fail if not called by admin", async function() {
      const amount = toWei("10");
      const strategy = this.mockStrategy.address;
      await expectRevert(
        this.delegatedStaking.withdrawFromStrategy(bob, amount, strategy, { 
          from: bob 
        }), 
        "only admin"
      );
    });
    it("should fail if strategy not enabled", async function() {
      const amount = toWei("10");
      const strategy = this.mockStrategy.address;
      await this.delegatedStaking.updateStrategy(strategy, false);
      await expectRevert(
        this.delegatedStaking.withdrawFromStrategy(bob, amount, strategy, { 
          from: alice 
        }), 
        "strategy disabled"
      );
      await this.delegatedStaking.updateStrategy(strategy, true);
    });
    it("should fail if delegator !exist", async function() {
      const amount = toWei("10");
      const strategy = this.mockStrategy.address;
      await expectRevert(
        this.delegatedStaking.withdrawFromStrategy(eve, amount, strategy, { 
          from: bob 
        }), 
        "delegator !exist"
      );
    });
    it("should fail when withdraw insufficient share", async function() {
      const amount = toWei("320000");
      const strategy = this.mockStrategy.address;
      await expectRevert(this.delegatedStaking.withdrawFromStrategy(bob, amount, strategy, { from: alice }), "no shares");
    });
    it("should decrement strategy and deposit info after withdraw", async function() {
      const collateral = this.linkToken.address;
      const strategy = this.mockStrategy.address;
      const prevStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy);
      const prevDepositInfo = await this.delegatedStaking.methods['getStrategyDepositInfo(address,address,address)'](bob, strategy, collateral);
      await this.delegatedStaking.withdrawFromStrategy(bob, 10, strategy, { from: alice });
      const currentStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy);
      const currentDepositInfo = await this.delegatedStaking.methods['getStrategyDepositInfo(address,address,address)'](bob, strategy, collateral);
      assert(
        prevStrategyStakes[0].sub(toBN(amount)).toString(),
        currentStrategyStakes[0].toString()
      );
      assert(
        prevStrategyStakes[1].toString() >
        currentStrategyStakes[1].toString(),
        "shares decrease"
      );
      assert(
        prevDepositInfo[0].sub(toBN(amount)).toString(),
        currentDepositInfo[0].toString()
      );
      assert(
        prevDepositInfo[1].toString() >
        currentDepositInfo[1].toString(),
        "shares decrease"
      );
    });
    it("should increase staking after oracle withdraw", async function() {
      const collateral = this.linkToken.address;
      const strategy = this.mockStrategy.address;

      const prevOracleStake = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevRewards = await this.delegatedStaking.getRewards(bob, collateral);
      await this.linkToken.approve(this.delegatedStaking.address, MAX_UINT256, { from: alice });
      await this.delegatedStaking.stake(bob, collateral, toWei("1000"), { from: alice });
      await this.delegatedStaking.depositToStrategy(bob, toWei("100"), strategy, { from: alice });
      await this.delegatedStaking.withdrawFromStrategy(bob, toWei("10"), strategy, { from: alice });
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentOracleStake = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentRewards = await this.delegatedStaking.getRewards(bob, collateral);
      
      assert(
        prevOracleStake[0].toString() <
        currentOracleStake[0].toString()
      );
      assert(
        prevRewards[0].toString() <
        currentRewards[0].toString()
      );
      assert(
        prevOracleStake[1].toString() >
        currentOracleStake[1].toString()
      );
      assert.equal(
        prevCollateral.totalLocked.add(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );

    });
    it("should increase stakes after delegator withdraw", async function() {
      const collateral = this.linkToken.address;
      const strategy = this.mockStrategy.address;
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      const prevDelegation = await this.delegatedStaking.getDelegationInfo(bob, collateral);
      await this.delegatedStaking.withdrawFromStrategy(bob, toWei("10"), strategy, { from: alice });
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      const currentDelegation = await this.delegatedStaking.getDelegationInfo(bob, collateral);
      
      assert(prevDelegation[0].toString() <= currentDelegation[0].toString());
      assert(prevDelegatorStakes[1].toString() <= currentDelegatorStakes[1].toString());
      assert(prevDelegatorStakes[2].toString() <= currentDelegatorStakes[2].toString());
      assert(prevDelegation[1].toString() <= prevDelegation[1].toString());
    });
    it("should increment reward balances", async function() {
      const collateral = this.linkToken.address;
      const strategy = this.mockStrategy.address;
      const prevRewards = await this.delegatedStaking.getRewards(bob, collateral);
      const prevStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy);
      await this.delegatedStaking.withdrawFromStrategy(bob, toWei("10"), strategy, { from: alice });
      const currentRewards = await this.delegatedStaking.getRewards(bob, collateral);
      const currentStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy);
      
      assert(prevRewards[0].toString() <= currentRewards[0].toString());
      assert(prevRewards[1].toString() <= currentRewards[1].toString());
      assert(prevRewards[2].toString() <= currentRewards[2].toString());
      assert(prevStrategyStakes[2].toString() <= currentStrategyStakes[2].toString());
    });
  });

  context("Test emergency withdraw from strategy", async () => {
    it("should fail if not called by contract admin", async function() {
      const strategy = this.mockStrategy.address;
      await expectRevert(
        this.delegatedStaking.emergencyWithdrawFromStrategy(strategy, {
          from: bob 
        }), 
        "onlyAdmin"
      );
    });
    it("should fail if strategy not enabled", async function() {
      const strategy = this.mockStrategy.address;
      await this.delegatedStaking.updateStrategy(strategy, false);
      await expectRevert(
        this.delegatedStaking.emergencyWithdrawFromStrategy(strategy, {
          from: alice 
        }), 
        "strategy disabled"
      );
      await this.delegatedStaking.updateStrategy(strategy, true);
    });
    it("should disable strategy and set recoverable", async function() {
      const strategy = this.mockStrategy.address;
      await this.delegatedStaking.emergencyWithdrawFromStrategy(strategy,
      {
        from: alice 
      });
      assert.equal(strategy.isEnabled, false);
      assert.equal(strategy.recoverable, true);
    });
    it("should increase collateral reserves", async function() {
      const collateral = this.linkToken.address;
      const strategy = this.mockStrategy.address;
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy);
      await this.delegatedStaking.emergencyWithdrawFromStrategy(strategy,
      {
        from: alice 
      });
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy);
      assert(
        prevCollateral.totalLocked.toString() <
        currentCollateral.totalLocked.toString()
      );
      assert(
        prevStrategyStakes[0].toString() <
        currentStrategyStakes[0].toString()
      );
    });
  });

  context("Test recover from emergency", async () => {
    before(async function() {
      const strategy = this.mockStrategy.address;
      await this.delegatedStaking.emergencyWithdrawFromStrategy(strategy, { from: alice });
    });
    it("should succeed if called by non contract admin", async function() {
      const strategy = this.mockStrategy.address;
      const txReceipt = await this.delegatedStaking.recoverFromEmergency(strategy, [david, bob], {
        from: sam 
      });
      expectEvent(txReceipt, 'RecoveredFromEmergency', { oracle: david, amount: 0, strategy: strategy, collateral: collateral });
      expectEvent(txReceipt, 'RecoveredFromEmergency', { oracle: bob, amount: 0, strategy: strategy, collateral: collateral });
    });
    it("should fail if strategy enabled", async function() {
      const strategy = this.mockStrategy.address;
      await this.delegatedStaking.updateStrategy(strategy, true);
      await expectRevert(
        this.delegatedStaking.recoverFromEmergency(strategy, [david, bob], {
          from: alice 
        }), 
        "strategy enabled"
      );
    });
    it("should fail if funds not recoverable", async function() {
      const strategy = this.mockStrategy.address;
      await this.delegatedStaking.updateStrategy(strategy, false);
      await expectRevert(
        this.delegatedStaking.recoverFromEmergency(strategy, [david, bob], {
          from: alice 
        }), 
        "revert not recoverable"
      );
    });
    beforeEach(async function() {
      const strategy = this.mockStrategy.address;
      await this.delegatedStaking.emergencyWithdrawFromStrategy(strategy, { from: alice });
    });
    it("should decrease strategy shares and reserves", async function() {
      const collateral = this.linkToken.address;
      const strategy = this.mockStrategy.address;
      const prevStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy);
      const prevDepositInfo = await this.delegatedStaking.methods['getStrategyDepositInfo(address,address,address)'](bob, strategy, collateral);
      await this.delegatedStaking.recoverFromEmergency(strategy, [david, bob], { from: alice });
      const currentStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy);
      const currentDepositInfo = await this.delegatedStaking.methods['getStrategyDepositInfo(address,address,address)'](bob, strategy, collateral);
      assert(
        prevStrategyStakes[0].toString() >
        currentStrategyStakes[0].toString()
      );
      assert(
        prevStrategyStakes[1].toString() >
        currentStrategyStakes[1].toString(),
        "shares decrease"
      );
      assert(
        prevDepositInfo[0].toString() >
        currentDepositInfo[0].toString()
      );
      assert(
        prevDepositInfo[1].toString() >
        currentDepositInfo[1].toString(),
        "shares decrease"
      );
    });
    it("should reset oracle locked", async function() {
      const strategy = this.mockStrategy.address;
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      assert.notEqual(prevOracleStaking[1].toString(), 0);
      await this.delegatedStaking.recoverFromEmergency(strategy, [david, bob], { from: alice });
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      assert.equal(currentOracleStaking[1].toString(), 0);
    });
    it("should reset delegator locked", async function() {
      const strategy = this.mockStrategy.address;
      const collateral = this.linkToken.address;
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      assert.notEqual(prevDelegatorStakes[3].toString(), 0);
      await this.delegatedStaking.recoverFromEmergency(strategy, [david, bob], { from: alice });
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      assert.equal(currentDelegatorStakes[3].toString(), 0);
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
