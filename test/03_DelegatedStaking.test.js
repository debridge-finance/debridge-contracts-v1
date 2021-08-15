const { expectRevert } = require("@openzeppelin/test-helpers");
const { current } = require("@openzeppelin/test-helpers/src/balance");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { BigNumber } = require("ethers");
const { MaxUint256 } = require("@ethersproject/constants");
const expectEvent = require("@openzeppelin/test-helpers/src/expectEvent");
const { assert } = require("chai");
const { upgrades, artifacts, ethers } = require('hardhat');
const ether = require("@openzeppelin/test-helpers/src/ether");
const MockLinkToken = artifacts.require("MockLinkToken");
const MockToken = artifacts.require("MockToken");
const MockPriceConsumer = artifacts.require('MockPriceConsumer');
const { toWei } = web3.utils;

function toBN(number) {
  return BigNumber.from(number.toString());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

contract("DelegatedStaking", function() {
  before(async function() {
    this.signers = await ethers.getSigners();
    aliceAccount = this.signers[0];
    bobAccount = this.signers[1];
    sarahAccount = this.signers[2];
    carolAccount = this.signers[3];
    eveAccount = this.signers[4];
    davidAccount = this.signers[5];
    samAccount = this.signers[6];
    alice = aliceAccount.address;
    bob = bobAccount.address;
    sarah = sarahAccount.address;
    carol = carolAccount.address;
    eve = eveAccount.address;
    david = davidAccount.address;
    sam = samAccount.address;

    this.TokenAFactory = await ethers.getContractFactory("MockAToken");

    this.AaveProtocolDataProviderFactory = await ethers.getContractFactory("AaveProtocolDataProvider");
    this.LendingPoolFactory = await ethers.getContractFactory("LendingPool");
    this.IncentivesControllerFactory = await ethers.getContractFactory("IncentivesController");
    this.AddressesProviderFactory = await ethers.getContractFactory("LendingPoolAddressesProvider");
    this.MockAaveControllerFactory = await ethers.getContractFactory("MockAaveController");
    
    this.addressProvider = await this.AddressesProviderFactory.deploy();
    await this.addressProvider.deployed();

    this.dataProvider = await this.AaveProtocolDataProviderFactory.deploy(
      this.addressProvider.address
    );
    await this.dataProvider.deployed();

    this.lendingPool = await this.LendingPoolFactory.deploy();
    await this.lendingPool.deployed();

    this.stkAAVEToken = await MockToken.new("Staked AAVE Token", "stkAAVE", 18);
    this.incentivesController = await this.IncentivesControllerFactory.deploy(this.stkAAVEToken.address);
    await this.incentivesController.deployed();

    this.linkToken = await MockLinkToken.new("Link Token", "dLINK", 18);
    this.usdcToken = await MockToken.new("USDC Token", "dUSDC", 6);
    this.usdtToken = await MockToken.new("USDT Token", "dUSDT", 6);
    this.dbrToken = await MockToken.new("deBridge Token", "DBR", 18);
    this.aLinkToken = await this.TokenAFactory.deploy(
      this.lendingPool.address,
      this.incentivesController.address,
      "aLink Token",
      "aLINK",
      18,
      this.linkToken.address
    );

    await this.lendingPool.initialize(this.addressProvider.address);
    await this.addressProvider.setLendingPool(this.lendingPool.address);
    await this.lendingPool.addReserveAsset(this.linkToken.address, this.aLinkToken.address);
    await this.lendingPool.setCurrentTime(1);

    await this.linkToken.mint(alice, toWei("3200000"));
    await this.usdcToken.mint(alice, "3200000000000");
    await this.usdtToken.mint(alice, "3200000000000");
    await this.linkToken.mint(david, toWei("3200000"));
    await this.linkToken.mint(eve, toWei("3200000"));
    await this.usdcToken.mint(eve, "3200000000000");
    await this.usdtToken.mint(eve, "3200000000000");
    await this.linkToken.mint(carol, toWei("3200000"));
    await this.usdcToken.mint(carol, "3200000000000");
    await this.usdtToken.mint(carol, "3200000000000");
    await this.linkToken.mint(sam, toWei("3200000"));
    await this.usdcToken.mint(sam, "3200000000000");
    await this.usdtToken.mint(sam, "3200000000000");

    await this.linkToken.mint(this.lendingPool.address, toWei("3200000"));

    this.mockAaveController = await this.MockAaveControllerFactory.deploy(
      this.addressProvider.address,
      this.dataProvider.address
    );
    await this.mockAaveController.deployed();

    this.timelock = 1;
    this.mockPriceConsumer = await MockPriceConsumer.new();
    this.DelegatedStaking = await ethers.getContractFactory("DelegatedStaking");
    this.delegatedStaking = await upgrades.deployProxy(this.DelegatedStaking, [
        this.timelock,
        this.mockPriceConsumer.address
    ]);
    await this.delegatedStaking.deployed();

    await this.delegatedStaking.addCollateral(this.linkToken.address, 18, false);
    await this.delegatedStaking.addCollateral(this.usdcToken.address, 6, true);
    await this.delegatedStaking.addCollateral(this.usdtToken.address, 6, true);
    await this.delegatedStaking['updateCollateral(address,bool)'](this.linkToken.address, true);
    await this.delegatedStaking['updateCollateral(address,uint256)'](this.linkToken.address, MaxUint256);
    await this.delegatedStaking['updateCollateral(address,bool)'](this.usdcToken.address, true);
    await this.delegatedStaking['updateCollateral(address,uint256)'](this.usdcToken.address, MaxUint256);
    await this.delegatedStaking['updateCollateral(address,bool)'](this.usdtToken.address, true);
    await this.delegatedStaking['updateCollateral(address,uint256)'](this.usdtToken.address, MaxUint256);
    await this.delegatedStaking.addOracle(bob, alice);
    await this.delegatedStaking.setMinProfitSharing(0);
    await this.delegatedStaking.setProfitSharing(bob, 0);
    await this.delegatedStaking.addOracle(david, alice);
    await this.delegatedStaking.setProfitSharing(david, 2500);
    await this.delegatedStaking.addOracle(sarah, alice);
    await this.delegatedStaking.setProfitSharing(sarah, 10000);
    this.linkPrice = toWei("25");
    await this.mockPriceConsumer.addPriceFeed(this.linkToken.address, this.linkPrice);
    await this.delegatedStaking.addStrategy(this.mockAaveController.address, this.linkToken.address, this.linkToken.address);
    this.timelock = 2
    await this.delegatedStaking.setTimelock(this.timelock);

    // setup for realistic case
    for(i=7; i<13; i++) { 
      oracleAccount = this.signers[i];
      oracle = oracleAccount.address;
      await this.delegatedStaking.addOracle(oracle, alice);
      await this.delegatedStaking.setProfitSharing(oracle, 10000);
    }

    const linkCollateral = await this.delegatedStaking.collaterals(this.linkToken.address);
    const usdcCollateral = await this.delegatedStaking.collaterals(this.usdcToken.address);
    const usdtCollateral = await this.delegatedStaking.collaterals(this.usdtToken.address);
    const davidOracle = await this.delegatedStaking.getUserInfo(david);
    const bobOracle = await this.delegatedStaking.getUserInfo(bob);
    const strategy = await this.delegatedStaking.getStrategy(this.mockAaveController.address, this.linkToken.address);
    assert.equal(linkCollateral.isSupported, true);
    assert.equal(usdcCollateral.isSupported, true);
    assert.equal(usdtCollateral.isSupported, true);
    assert.equal(linkCollateral.isEnabled, true);
    assert.equal(usdcCollateral.isEnabled, true);
    assert.equal(usdtCollateral.isEnabled, true);
    assert.equal(linkCollateral.maxStakeAmount.toString(), MaxUint256);
    assert.equal(usdcCollateral.maxStakeAmount.toString(), MaxUint256);
    assert.equal(usdtCollateral.maxStakeAmount.toString(), MaxUint256);
    assert.equal(davidOracle.isOracle, true);
    assert.equal(bobOracle.isOracle, true);
    assert.equal(davidOracle.profitSharingBPS, 2500);
    assert.equal(bobOracle.profitSharingBPS, 0);
    assert.equal(await this.delegatedStaking.minProfitSharingBPS(), 0);
    assert.exists(await this.mockPriceConsumer.priceFeeds(this.linkToken.address));
    assert.equal(strategy.isSupported, true);
    assert.equal(strategy.isEnabled, true);
    assert.equal(await this.delegatedStaking.timelock(), this.timelock);
  });

  context("Test staking different amounts by oracle", async () => {
    beforeEach(async function() {
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
    });
    it("should stake 0 tokens", async function() {
      const amount = 0;
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevDelegation = await this.delegatedStaking.getDelegationInfo(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.stake(bob, collateral, amount);
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
      await this.delegatedStaking.stake(bob, collateral, amount);
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
        this.delegatedStaking.stake(bob, collateral, amount),
        "ERC20: transfer amount exceeds balance"
      );
    });

    it("fail in case of staking undefined collateral", async function() {
      const amount = toWei("10");
      const collateral = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      await expectRevert(
        this.delegatedStaking.stake(bob, collateral, amount),
        "collateral disabled"
      );
    });

    it("fail in case of staking collateral not enabled", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.delegatedStaking['updateCollateral(address,bool)'](collateral, false);
      await expectRevert(
        this.delegatedStaking.stake(bob, collateral, amount),
        "collateral disabled"
      );
      await this.delegatedStaking['updateCollateral(address,bool)'](collateral, true);
    });

    it("pass in case of collateral staking not exceeded", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.delegatedStaking['updateCollateral(address,uint256)'](collateral, toWei("1000"));
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.stake(bob, collateral, amount);
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
      await this.delegatedStaking['updateCollateral(address,uint256)'](this.linkToken.address, MaxUint256);
    });

    it("fail in case of collateral staking exceeded", async function() {
      const amount = toWei("1000");
      const collateral = this.linkToken.address;
      await this.delegatedStaking['updateCollateral(address,uint256)'](collateral, toWei("100"));
      await expectRevert(
        this.delegatedStaking.stake(bob, collateral, amount),
        "collateral limited"
      );
      await this.delegatedStaking['updateCollateral(address,uint256)'](this.linkToken.address, MaxUint256);
    });
  });

  context("Test staking different amounts by delegator", async () => {
    beforeEach(async function() {
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: carol });
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: sam });

      await this.usdcToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.usdcToken.approve(this.delegatedStaking.address, MaxUint256, { from: sam });

      await this.usdtToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.usdtToken.approve(this.delegatedStaking.address, MaxUint256, { from: sam });
    });
    it("should stake 0 tokens", async function() {
      const amount = 0;
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      await this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount);
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
      const totalUSDAmountBefore = await this.delegatedStaking.getTotalUSDAmount(david);      
      await this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount);
      const totalUSDAmountAfter = await this.delegatedStaking.getTotalUSDAmount(david);
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      assert.equal(0, totalUSDAmountBefore.toString());
      assert.equal(toWei("1250"), totalUSDAmountAfter.toString());
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

    it("should stake 50 usdc", async function () {
        const amount = "50000000";
        const collateral = this.usdcToken.address;
        const prevOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
        const prevCollateral = await this.delegatedStaking.collaterals(collateral);
        const prevDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
        const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
        const totalUSDAmountBefore = await this.delegatedStaking.getTotalUSDAmount(david);
        await this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount);
        const totalUSDAmountAfter = await this.delegatedStaking.getTotalUSDAmount(david);
        const currentOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
        const currentCollateral = await this.delegatedStaking.collaterals(collateral);
        const currentDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
        const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
        assert.equal(toWei("1250").toString(), totalUSDAmountBefore.toString());
        assert.equal(toWei("1300").toString(), totalUSDAmountAfter.toString());
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

    it("should stake usdt", async function () {
        const eveAmount = BigNumber.from("700000000");
        const samAmount = BigNumber.from("300000000");
        const amount = eveAmount.add(samAmount);
        const amountWei = toWei(amount.div(1e6).toString());
        const collateral = this.usdtToken.address;
        const prevOracleStaking = await this.delegatedStaking.getOracleStaking(sarah, collateral);
        const prevCollateral = await this.delegatedStaking.collaterals(collateral);
        const prevDelegation = await this.delegatedStaking.getDelegationInfo(sarah, collateral);
        const prevEveDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(sarah, eve, collateral);
        const prevSamDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(sarah, sam, collateral);
        const totalUSDAmountBefore = await this.delegatedStaking.getTotalUSDAmount(sarah);
        await this.delegatedStaking.connect(eveAccount).stake(sarah, collateral, eveAmount);
        await this.delegatedStaking.connect(samAccount).stake(sarah, collateral, samAmount);
        const totalUSDAmountAfter = await this.delegatedStaking.getTotalUSDAmount(sarah);
        const currentOracleStaking = await this.delegatedStaking.getOracleStaking(sarah, collateral);
        const currentCollateral = await this.delegatedStaking.collaterals(collateral);
        const currentDelegation = await this.delegatedStaking.getDelegationInfo(sarah, collateral);
        const currentEveDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(sarah, eve, collateral);
        const currentSamDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(sarah, sam, collateral);
        assert.equal(totalUSDAmountBefore.add(amountWei).toString(), totalUSDAmountAfter.toString());
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
            prevEveDelegatorStakes[1].add(toBN(eveAmount)).toString(),
            currentEveDelegatorStakes[1].toString()
        );
        assert.equal(
            prevSamDelegatorStakes[1].add(toBN(samAmount)).toString(),
            currentSamDelegatorStakes[1].toString()
        );
        assert(currentEveDelegatorStakes[2].toString() > prevEveDelegatorStakes[2].toString(), "number of delegator shares increases");
        assert.equal(currentEveDelegatorStakes[2].toString(), eveAmount.toString());
        assert(currentSamDelegatorStakes[2].toString() > prevSamDelegatorStakes[2].toString(), "number of delegator shares increases");
        assert.equal(currentSamDelegatorStakes[2].toString(), samAmount.toString());
        assert(currentDelegation[1].toString() > prevDelegation[1].toString(), "number of total oracle shares increases");
        assert.equal(currentEveDelegatorStakes[4], 0);
        assert.equal(currentSamDelegatorStakes[4], 0);
    });
    it("credit rewards in case of delegator stake", async function() {
      const amount = "100000000";
      const collateral = this.usdtToken.address;
      await this.usdtToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.usdtToken.approve(this.delegatedStaking.address, MaxUint256);
      const dependsCollateral = this.linkToken.address;
      const prevAccTokensPerShare = await this.delegatedStaking.getTokensPerShare(sarah, collateral, dependsCollateral);
      await this.delegatedStaking.distributeRewards(sarah, collateral, amount);
      const currentAccTokensPerShare = await this.delegatedStaking.getTokensPerShare(sarah, collateral, dependsCollateral);
      await this.delegatedStaking.connect(eveAccount).stake(sarah, collateral, amount);
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(sarah, eve, collateral);
      assert.equal(prevAccTokensPerShare[0].toString(), "0");
      assert.equal(prevAccTokensPerShare[1].toString(), "0");
      assert.equal(currentAccTokensPerShare[0].toString(), "100000000000000000");
      assert.equal(currentAccTokensPerShare[1].toString(), "0");
      assert.equal(currentDelegatorStakes[1].toString(), "870000000");
      assert.equal(currentDelegatorStakes[2].toString(), "870000000");
      assert.equal(currentDelegatorStakes[4].toString(), "87000000");
    });
    it("does not credit rewards in case of delegator stake passed rewards", async function() {
      const amount = "100000000";
      const collateral = this.usdtToken.address;
      await this.usdtToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.usdtToken.approve(this.delegatedStaking.address, MaxUint256);
      const dependsCollateral = this.linkToken.address;
      const accTokensPerShare = await this.delegatedStaking.getTokensPerShare(sarah, collateral, dependsCollateral);
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(sarah, eve, collateral);
      await this.delegatedStaking.connect(eveAccount).stake(sarah, collateral, amount);
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(sarah, eve, collateral);
      assert.equal(accTokensPerShare[0].toString(), "100000000000000000");
      assert.equal(accTokensPerShare[1].toString(), "0");
      assert.equal(currentDelegatorStakes[1].toString(), "970000000");
      assert.equal(currentDelegatorStakes[2].toString(), "970000000");
      assert.equal(currentDelegatorStakes[4].toString(), "97000000");
    });

    it("pass in case of collateral staking not exceeded", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.delegatedStaking['updateCollateral(address,uint256)'](collateral, toWei("1000"));
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount);
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
      await this.delegatedStaking['updateCollateral(address,uint256)'](this.linkToken.address, MaxUint256);
    });

    it("fail in case of collateral staking exceed", async function() {
      const amount = toWei("1000");
      const collateral = this.linkToken.address;
      await this.delegatedStaking['updateCollateral(address,uint256)'](collateral, toWei("1000"));
      await expectRevert(
        this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount),
        "collateral limited"
      );
      await this.delegatedStaking['updateCollateral(address,uint256)'](this.linkToken.address, MaxUint256);
    });

    it("test delegator admin is set to sender if admin zero address", async function() {
      const amount = toWei("50");
      const prevCarol = await this.delegatedStaking.getUserInfo(carol);
      assert.equal(
        prevCarol.admin.toString(),
        ZERO_ADDRESS
      );
      await this.delegatedStaking.connect(carolAccount).stake(david, this.linkToken.address, amount);
      const currentCarol = await this.delegatedStaking.getUserInfo(carol);
      assert.equal(
        currentCarol.admin.toString(),
        carol
      );
    });

    it("should not increment oracle delegator count if already exists", async function() {
      const collateral = this.linkToken.address;
      const amount = toWei("10");
      await this.delegatedStaking.connect(eveAccount).stake(david, this.linkToken.address, amount);
      const previousDelegationInfo = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const previousDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      assert.equal(previousDelegatorStakes[0], true);
      await this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount);
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
      await this.delegatedStaking.connect(eveAccount).stake(bob, collateral, amount);
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

    it("should increment oracle delegator count if does not exist", async function() {
      const collateral = this.linkToken.address;
      const amount = toWei("50");
      const previousDelegation = await this.delegatedStaking.getDelegationInfo(bob, this.linkToken.address);
      const previousDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(bob, sam, collateral);
      assert.equal(previousDelegatorStakes[0], false);
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: sam });
      await this.delegatedStaking.connect(samAccount).stake(bob, this.linkToken.address, amount);
      const currentDelegation = await this.delegatedStaking.getDelegationInfo(bob, this.linkToken.address);
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(bob, sam, collateral);
      assert.equal(currentDelegatorStakes[0], true);
      assert.equal(
        previousDelegation[2].add(toBN(1)).toString(),
        currentDelegation[2].toString()
      );
    });

    it("should correctly calculate shares for subsequent deposits", async function() {
      const amount = toWei("50");
      const collateral = this.linkToken.address;
      await this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount);
      const previousDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      await this.delegatedStaking.connect(carolAccount).stake(david, collateral, amount);
      const currentDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      assert(currentDelegation[1].toString() > previousDelegation[1].toString(), "shares increase with deposits");
      const firstDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      const secondDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, carol, collateral);
      assert(secondDelegatorStakes[2].toString() <= firstDelegatorStakes[2].toString(), 
        "subsequent delegators receive equal or fewer shares per amount");
    });
  });

  context("Test realistic scenarios", async function() {
    it("several hundred delegators to 6 validators", async function() {
      random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
      this.signers = await ethers.getSigners();
      const amount = toWei("200");
      this.timeout(0);
      for(i=0; i<200; i++) {
        delegatorAccount = this.signers[i+13];
        validatorAccount = this.signers[random(1, 6) + 7];
        validator = validatorAccount.address;
        delegator = delegatorAccount.address
        await this.linkToken.mint(delegator, toWei("3200000"));
        await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: delegator });
        await this.delegatedStaking.connect(delegatorAccount).stake(validator, this.linkToken.address, amount);
      }
      this.timeout(20000);
      await this.delegatedStaking.distributeRewards(this.signers[random(1, 6) + 7].address, this.linkToken.address, toWei("2000"));
      delegatorAccount = this.signers[14];
      validatorAccount = this.signers[8];
      await this.delegatedStaking.connect(delegatorAccount).stake(validatorAccount.address, this.linkToken.address, amount);
    });
  });

  context("Test request unstaking of different amounts by oracle", async () => {
    it("should unstake 0 tokens", async function() {
      const amount = 0;
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.requestUnstake(bob, collateral, alice, amount);
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevOracleStaking[0].toString(),
        currentOracleStaking[0].toString()
      );
      assert.equal(prevCollateral.totalLocked.toString(), currentCollateral.totalLocked.toString());
    });

    before(async function() {
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(bob, this.linkToken.address, toWei("5"));
    })
    it("should unstake 5 tokens", async function() {
      const amount = toWei("5");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.requestUnstake(bob, collateral, alice, amount);
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
        this.delegatedStaking.requestUnstake(bob, collateral, bob, amount),
        "revert" // doesn't get to "bad amount" if collateral decrement underflows beforehand
      );
    });

    it("fail in case of unstaking too many tokens", async function() {
      const amount = toWei("200");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.delegatedStaking.requestUnstake(bob, collateral, bob, amount),
        "bad amount"
      );
    });

    it("fail in case of unstaking undefined collateral", async function() {
      const amount = toWei("10");
      const collateral = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      await expectRevert.unspecified(
        this.delegatedStaking.requestUnstake(bob, collateral, alice, amount)
      );
    });
  });

  context("Test request unstaking of different amounts by delegator", async () => {
    before(async function() {
      const amount = toWei("100");
      const collateral = this.linkToken.address;
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: david });
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(david, collateral, amount);
      await this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount);
    });

    it("should unstake 0 tokens", async function() {
      const amount = 0;
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      await this.delegatedStaking.connect(eveAccount).requestUnstake(david, collateral, alice, amount);
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
      await this.delegatedStaking.connect(eveAccount).requestUnstake(david, collateral, eve, amount);
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
        this.delegatedStaking.connect(eveAccount).requestUnstake(david, collateral, eve, MaxUint256),
        "bad amount"
      );
    });

    it("should fail in case of delegator !exist", async function() {
      const amount = toWei("55");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.delegatedStaking.connect(carolAccount).requestUnstake(bob, collateral, alice, amount),
        "delegator !exist"
      );
    });
  });

  context("Test request unstaking permissions", async () => {
    before(async function() {
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(bob, this.linkToken.address, toWei("10"));
    })
    it("should unstake by admin", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevDelegation = await this.delegatedStaking.getDelegationInfo(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.requestUnstake(bob, collateral, alice, amount);
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
      const amount = toWei("100");
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(sarah, this.linkToken.address, amount);
      await this.delegatedStaking.requestUnstake(sarah, this.linkToken.address, alice, toWei("10"));
    })

    it("fail in case of execute unstaking before timelock", async function() {
      await this.delegatedStaking.requestUnstake(sarah, this.linkToken.address, alice, toWei("10"));
      await expectRevert(
        this.delegatedStaking.executeUnstake(sarah, 1),
        "too early"
      );
    });

    it("fail in case of execute unstaking from future", async function() {
      await expectRevert(
        this.delegatedStaking.executeUnstake(sarah, 10),
        "request !exist"
      );
    });

    it("should execute unstake", async function() {
      await sleep(2000);
      const withdrawalId = 0;
      const prevWithdrawalInfo = await this.delegatedStaking.getWithdrawalRequest(
        sarah,
        withdrawalId
      );
      const collateral = prevWithdrawalInfo.collateral;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.executeUnstake(sarah, withdrawalId);
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentWithdrawalInfo = await this.delegatedStaking.getWithdrawalRequest(
        sarah,
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
        this.delegatedStaking.executeUnstake(sarah, 0),
        "already executed"
      );
    });
  });

  context("Test liquidate different amounts", async () => {
    before(async function() {
      const amount = toWei("10");
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(bob, this.linkToken.address, amount);
    })

    it("should execute liquidate 0 tokens", async function() {
      const amount = toWei("0");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking['liquidate(address,address,uint256)'](bob, collateral, amount);
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
      await this.delegatedStaking['liquidate(address,address,uint256)'](bob, collateral, amount);
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
        this.delegatedStaking['liquidate(address,address,uint256)'](bob, collateral, amount),
        "bad amount"
      );
    });
  });

  context("Test liquidate by different users", async () => {
    before(async function() {
      const amount = toWei("10");
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(bob, this.linkToken.address, amount);
    })
    it("should execute liquidate by admin", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking['liquidate(address,address,uint256)'](bob, collateral, amount);
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
        this.delegatedStaking.connect(carolAccount)['liquidate(address,address,uint256)'](bob, collateral, amount),
        "onlyAdmin"
      );
    });
  });

  context("Test withdraw different liquidated amounts", async () => {
    before(async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(bob, collateral, amount);
      await this.delegatedStaking['liquidate(address,address,uint256)'](bob, collateral, amount);
    })
    it("should execute withdrawal of 0 liquidated tokens", async function() {
      const amount = toWei("0");
      const collateral = this.linkToken.address;
      const recepient = alice;
      const prevAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.withdrawFunds(recepient, collateral, amount);
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
      await this.delegatedStaking.withdrawFunds(recepient, collateral, amount);
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
        this.delegatedStaking.withdrawFunds(alice, collateral, amount),
        "bad amount"
      );
    });
  });

  context("Test withdraw liquidated funds by different users", async () => {
    before(async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(bob, collateral, amount);
      await this.delegatedStaking['liquidate(address,address,uint256)'](bob, collateral, amount);
    })
    it("should execute withdrawal by the admin", async function() {
      const amount = toWei("1");
      const collateral = this.linkToken.address;
      const recepient = alice;
      const prevAliceGovBalance = toBN(
        await this.linkToken.balanceOf(recepient)
      );
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.withdrawFunds(recepient, collateral, amount);
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
        this.delegatedStaking.connect(bobAccount).withdrawFunds(alice, collateral, amount),
        "onlyAdmin"
      );
    });
  });

  context("Test rewards distribution", async () => {
    before(async function() {
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.delegatedStaking.connect(eveAccount).stake(bob, this.linkToken.address, toWei("200"));
    });
    it("should pay for oracle who set profit sharing as zero", async function() {
      const collateral = this.linkToken.address;
      await this.delegatedStaking['updateCollateral(address,bool)'](collateral, true);
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
      await this.usdcToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.delegatedStaking.connect(eveAccount).stake(david, this.usdcToken.address, "200000000");
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      const prevOracleStake = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      const prevTokensPerShare = await this.delegatedStaking.getTokensPerShare(david, collateral, dependsCollateral);
      await this.delegatedStaking.distributeRewards(david, collateral, amount);
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
      await this.delegatedStaking['updateCollateral(address,bool)'](collateral, false);
      await expectRevert(
        this.delegatedStaking.distributeRewards(david, collateral, amount),
        "collateral disabled"
      );
      await this.delegatedStaking['updateCollateral(address,bool)'](collateral, true);
    });
  });

  context("Test deposit to strategy", async () => {
    it("should fail if strategy not enabled", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address
      const strategy = this.mockAaveController.address;
      await this.delegatedStaking.updateStrategy(strategy, collateral, false);
      await expectRevert(
        this.delegatedStaking.depositToStrategy(bob, amount, strategy, collateral), 
        "strategy disabled"
      );
      await this.delegatedStaking.updateStrategy(strategy, collateral, true);
    });
    it("should fail if delegator !exist", async function() {
      const amount = toWei("10");
      const strategy = this.mockAaveController.address;
      await expectRevert(
        this.delegatedStaking.connect(bobAccount).depositToStrategy(eve, amount, strategy, this.linkToken.address), 
        "delegator !exist"
      );
    });
    it("should update balances after deposit to aave", async function() {
      const stakeAmount = toWei("100");
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const strategy = this.mockAaveController.address;
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(bob, collateral, stakeAmount);
      const prevOracleStake = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const prevStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      const prevDepositInfo = await this.delegatedStaking['getStrategyDepositInfo(address,address,address)'](bob, strategy, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.depositToStrategy(bob, amount, strategy, collateral);
      const currentOracleStake = await this.delegatedStaking.getOracleStaking(bob, collateral);
      const currentStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      const currentDepositInfo = await this.delegatedStaking['getStrategyDepositInfo(address,address,address)'](bob, strategy, collateral);
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
      const strategy = this.mockAaveController.address;
      await expectRevert(this.delegatedStaking.depositToStrategy(bob, amount, strategy, this.linkToken.address), "bad amount");
    });
  });

  context("Test withdraw from strategy", async () => {
    before(async function() {
      const collateral = this.linkToken.address;
      const amount = toWei("200");
      const strategy = this.mockAaveController.address;
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.delegatedStaking.stake(david, collateral, amount);
      await this.delegatedStaking.stake(bob, collateral, toWei("100"));
      await this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount);
      await this.delegatedStaking.connect(eveAccount).stake(bob, collateral, amount);
      await this.delegatedStaking.depositToStrategy(david, toWei("10"), strategy, collateral);
      await this.delegatedStaking.depositToStrategy(bob, toWei("10"), strategy, collateral);
      await this.delegatedStaking.connect(eveAccount).depositToStrategy(david, toWei("10"), strategy, collateral);
      await this.lendingPool.increaseCurrentTime(60*24*60*60);
    });
    it("should fail if strategy not enabled", async function() {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const strategy = this.mockAaveController.address;
      await this.delegatedStaking.updateStrategy(strategy, collateral, false);
      await expectRevert(
        this.delegatedStaking.withdrawFromStrategy(bob, amount, strategy, collateral), 
        "strategy disabled"
      );
      await this.delegatedStaking.updateStrategy(strategy, collateral, true);
    });
    it("should fail if delegator !exist", async function() {
      const amount = toWei("10");
      const strategy = this.mockAaveController.address;
      await expectRevert(
        this.delegatedStaking.withdrawFromStrategy(eve, amount, strategy, this.linkToken.address), 
        "delegator !exist"
      );
    });
    it("should fail when withdraw insufficient share", async function() {
      const amount = toWei("320000");
      const strategy = this.mockAaveController.address;
      await expectRevert(this.delegatedStaking.withdrawFromStrategy(bob, amount, strategy, this.linkToken.address), "bad amount");
    });
    it("should decrement strategy and deposit info after withdraw", async function() {
      const collateral = this.linkToken.address;
      const amount = toWei("100");
      const strategy = this.mockAaveController.address;
      const prevStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      const prevDepositInfo = await this.delegatedStaking['getStrategyDepositInfo(address,address,address)'](david, strategy, collateral);
      await this.delegatedStaking.withdrawFromStrategy(david, toWei("2"), strategy, collateral);
      const currentStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      const currentDepositInfo = await this.delegatedStaking['getStrategyDepositInfo(address,address,address)'](david, strategy, collateral);
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
        prevDepositInfo[1].toString() - currentDepositInfo[1].toString() > 0,
        "shares decrease"
      );
    });
    it("should increase staking after oracle withdraw", async function() {
      const collateral = this.linkToken.address;
      const strategy = this.mockAaveController.address;

      const prevOracleStake = await this.delegatedStaking.getOracleStaking(david, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevRewards = await this.delegatedStaking.getRewards(david, collateral);
      await this.delegatedStaking.withdrawFromStrategy(david, toWei("2"), strategy, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentOracleStake = await this.delegatedStaking.getOracleStaking(david, collateral);
      const currentRewards = await this.delegatedStaking.getRewards(david, collateral);
      
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
      assert(
        prevCollateral.totalLocked.toString() <
        currentCollateral.totalLocked.toString()
      );

    });
    it("should increase stakes after delegator withdraw", async function() {
      const collateral = this.linkToken.address;
      const strategy = this.mockAaveController.address;
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      const prevDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      await this.delegatedStaking.connect(eveAccount).withdrawFromStrategy(david, toWei("2"), strategy, collateral);
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      const currentDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
      
      assert(prevDelegation[0].toString() < currentDelegation[0].toString());
      assert(prevDelegatorStakes[1].toString() < currentDelegatorStakes[1].toString());
      assert(prevDelegatorStakes[2].toString() < currentDelegatorStakes[2].toString());
      assert(prevDelegation[1].toString() < currentDelegation[1].toString());
    });
    it("should increment reward balances", async function() {
      const collateral = this.linkToken.address;
      const strategy = this.mockAaveController.address;
      const prevRewards = await this.delegatedStaking.getRewards(bob, collateral);
      const prevStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      await this.delegatedStaking.withdrawFromStrategy(bob, toWei("2"), strategy, collateral);
      const currentRewards = await this.delegatedStaking.getRewards(bob, collateral);
      const currentStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      
      assert(prevRewards[0].toString() < currentRewards[0].toString());
      assert(prevRewards[1].toString() < currentRewards[1].toString());
      assert(prevRewards[2].toString() < currentRewards[2].toString());
      assert(prevStrategyStakes[1].toString() > currentStrategyStakes[1].toString());
    });
  });

  context("Test emergency withdraw from strategy", async function() {
    beforeEach(async function() {
      const collateral = this.linkToken.address;
      const amount = toWei("200");
      const strategy = this.mockAaveController.address;
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.delegatedStaking.stake(david, collateral, amount);
      await this.delegatedStaking.stake(bob, collateral, toWei("100"));
      await this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount);
      await this.delegatedStaking.connect(eveAccount).stake(bob, collateral, amount);
      await this.delegatedStaking.depositToStrategy(david, toWei("100"), strategy, collateral);
      await this.delegatedStaking.depositToStrategy(bob, toWei("100"), strategy, collateral);
      await this.delegatedStaking.connect(eveAccount).depositToStrategy(david, toWei("100"), strategy, collateral);
      await this.lendingPool.increaseCurrentTime(60*24*60*60);
    });
    it("should fail if not called by contract admin", async function() {
      const strategy = this.mockAaveController.address;
      await expectRevert(
        this.delegatedStaking.connect(bobAccount).emergencyWithdrawFromStrategy(strategy, this.linkToken.address), 
        "onlyAdmin"
      );
    });
    it("should fail if strategy not enabled", async function() {
      const strategy = this.mockAaveController.address;
      const collateral = this.linkToken.address;
      await this.delegatedStaking.updateStrategy(strategy, collateral, false);
      await expectRevert(
        this.delegatedStaking.emergencyWithdrawFromStrategy(strategy, collateral), 
        "strategy disabled"
      );
      await this.delegatedStaking.updateStrategy(strategy, collateral, true);
    });
    it("should disable strategy and set recoverable", async function() {
      const strategy = this.mockAaveController.address;
      const collateral = this.linkToken.address;
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      await this.delegatedStaking.emergencyWithdrawFromStrategy(strategy, collateral);
      const strategyAfter = await this.delegatedStaking.getStrategy(strategy, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      assert.equal(strategyAfter.isEnabled, false);
      assert.equal(strategyAfter.isRecoverable, true);
      assert(
        prevCollateral.totalLocked.toString() <
        currentCollateral.totalLocked.toString()
      );
      assert(
        prevStrategyStakes[0].toString() <=
        currentStrategyStakes[0].toString()
      );
    await this.delegatedStaking.resetStrategy(strategy, collateral);
    });
  });

  context("Test recover from emergency", async () => {
    beforeEach(async function() {
      const collateral = this.linkToken.address;
      const amount = toWei("200");
      const strategy = this.mockAaveController.address;
      await this.delegatedStaking.updateStrategy(strategy, collateral, false);
      await this.delegatedStaking.updateStrategyRecoverable(strategy, collateral, true);
      await this.delegatedStaking.resetStrategy(strategy, collateral);
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.delegatedStaking.stake(david, collateral, amount);
      await this.delegatedStaking.stake(bob, collateral, toWei("100"));
      await this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount);
      await this.delegatedStaking.connect(eveAccount).stake(bob, collateral, amount);
      await this.delegatedStaking.depositToStrategy(david, toWei("100"), strategy, collateral);
      await this.delegatedStaking.depositToStrategy(bob, toWei("100"), strategy, collateral);
      await this.delegatedStaking.connect(eveAccount).depositToStrategy(david, toWei("100"), strategy, collateral);
      await this.lendingPool.increaseCurrentTime(60*24*60*60);
      await this.delegatedStaking.emergencyWithdrawFromStrategy(strategy, collateral);
    });
    it("should fail if strategy enabled", async function() {
      const strategy = this.mockAaveController.address;
      const collateral = this.linkToken.address;
      await this.delegatedStaking.updateStrategy(strategy, collateral, true);
      await expectRevert(
        this.delegatedStaking.recoverFromEmergency(strategy, collateral, [david, bob]), 
        "strategy enabled"
      );
    });
    it("should fail if funds not recoverable", async function() {
      const strategy = this.mockAaveController.address;
      const collateral = this.linkToken.address;
      await this.delegatedStaking.updateStrategy(strategy, collateral, false);
      await this.delegatedStaking.updateStrategyRecoverable(strategy, collateral, false);
      await expectRevert(
        this.delegatedStaking.recoverFromEmergency(strategy, collateral, [david, bob]), 
        "not recoverable"
      );
      await this.delegatedStaking.updateStrategyRecoverable(strategy, collateral, true);
    });
    it("should succeed if called by non contract admin", async function() {
      const strategy = this.mockAaveController.address;
      const collateral = this.linkToken.address;
      const txReceipt = await this.delegatedStaking.connect(samAccount).recoverFromEmergency(strategy, this.linkToken.address, [david, bob]);

      await expect(txReceipt)
        .to.emit(this.delegatedStaking, "RecoveredFromEmergency")
        .withArgs(
          david,
          toBN(150000000000000000000),
          this.mockAaveController.address,
          this.linkToken.address
        );
      await expect(txReceipt)
        .to.emit(this.delegatedStaking, "RecoveredFromEmergency")
        .withArgs(
          eve,
          toBN(75000000000000000000),
          this.mockAaveController.address,
          this.linkToken.address
        );
      await expect(txReceipt)
        .to.emit(this.delegatedStaking, "RecoveredFromEmergency")
        .withArgs(
          bob,
          toBN(75000000000000000000),
          this.mockAaveController.address,
          this.linkToken.address
        );
      await this.delegatedStaking.resetStrategy(strategy, collateral);
    });
    it("should decrease strategy shares and reserves", async function() {
      const collateral = this.linkToken.address;
      const strategy = this.mockAaveController.address;
      const prevStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      const prevDepositInfo = await this.delegatedStaking['getStrategyDepositInfo(address,address,address)'](bob, strategy, collateral);
      await this.delegatedStaking.recoverFromEmergency(strategy, collateral, [david, bob]);
      const currentStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      const currentDepositInfo = await this.delegatedStaking['getStrategyDepositInfo(address,address,address)'](bob, strategy, collateral);
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
      await this.delegatedStaking.resetStrategy(strategy, collateral);
    });
    it("should reset oracle locked", async function() {
      const strategy = this.mockAaveController.address;
      const collateral = this.linkToken.address;
      const prevOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      assert.notEqual(prevOracleStaking[1].toString(), 0);
      await this.delegatedStaking.recoverFromEmergency(strategy, collateral, [david, bob]);
      const currentOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
      assert.equal(currentOracleStaking[1].toString(), 0);
      await this.delegatedStaking.resetStrategy(strategy, collateral);
    });
    it("should reset delegator locked", async function() {
      const strategy = this.mockAaveController.address;
      const collateral = this.linkToken.address;
      const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      assert.notEqual(prevDelegatorStakes[3].toString(), 0);
      await this.delegatedStaking.recoverFromEmergency(strategy, collateral, [david, bob]);
      const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
      assert.equal(currentDelegatorStakes[3].toString(), 0);
      await this.delegatedStaking.resetStrategy(strategy, collateral);
    });
  });

  context('Test upgrades', function() {
    it('should succeed upgrading to v2', async function() {
      const DelegatedStakingInitParams = require("../assets/delegatedStakingInitParams")["development"];
      const DelegatedStaking = await ethers.getContractFactory("DelegatedStaking");
      const DelegatedStakingV2 = await ethers.getContractFactory("DelegatedStakingV2");
      const collateral = this.linkToken.address;
      const instance = await upgrades.deployProxy(DelegatedStaking, 
      [
        DelegatedStakingInitParams.timelock, 
        collateral
      ]);
      const upgraded = await upgrades.upgradeProxy(instance.address, DelegatedStakingV2);
      const timelock = await upgraded.timelock();
      assert.equal(timelock.toString(), DelegatedStakingInitParams.timelock.toString());
    });
  });
});
