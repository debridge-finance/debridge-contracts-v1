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
const MockFeeProxy = artifacts.require('MockFeeProxy');
const { toWei } = web3.utils;


function toBN(number) {
  return BigNumber.from(number.toString());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function deployPancakeSwapPairs({
  tokens,
  weth,
  provider,
  factory,
  router
}) {

  for (const { token1, liquidityAmount1, liquidityAmount2, token2 } of tokens) {
    try {
      await factory.createPair(token1.address, token2.address)
      await token1.approve(
        router.address,
        MaxUint256,
        { from: provider }
      )

      if (token2 === weth) {
        await weth.deposit({ value: liquidityAmount2 });
      }

      await token2.approve(
        router.address,
        MaxUint256,
        { from: provider }
      )

      await router.addLiquidity(
        token1.address,
        token2.address,
        liquidityAmount1,
        liquidityAmount2,
        0,
        0,
        provider,
        9999999999
      )
    } catch (e) {
      console.log(e)
    }

  }
}

contract("DelegatedStaking", function () {
  before(async function () {
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
    this.TokenCFactory = await ethers.getContractFactory("MockCToken");
    this.TokenYFactory = await ethers.getContractFactory("MockYToken");

    this.AaveProtocolDataProviderFactory = await ethers.getContractFactory("AaveProtocolDataProvider");
    this.LendingPoolFactory = await ethers.getContractFactory("LendingPool");
    this.IncentivesControllerFactory = await ethers.getContractFactory("IncentivesController");
    this.AddressesProviderFactory = await ethers.getContractFactory("LendingPoolAddressesProvider");
    this.MockAaveControllerFactory = await ethers.getContractFactory("MockAaveController");
    this.ComptrollerFactory = await ethers.getContractFactory("Comptroller");
    this.MockCompoundControllerFactory = await ethers.getContractFactory("MockCompoundController");
    this.MockYearnControllerFactory = await ethers.getContractFactory("MockYearnController");
    this.MockYearnVaultFactory = await ethers.getContractFactory("MockYearnVault");
    this.YRegistryFactory = await ethers.getContractFactory("YRegistry");
    this.MockYControllerFactory = await ethers.getContractFactory("MockYController");

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

    this.comptroller = await this.ComptrollerFactory.deploy();
    await this.comptroller.deployed();
    this.cLinkToken = await this.TokenCFactory.deploy(
      this.comptroller.address,
      "cLink Token",
      "cLINK",
      18,
      this.linkToken.address
    );
    await this.cLinkToken.deployed();
    await this.comptroller.addMarket(this.cLinkToken.address);

    this.mockYController = await this.MockYControllerFactory.deploy();
    await this.mockYController.deployed();
    this.yRegistry = await this.YRegistryFactory.deploy();
    await this.yRegistry.deployed();
    this.yLinkToken = await this.TokenYFactory.deploy(
      this.yRegistry.address,
      "yLink Token",
      "yLINK",
      18,
      this.linkToken.address
    );
    await this.yLinkToken.deployed();
    this.mockYearnVault = await this.MockYearnVaultFactory.deploy(this.yLinkToken.address, this.mockYController.address);
    await this.mockYearnVault.deployed();
    await this.mockYController.setVault(this.linkToken.address, this.mockYearnVault.address);
    await this.yRegistry.addVault(this.mockYearnVault.address);

    const mintUSDAmount = "100000000000"; //100k
    const mintLinkAmount = toWei("100000"); //100k

    await this.linkToken.mint(alice, mintLinkAmount);
    await this.usdcToken.mint(alice, mintUSDAmount);
    await this.usdtToken.mint(alice, mintUSDAmount);

    await this.linkToken.mint(eve, mintLinkAmount);
    await this.usdcToken.mint(eve, mintUSDAmount);
    await this.usdtToken.mint(eve, mintUSDAmount);

    await this.linkToken.mint(sam, mintLinkAmount);
    await this.usdcToken.mint(sam, mintUSDAmount);
    await this.usdtToken.mint(sam, mintUSDAmount);

    await this.linkToken.mint(carol, mintLinkAmount);
    await this.usdcToken.mint(carol, mintUSDAmount);
    await this.usdtToken.mint(carol, mintUSDAmount);

    await this.linkToken.mint(this.lendingPool.address, toWei("3200000"));

    this.mockAaveController = await this.MockAaveControllerFactory.deploy(
      this.addressProvider.address,
      this.dataProvider.address
    );
    await this.mockAaveController.deployed();

    this.mockCompoundController = await this.MockCompoundControllerFactory.deploy(
      this.comptroller.address
    );
    await this.mockCompoundController.deployed();

    this.mockYearnController = await this.MockYearnControllerFactory.deploy(
      this.yRegistry.address
    );
    await this.mockYearnController.deployed();

    const WETH9 = await deployments.getArtifact("WETH9");
    const WETH9Factory = await ethers.getContractFactory(WETH9.abi, WETH9.bytecode, alice);
    this.weth = await WETH9Factory.deploy();

    const UniswapV2 = await deployments.getArtifact("UniswapV2Factory");
    const UniswapV2Factory = await ethers.getContractFactory(UniswapV2.abi, UniswapV2.bytecode, alice);
    this.uniswapFactory = await UniswapV2Factory.deploy(carol);

    const UniswapV2RouterArtifact = await deployments.getArtifact("UniswapV2Router02");
    const UniswapV2Router = await ethers.getContractFactory(UniswapV2RouterArtifact.abi, UniswapV2RouterArtifact.bytecode, alice);
    this.uniswapRouter = await UniswapV2Router.deploy(this.uniswapFactory.address, this.weth.address);

    await deployPancakeSwapPairs({
      tokens: [
        {
          token1: this.linkToken, liquidityAmount1: mintLinkAmount.slice(0, mintLinkAmount.length - 3),
          token2: this.usdcToken, liquidityAmount2: mintUSDAmount.slice(0, mintUSDAmount.length - 3)
        },
        {
          token1: this.linkToken, liquidityAmount1: mintLinkAmount.slice(0, mintLinkAmount.length - 3),
          token2: this.usdtToken, liquidityAmount2: mintUSDAmount.slice(0, mintUSDAmount.length - 3)
        },
        {
          token1: this.linkToken, liquidityAmount1: mintLinkAmount.slice(0, mintLinkAmount.length - 3),
          token2: this.weth, liquidityAmount2: (10e18).toString()
        },
        {
          token1: this.usdcToken, liquidityAmount1: mintUSDAmount.slice(0, mintUSDAmount.length - 3),
          token2: this.usdtToken, liquidityAmount2: mintUSDAmount.slice(0, mintUSDAmount.length - 3)
        },
        {
          token1: this.usdtToken, liquidityAmount1: mintUSDAmount.slice(0, mintUSDAmount.length - 3),
          token2: this.weth, liquidityAmount2: (10e18).toString()
        },
        {
          token1: this.usdcToken, liquidityAmount1: mintUSDAmount.slice(0, mintUSDAmount.length - 3),
          token2: this.weth, liquidityAmount2: (10e18).toString()
        }
      ],
      weth: this.weth,
      provider: alice,
      router: this.uniswapRouter,
      factory: this.uniswapFactory
    })

    this.timelock = 1;
    this.slashingTreasuryAddress = alice;
    this.mockPriceConsumer = await MockPriceConsumer.new();
    this.mockFeeProxy = await MockFeeProxy.new(this.uniswapFactory.address, this.weth.address, this.slashingTreasuryAddress);
    this.DelegatedStaking = await ethers.getContractFactory("DelegatedStaking", alice);
    this.delegatedStaking = await upgrades.deployProxy(this.DelegatedStaking, [
      this.timelock,
      this.mockPriceConsumer.address,
      this.mockFeeProxy.address,
      this.slashingTreasuryAddress
    ]);
    await this.delegatedStaking.deployed();


    await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
    await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
    await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: carol });
    await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: sam });

    await this.usdtToken.approve(this.delegatedStaking.address, MaxUint256);
    await this.usdtToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
    await this.usdtToken.approve(this.delegatedStaking.address, MaxUint256, { from: carol });
    await this.usdtToken.approve(this.delegatedStaking.address, MaxUint256, { from: sam });

    await this.usdcToken.approve(this.delegatedStaking.address, MaxUint256);
    await this.usdcToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
    await this.usdcToken.approve(this.delegatedStaking.address, MaxUint256, { from: carol });
    await this.usdcToken.approve(this.delegatedStaking.address, MaxUint256, { from: sam });

    //   function addValidator(
    //     address _validator,
    //     address _admin,
    //     uint256 _rewardWeightCoefficient,
    //     uint256 _profitSharingBPS
    // )


    this.timelock = 2
    await this.delegatedStaking.setWithdrawTimelock(this.timelock);
    assert.equal(await this.delegatedStaking.withdrawTimelock(), this.timelock);

    assert.equal((await this.delegatedStaking.minProfitSharingBPS()).toString(), 5000);
    assert.exists(await this.mockPriceConsumer.priceFeeds(this.linkToken.address));
  });

  context("Test management main properties", async () => {
    it("should update if called by admin", async function () {
      assert.equal((await this.delegatedStaking.minProfitSharingBPS()).toString(), 5000);
      await this.delegatedStaking.setMinProfitSharing(100);
      assert.equal((await this.delegatedStaking.minProfitSharingBPS()).toString(), 100);

      await this.delegatedStaking.setMinProfitSharing(0);
      assert.equal((await this.delegatedStaking.minProfitSharingBPS()).toString(), 0);

      await expectRevert(
        this.delegatedStaking.setMinProfitSharing(10001),
        "WrongArgument()"
      );
    });
    it("should fail if called by non admin", async function () {
      await expectRevert(
        this.delegatedStaking.connect(eveAccount).setMinProfitSharing(10001),
        "AdminBadRole()"
      );
    });
  });

  context("Test management validators", async () => {
    it("should add if called by admin", async function () {
      await this.delegatedStaking.addValidator(bob, alice, 1, 2500);
      await this.delegatedStaking.addValidator(david, alice, 1, 5000);
      await this.delegatedStaking.addValidator(sarah, alice, 2, 10000);
      // // setup for realistic case
      // for(i=7; i<13; i++) {
      //   oracleAccount = this.signers[i];
      //   oracle = oracleAccount.address;
      //   await this.delegatedStaking.addValidator(oracle, alice, 1, 10000);
      // }
      const bobOracle = await this.delegatedStaking.getValidatorInfo(bob);
      const davidOracle = await this.delegatedStaking.getValidatorInfo(david);
      const sarahOracle = await this.delegatedStaking.getValidatorInfo(sarah);

      assert.equal(bobOracle.admin, alice);
      assert.equal(davidOracle.admin, alice);
      assert.equal(sarahOracle.admin, alice);

      assert.equal(bobOracle.rewardWeightCoefficient, 1);
      assert.equal(davidOracle.rewardWeightCoefficient, 1);
      assert.equal(sarahOracle.rewardWeightCoefficient, 2);

      assert.equal(bobOracle.profitSharingBPS, 2500);
      assert.equal(davidOracle.profitSharingBPS, 5000);
      assert.equal(sarahOracle.profitSharingBPS, 10000);
    });
    it("should fail if called by non admin", async function () {
      await expectRevert(
        this.delegatedStaking.connect(eveAccount).addValidator(sarah, alice, 2, 10000),
        "AdminBadRole()"
      );
    });
    it("should increase profit sharing if less than new minimum", async function () {
      const bobOracle = await this.delegatedStaking.getValidatorInfo(bob);
      const davidOracle = await this.delegatedStaking.getValidatorInfo(david);
      const sarahOracle = await this.delegatedStaking.getValidatorInfo(sarah);
      const minSharingBefore = await this.delegatedStaking.minProfitSharingBPS();
      const bobSharingBefore = await bobOracle.profitSharingBPS;
      const davidSharingBefore = await davidOracle.profitSharingBPS;
      const sarahSharingBefore = await sarahOracle.profitSharingBPS;
      assert(bobSharingBefore < 5000, "bobOracle profitSharingBPS already greater than new minimum");
      await this.delegatedStaking.setMinProfitSharing(5000);
      const bobOracleAfter = await this.delegatedStaking.getValidatorInfo(bob);
      const davidOracleAfter = await this.delegatedStaking.getValidatorInfo(david);
      const sarahOracleAfter = await this.delegatedStaking.getValidatorInfo(sarah);
      assert.equal(await this.delegatedStaking.minProfitSharingBPS(), 5000);
      assert.equal(bobOracleAfter.profitSharingBPS.toString(), 5000);
      assert.equal(davidOracleAfter.profitSharingBPS.toString(), davidSharingBefore.toString());
      assert.equal(sarahOracleAfter.profitSharingBPS.toString(), sarahSharingBefore.toString());
      // reset bob sharing and minimum
      await this.delegatedStaking.setMinProfitSharing(minSharingBefore);
      assert.equal(await this.delegatedStaking.minProfitSharingBPS(), minSharingBefore.toString());
      await this.delegatedStaking.setProfitSharing(bob, bobSharingBefore);
      const bobOracleReset = await this.delegatedStaking.getValidatorInfo(bob);
      assert.equal(bobOracleReset.profitSharingBPS.toString(), bobSharingBefore.toString());
    });
    it("should update validator", async function () {
      const bobOracle = await this.delegatedStaking.getValidatorInfo(bob);
      assert.equal(bobOracle.isEnabled, true);
      await this.delegatedStaking.updateValidator(bob, false);
      const bobOracleAfter = await this.delegatedStaking.getValidatorInfo(bob);
      assert.equal(bobOracleAfter.isEnabled, false);
      await this.delegatedStaking.updateValidator(bob, true);
      const bobOracleReset = await this.delegatedStaking.getValidatorInfo(bob);
      assert.equal(bobOracleReset.isEnabled, true);
      await expectRevert(
        this.delegatedStaking.updateValidator(bob, true),
        "WrongArgument()"
      );
      await expectRevert(
        this.delegatedStaking.updateValidator(sam, true),
        "WrongArgument()"
      );
    });
  });

  context("Test management collaterals", async () => {
    it("should add if called by admin", async function () {
      await this.delegatedStaking.addCollateral(this.linkToken.address, false, MaxUint256);
      await this.delegatedStaking.addCollateral(this.usdcToken.address, true, MaxUint256);
      await this.delegatedStaking.addCollateral(this.usdtToken.address, true, MaxUint256);

      const linkCollateral = await this.delegatedStaking.collaterals(this.linkToken.address);
      const usdcCollateral = await this.delegatedStaking.collaterals(this.usdcToken.address);
      const usdtCollateral = await this.delegatedStaking.collaterals(this.usdtToken.address);

      assert.equal(linkCollateral.exists, true);
      assert.equal(usdcCollateral.exists, true);
      assert.equal(usdtCollateral.exists, true);
      assert.equal(linkCollateral.isEnabled, true);
      assert.equal(usdcCollateral.isEnabled, true);
      assert.equal(usdtCollateral.isEnabled, true);
      assert.equal(linkCollateral.maxStakeAmount.toString(), MaxUint256);
      assert.equal(usdcCollateral.maxStakeAmount.toString(), MaxUint256);
      assert.equal(usdtCollateral.maxStakeAmount.toString(), MaxUint256);
    });
    it("should enable/disable, set maxStakeAmount if called by admin", async function () {
      await this.delegatedStaking.updateCollateralEnabled(this.linkToken.address, false);
      await this.delegatedStaking.updateCollateral(this.linkToken.address, 100);
      let collateralInfo = await this.delegatedStaking.collaterals(this.linkToken.address);
      assert.equal(collateralInfo.isEnabled, false);
      assert.equal(collateralInfo.maxStakeAmount.toString(), "100");

      await this.delegatedStaking.updateCollateralEnabled(this.linkToken.address, true);
      await this.delegatedStaking.updateCollateral(this.linkToken.address, MaxUint256);
      collateralInfo = await this.delegatedStaking.collaterals(this.linkToken.address);
      assert.equal(collateralInfo.isEnabled, true);
      assert.equal(collateralInfo.maxStakeAmount.toString(), MaxUint256);
    });
    it("should fail if called by non admin", async function () {
      await expectRevert(
        this.delegatedStaking.connect(eveAccount).addCollateral(this.usdtToken.address, true, MaxUint256),
        "AdminBadRole()"
      );
      await expectRevert(
        this.delegatedStaking.connect(eveAccount).updateCollateralEnabled(this.linkToken.address, true),
        "AdminBadRole()"
      );
      await expectRevert(
        this.delegatedStaking.connect(eveAccount).updateCollateral(this.linkToken.address, MaxUint256),
        "AdminBadRole()"
      );
    });
  });

  context("Test management strategies", async () => {
    it("should add if called by admin", async function () {
      this.linkPrice = toWei("0.1");
      this.usdtPrice = toWei("0.0003");
      this.usdcPrice = toWei("0.0003");
      await this.mockPriceConsumer.addPriceFeed(this.linkToken.address, this.linkPrice);
      await this.mockPriceConsumer.addPriceFeed(this.usdtToken.address, this.usdtPrice);
      await this.mockPriceConsumer.addPriceFeed(this.usdcToken.address, this.usdcPrice);
      await this.delegatedStaking.addStrategy(this.mockAaveController.address, this.linkToken.address, this.linkToken.address);
      await this.delegatedStaking.addStrategy(this.mockYearnController.address, this.linkToken.address, this.linkToken.address);
      await this.delegatedStaking.addStrategy(this.mockCompoundController.address, this.linkToken.address, this.linkToken.address);
      const strategy = await this.delegatedStaking.getStrategy(this.mockAaveController.address, this.linkToken.address);
      assert.equal(strategy.isEnabled, true);
      assert.equal(strategy.exists, true);
      //TODO: check others properties
    });
    it("should fail if called by non admin", async function () {
      await expectRevert(
        this.delegatedStaking.connect(eveAccount).addStrategy(this.mockAaveController.address, this.linkToken.address, this.linkToken.address),
        "AdminBadRole()"
      );
    });
  });
  context("Test limitation of staking", async () => {
    it("fail in case of staking undefined collateral", async function () {
      const amount = toWei("10");
      const collateral = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      await expectRevert(
        this.delegatedStaking.stake(alice, bob, collateral, amount),
        "CollateralDisabled()"
      );
    });

    it("fail in case of staking collateral not enabled", async function () {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.delegatedStaking.updateCollateralEnabled(collateral, false);
      await expectRevert(
        this.delegatedStaking.stake(alice, bob, collateral, amount),
        "CollateralDisabled()"
      );
      await this.delegatedStaking.updateCollateralEnabled(collateral, true);
    });

    it("fail in case of collateral staking exceeded", async function () {
      const amount = toWei("1000");
      const collateral = this.linkToken.address;
      await this.delegatedStaking.updateCollateral(collateral, toWei("100"));
      await expectRevert(
        this.delegatedStaking.stake(alice, bob, collateral, amount),
        "CollateralLimited()"
      );
      await this.delegatedStaking.updateCollateral(this.linkToken.address, MaxUint256);
    });
  });

  context("Test staking different amounts", async () => {
    beforeEach(async function () {

    });

    it("should stake [0, 100, 900, 0] link tokens to bob validator (called by alice)", async function () {
      const amounts = [0, toWei("100"), toWei("900"), 0];
      for (const amount of amounts) {
        console.log(`Process amount ${amount}`);
        const collateralAddress = this.linkToken.address;
        const collateralToken = this.linkToken;
        const validatorAddress = bob;
        const delegarorAddress = alice;
        const delegarorAccount = aliceAccount;
        const prevDelegatorsInfo = await this.delegatedStaking.getDelegatorsInfo(validatorAddress, collateralAddress, delegarorAddress);

        const balanceBefore = toBN(await collateralToken.balanceOf(this.delegatedStaking.address));
        const totalUSDAmountBefore = await this.delegatedStaking.getTotalETHAmount(validatorAddress);
        const prevValidatorCollateral = await this.delegatedStaking.getValidatorCollateral(validatorAddress, collateralAddress);
        const prevCollateral = await this.delegatedStaking.collaterals(collateralAddress);

        await this.delegatedStaking.connect(delegarorAccount).stake(delegarorAccount.address, validatorAddress, collateralAddress, amount);

        const balanceAfter = toBN(await collateralToken.balanceOf(this.delegatedStaking.address));
        const totalUSDAmountAfter = await this.delegatedStaking.getTotalETHAmount(validatorAddress);
        const currentDelegatorsInfo = await this.delegatedStaking.getDelegatorsInfo(validatorAddress, collateralAddress, delegarorAddress);
        const currentValidatorCollateral = await this.delegatedStaking.getValidatorCollateral(validatorAddress, collateralAddress);
        const currentCollateral = await this.delegatedStaking.collaterals(collateralAddress);

        // console.log("before stake");
        // console.log(prevCollateral);
        // console.log(prevDelegatorsInfo);
        // console.log(prevValidatorCollateral);
        // console.log("current");
        // console.log(currentCollateral);
        // console.log(currentDelegatorsInfo);
        // console.log(currentValidatorCollateral);

        assert.equal(balanceBefore.add(amount).toString(), balanceAfter.toString());
        assert.equal(prevCollateral.totalLocked.add(amount).toString(), currentCollateral.totalLocked.toString());
        assert.equal(prevDelegatorsInfo.shares.add(amount).toString(), currentDelegatorsInfo.shares.toString());
        // total share locked by depositing to strategy
        assert.equal(prevDelegatorsInfo.locked.toString(), "0");
        assert.equal(prevDelegatorsInfo.locked.toString(), currentDelegatorsInfo.locked.toString());
        // how many reward tokens user will receive per one share
        assert.equal(prevDelegatorsInfo.accumulatedRewards.toString(), "0");
        assert.equal(prevDelegatorsInfo.accumulatedRewards.toString(), currentDelegatorsInfo.accumulatedRewards.toString());
        // total tokens staked by delegators
        assert.equal(prevValidatorCollateral.stakedAmount.add(amount).toString(), currentValidatorCollateral.stakedAmount.toString());
        // total share of collateral tokens
        assert.equal(prevValidatorCollateral.shares.add(amount).toString(), currentValidatorCollateral.shares.toString());
        // total share locked by depositing to strategy
        assert.equal(prevValidatorCollateral.locked.toString(), "0");
        assert.equal(prevValidatorCollateral.locked.toString(), currentValidatorCollateral.locked.toString());
        // info how many reward tokens  was earned
        assert.equal(prevValidatorCollateral.accumulatedRewards.toString(), "0");
        assert.equal(prevValidatorCollateral.accumulatedRewards.toString(), currentValidatorCollateral.accumulatedRewards.toString());
        // check increase USD pool cost
        //TODO: check getTotalETHAmount!!!
        // console.log("totalUSDAmountAfter");
        // console.log(totalUSDAmountAfter.toString());
        // console.log(totalUSDAmountBefore.toString());
        // console.log(totalUSDAmountAfter.sub(totalUSDAmountBefore).toString());
        // console.log(toBN(amount).mul(this.linkPrice).div(1e18) .toString());
        // assert.equal(totalUSDAmountAfter.sub(totalUSDAmountBefore), toBN(amount).mul(this.linkPrice).div(1e18) );
      }
    });

    it("should stake [0, 1000, 9000, 0] USDC tokens to david validator (called by eve)", async function () {
      const amounts = [0, 1000 * 1e6, 9000 * 1e6, 0];
      for (const amount of amounts) {
        console.log(`Process amount ${amount}`);
        const collateralAddress = this.usdcToken.address;
        const collateralToken = this.usdcToken;
        const validatorAddress = david;
        const delegarorAddress = eve;
        const delegarorAccount = eveAccount;

        const prevDelegatorsInfo = await this.delegatedStaking.getDelegatorsInfo(validatorAddress, collateralAddress, delegarorAddress);
        const balanceBefore = toBN(await collateralToken.balanceOf(this.delegatedStaking.address));
        const totalUSDAmountBefore = await this.delegatedStaking.getTotalETHAmount(validatorAddress);
        const prevValidatorCollateral = await this.delegatedStaking.getValidatorCollateral(validatorAddress, collateralAddress);
        const prevCollateral = await this.delegatedStaking.collaterals(collateralAddress);
        await this.delegatedStaking.connect(delegarorAccount).stake(delegarorAccount.address, validatorAddress, collateralAddress, amount);
        const balanceAfter = toBN(await collateralToken.balanceOf(this.delegatedStaking.address));
        const totalUSDAmountAfter = await this.delegatedStaking.getTotalETHAmount(validatorAddress);
        const currentDelegatorsInfo = await this.delegatedStaking.getDelegatorsInfo(validatorAddress, collateralAddress, delegarorAddress);
        const currentValidatorCollateral = await this.delegatedStaking.getValidatorCollateral(validatorAddress, collateralAddress);
        const currentCollateral = await this.delegatedStaking.collaterals(collateralAddress);

        assert.equal(balanceBefore.add(amount).toString(), balanceAfter.toString());
        assert.equal(prevCollateral.totalLocked.add(amount).toString(), currentCollateral.totalLocked.toString());
        assert.equal(prevDelegatorsInfo.shares.add(amount).toString(), currentDelegatorsInfo.shares.toString());
        // total share locked by depositing to strategy
        assert.equal(prevDelegatorsInfo.locked.toString(), "0");
        assert.equal(prevDelegatorsInfo.locked.toString(), currentDelegatorsInfo.locked.toString());
        // how many reward tokens user will receive per one share
        assert.equal(prevDelegatorsInfo.accumulatedRewards.toString(), "0");
        assert.equal(prevDelegatorsInfo.accumulatedRewards.toString(), currentDelegatorsInfo.accumulatedRewards.toString());
        // total tokens staked by delegators
        assert.equal(prevValidatorCollateral.stakedAmount.add(amount).toString(), currentValidatorCollateral.stakedAmount.toString());
        // total share of collateral tokens
        assert.equal(prevValidatorCollateral.shares.add(amount).toString(), currentValidatorCollateral.shares.toString());
        // total share locked by depositing to strategy
        assert.equal(prevValidatorCollateral.locked.toString(), "0");
        assert.equal(prevValidatorCollateral.locked.toString(), currentValidatorCollateral.locked.toString());
        // info how many reward tokens  was earned
        assert.equal(prevValidatorCollateral.accumulatedRewards.toString(), "0");
        assert.equal(prevValidatorCollateral.accumulatedRewards.toString(), currentValidatorCollateral.accumulatedRewards.toString());
      }
    });

    it("should stake [0, 1000, 9000, 0] USDT tokens to sarah validator (called by sam)", async function () {
      const amounts = [0, 1000 * 1e6, 9000 * 1e6, 0];
      for (const amount of amounts) {
        console.log(`Process amount ${amount}`);
        const collateralAddress = this.usdtToken.address;
        const collateralToken = this.usdtToken;
        const validatorAddress = sarah;
        const delegarorAddress = sam;
        const delegarorAccount = samAccount;
        const prevDelegatorsInfo = await this.delegatedStaking.getDelegatorsInfo(validatorAddress, collateralAddress, delegarorAddress);

        const balanceBefore = toBN(await collateralToken.balanceOf(this.delegatedStaking.address));
        const totalUSDAmountBefore = await this.delegatedStaking.getTotalETHAmount(validatorAddress);
        const prevValidatorCollateral = await this.delegatedStaking.getValidatorCollateral(validatorAddress, collateralAddress);
        const prevCollateral = await this.delegatedStaking.collaterals(collateralAddress);
        await this.delegatedStaking.connect(delegarorAccount).stake(delegarorAccount.address, validatorAddress, collateralAddress, amount);
        const balanceAfter = toBN(await collateralToken.balanceOf(this.delegatedStaking.address));
        const totalUSDAmountAfter = await this.delegatedStaking.getTotalETHAmount(validatorAddress);
        const currentDelegatorsInfo = await this.delegatedStaking.getDelegatorsInfo(validatorAddress, collateralAddress, delegarorAddress);
        const currentValidatorCollateral = await this.delegatedStaking.getValidatorCollateral(validatorAddress, collateralAddress);
        const currentCollateral = await this.delegatedStaking.collaterals(collateralAddress);

        assert.equal(balanceBefore.add(amount).toString(), balanceAfter.toString());
        assert.equal(prevCollateral.totalLocked.add(amount).toString(), currentCollateral.totalLocked.toString());
        assert.equal(prevDelegatorsInfo.shares.add(amount).toString(), currentDelegatorsInfo.shares.toString());
        // total share locked by depositing to strategy
        assert.equal(prevDelegatorsInfo.locked.toString(), "0");
        assert.equal(prevDelegatorsInfo.locked.toString(), currentDelegatorsInfo.locked.toString());
        // how many reward tokens user will receive per one share
        assert.equal(prevDelegatorsInfo.accumulatedRewards.toString(), "0");
        assert.equal(prevDelegatorsInfo.accumulatedRewards.toString(), currentDelegatorsInfo.accumulatedRewards.toString());
        // total tokens staked by delegators
        assert.equal(prevValidatorCollateral.stakedAmount.add(amount).toString(), currentValidatorCollateral.stakedAmount.toString());
        // total share of collateral tokens
        assert.equal(prevValidatorCollateral.shares.add(amount).toString(), currentValidatorCollateral.shares.toString());
        // total share locked by depositing to strategy
        assert.equal(prevValidatorCollateral.locked.toString(), "0");
        assert.equal(prevValidatorCollateral.locked.toString(), currentValidatorCollateral.locked.toString());
        // info how many reward tokens  was earned
        assert.equal(prevValidatorCollateral.accumulatedRewards.toString(), "0");
        assert.equal(prevValidatorCollateral.accumulatedRewards.toString(), currentValidatorCollateral.accumulatedRewards.toString());
      }
    });
  });

  context("Stake for each validators pools", async () => {
    before(async function () {
      //We have
      // 1000 LINK in bob collateral
      // 10000 USDC in david collateral
      // 10000 USDT in sarah collateral
      const usdAmount = "10000000000"; //10k
      const linkAmount = toWei("1000"); //1k
      const allValidatorsAddresses = [bob, david, sarah];
      //Fill all collaterals
      // await this.delegatedStaking.connect(aliceAccount).stake(david, this.linkToken.address, linkAmount);
      // await this.delegatedStaking.connect(aliceAccount).stake(sarah, this.linkToken.address, linkAmount);
      for (const validator of allValidatorsAddresses) {
        await this.delegatedStaking.connect(aliceAccount).stake(alice, validator, this.linkToken.address, linkAmount);
      }
      for (const validator of allValidatorsAddresses) {
        await this.delegatedStaking.connect(aliceAccount).stake(alice, validator, this.usdcToken.address, usdAmount);
      }
      for (const validator of allValidatorsAddresses) {
        await this.delegatedStaking.connect(aliceAccount).stake(alice, validator, this.usdtToken.address, usdAmount);
      }
      // await this.delegatedStaking.connect(eveAccount).stake(bob, this.usdcToken.address, usdAmount);
      // await this.delegatedStaking.connect(eveAccount).stake(sarah, this.usdcToken.address, usdAmount);
      for (const validator of allValidatorsAddresses) {
        await this.delegatedStaking.connect(eveAccount).stake(eve, validator, this.linkToken.address, linkAmount);
      }
      for (const validator of allValidatorsAddresses) {
        await this.delegatedStaking.connect(eveAccount).stake(eve, validator, this.usdcToken.address, usdAmount);
      }
      for (const validator of allValidatorsAddresses) {
        await this.delegatedStaking.connect(eveAccount).stake(eve, validator, this.usdtToken.address, usdAmount);
      }
      // await this.delegatedStaking.connect(samAccount).stake(bob, this.usdtToken.address, usdAmount);
      // await this.delegatedStaking.connect(samAccount).stake(david, this.usdtToken.address, usdAmount);
      for (const validator of allValidatorsAddresses) {
        await this.delegatedStaking.connect(samAccount).stake(sam, validator, this.linkToken.address, linkAmount);
      }
      for (const validator of allValidatorsAddresses) {
        await this.delegatedStaking.connect(samAccount).stake(sam, validator, this.usdcToken.address, usdAmount);
      }
      for (const validator of allValidatorsAddresses) {
        await this.delegatedStaking.connect(samAccount).stake(sam, validator, this.usdtToken.address, usdAmount);
      }
    });
    it("Checks correct pools staked amount", async function () {
      const usdAmount = "10000000000"; //10k
      const linkAmount = toWei("1000"); //1k
      const allValidatorsAddresses = [bob, david, sarah];
      const allDelegatorsAddresses = [alice, eve, sam];
      const specialAmounts = [[toWei("2000"), usdAmount, usdAmount],
      [linkAmount, "20000000000", usdAmount],
      [linkAmount, usdAmount, "20000000000"]];
      //Check each validator's collateral
      //         bob			        david			        sarah
      //        LINK	USDC	USDT	LINK	USDC	USDT	LINK	USDC	USDT

      // ALICE	2000	10000	10000	1000	10000	10000	1000	10000	10000

      // EVE	  1000	10000	10000	1000	20000	10000	1000	10000	10000

      // SAM	  1000	10000	10000	1000	10000	10000	1000	10000	20000

      for (const validator of allValidatorsAddresses) {
        for (const delegator of allDelegatorsAddresses) {
          const indexValidator = allValidatorsAddresses.indexOf(validator);
          const indexDelegator = allDelegatorsAddresses.indexOf(delegator);
          const linkDelegatorIndo = await this.delegatedStaking.getDelegatorsInfo(validator, this.linkToken.address, delegator);
          const usdcDelegatorIndo = await this.delegatedStaking.getDelegatorsInfo(validator, this.usdcToken.address, delegator);
          const usdtDelegatorIndo = await this.delegatedStaking.getDelegatorsInfo(validator, this.usdtToken.address, delegator);
          if (indexValidator == indexDelegator) {
            assert.equal(linkDelegatorIndo.shares.toString(), specialAmounts[indexDelegator][0]);
            assert.equal(usdcDelegatorIndo.shares.toString(), specialAmounts[indexDelegator][1]);
            assert.equal(usdtDelegatorIndo.shares.toString(), specialAmounts[indexDelegator][2]);
          } else {
            assert.equal(linkDelegatorIndo.shares, linkAmount);
            assert.equal(usdcDelegatorIndo.shares, usdAmount);
            assert.equal(usdtDelegatorIndo.shares, usdAmount);
          }

          assert.equal(linkDelegatorIndo.accumulatedRewards, "0");
          assert.equal(usdcDelegatorIndo.accumulatedRewards, "0");
          assert.equal(usdtDelegatorIndo.accumulatedRewards, "0");
        }
      }
    });

    context("distribute rewards (1000 USDT)", async () => {
      before(async function () {

        console.log(`bob: ${bob}`);
        console.log(`david: ${david}`);
        console.log(`sarah: ${sarah}`);

        console.log(`link: ${this.linkToken.address}`);
        console.log(`usdt: ${this.usdtToken.address}`);
        console.log(`usdc: ${this.usdcToken.address}`);


        console.log(`Bob totalETHAmount: ${(await this.delegatedStaking.getTotalETHAmount(bob)).toString()}`);
        console.log(`Bob link pool in ETH: ${(await this.delegatedStaking.getPoolETHAmount(bob, this.linkToken.address)).toString()}`);
        console.log(`Bob usdt pool in ETH: ${(await this.delegatedStaking.getPoolETHAmount(bob, this.usdtToken.address)).toString()}`);
        console.log(`Bob usdc pool in ETH: ${(await this.delegatedStaking.getPoolETHAmount(bob, this.usdcToken.address)).toString()}`);

        this.rewardCollateralAmount = "1000000000"; //1000 USDT
        this.rewardCollateralAddress = this.usdtToken.address;
        this.prevCollateralInfo = await this.delegatedStaking.collaterals(this.rewardCollateralAddress);
        
        await this.delegatedStaking.sendRewards(this.rewardCollateralAddress, this.rewardCollateralAmount);
        await this.delegatedStaking.distributeValidatorRewards(this.rewardCollateralAddress);
      });
      it("Checks correct values", async function () {
        const collateralInfo = await this.delegatedStaking.collaterals(this.rewardCollateralAddress);
        console.log(this.prevCollateralInfo, 'prevCollateralInfo')
        console.log(collateralInfo, 'collateralInfo');
        //assert(this.prevCollateralInfo.totalLocked < collateralInfo.totalLocked, "total locked mismatch");
        //assert(this.prevCollateralInfo.rewards < collateralInfo.rewards, "rewards mismatch");
        // we heve next validators
        // await this.delegatedStaking.addValidator(bob, alice, 1, 2500);
        // await this.delegatedStaking.addValidator(david, alice, 1, 5000);
        // await this.delegatedStaking.addValidator(sarah, alice, 2, 10000);

        const bobValidatorCollateral = await this.delegatedStaking.getValidatorCollateral(bob, this.rewardCollateralAddress);
        const davidValidatorCollateral = await this.delegatedStaking.getValidatorCollateral(david, this.rewardCollateralAddress);
        const sarahValidatorCollateral = await this.delegatedStaking.getValidatorCollateral(sarah, this.rewardCollateralAddress);
        //TODO: check validatorCollateral.stakedAmount
        //how many reward tokens was earned
        assert.equal(bobValidatorCollateral.accumulatedRewards.toString(), "250000000"); //1000*1/4=250 USDT
        assert.equal(davidValidatorCollateral.accumulatedRewards.toString(), "250000000"); //1000*1/4=250 USDT
        assert.equal(sarahValidatorCollateral.accumulatedRewards.toString(), "500000000"); //1000*2/4=250 USDT
        //how many reward tokens validator can withdrawal
        assert.equal(bobValidatorCollateral.rewardsForWithdrawal.toString(), "187500000"); //250*75%=187,5 USDT
        assert.equal(davidValidatorCollateral.rewardsForWithdrawal.toString(), "125000000"); //250*50%=125 USDT
        assert.equal(sarahValidatorCollateral.rewardsForWithdrawal.toString(), "0"); //2*250*100%=500 USDT
        //TODO: check accTokensPerShare and dependency accTokensPerShare
        //how many reward tokens user will receive per one share
        //TOOD: check that other collaterals didn't change
      });

      it("Alice unstake all USDT shares from bob", async function () {
        console.log("Alice unstake all USDT shares from bob");
        const collateralAddress = this.usdtToken.address;
        const collateralToken = this.usdtToken;
        const validatorAddress = bob;
        const delegarorAddress = alice;
        const delegarorAccount = aliceAccount;

        const prevDelegatorsInfo = await this.delegatedStaking.getDelegatorsInfo(validatorAddress, collateralAddress, delegarorAddress);
        const balanceBefore = toBN(await collateralToken.balanceOf(delegarorAddress));
        //Unstake all link shares
        let unstakeTx = await this.delegatedStaking.connect(delegarorAccount).requestUnstake(bob, collateralAddress, alice, "7777777777777777777777");//prevDelegatorsInfo.shares.toString());
        const balanceAfter = toBN(await collateralToken.balanceOf(delegarorAddress));
        const currentDelegatorsInfo = await this.delegatedStaking.getDelegatorsInfo(validatorAddress, collateralAddress, delegarorAddress);
        let receipt = await unstakeTx.wait();
        //console.log(receipt);
        let unstakeRequestedEvent = receipt.events?.find((x) => { return x.event == "UnstakeRequested" });
        console.log("shares: " + unstakeRequestedEvent.args.shares.toString());
        console.log("tokenAmount: " + unstakeRequestedEvent.args.tokenAmount.toString());
        console.log("index: " + unstakeRequestedEvent.args.index.toString());

        // assert.equal(prevDelegatorsInfo.shares.toString(), toWei("2000"));
        // assert.equal(currentDelegatorsInfo.shares.toString(), toWei("0"));


        console.log("unstakeTxLINK: -------------------------------------------- ");
        let unstakeTxLINK = await this.delegatedStaking.connect(delegarorAccount).requestUnstake(bob, this.linkToken.address, alice, "7777777777777777777777");//prevDelegatorsInfo.shares.toString());
        receipt = await unstakeTxLINK.wait();
        //console.log(receipt);
        unstakeRequestedEvent = receipt.events?.find((x) => { return x.event == "UnstakeRequested" });
        console.log("shares: " + unstakeRequestedEvent.args.shares.toString());
        console.log("tokenAmount: " + unstakeRequestedEvent.args.tokenAmount.toString());
        console.log("index: " + unstakeRequestedEvent.args.index.toString());
        console.log("unstakeTxUSDC: -------------------------------------------- ");
        let unstakeTxUSDC = await this.delegatedStaking.connect(delegarorAccount).requestUnstake(bob, this.usdcToken.address, alice, "7777777777777777777777");//prevDelegatorsInfo.shares.toString());
        receipt = await unstakeTxUSDC.wait();
        //console.log(receipt);
        unstakeRequestedEvent = receipt.events?.find((x) => { return x.event == "UnstakeRequested" });
        console.log("shares: " + unstakeRequestedEvent.args.shares.toString());
        console.log("tokenAmount: " + unstakeRequestedEvent.args.tokenAmount.toString());
        console.log("index: " + unstakeRequestedEvent.args.index.toString());

        // assert.equal(balanceBefore.add(toWei("2000")).toString(), balanceAfter.toString());

        // const amount = toWei("5");
        // const collateral = this.linkToken.address;
        // const prevOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
        // const prevCollateral = await this.delegatedStaking.collaterals(collateral);
        // await this.delegatedStaking.requestUnstake(bob, collateral, alice, amount);
        // const currentOracleStaking = await this.delegatedStaking.getOracleStaking(bob, collateral);
        // const currentCollateral = await this.delegatedStaking.collaterals(collateral);
        // assert.equal(
        //   prevOracleStaking[0].sub(toBN(amount)).toString(),
        //   currentOracleStaking[0].toString()
        // );
        // assert.equal(
        //   prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        //   currentCollateral.totalLocked.toString()
        // );
      });
    });



    // it("does not credit rewards in case of delegator stake passed rewards", async function() {
    //   const amount = "100000000";
    //   const collateral = this.usdtToken.address;
    //   await this.usdtToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
    //   await this.usdtToken.approve(this.delegatedStaking.address, MaxUint256);
    //   const dependsCollateral = this.linkToken.address;
    //   const accTokensPerShare = await this.delegatedStaking.getTokensPerShare(sarah, collateral, dependsCollateral);
    //   const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(sarah, eve, collateral);
    //   await this.delegatedStaking.connect(eveAccount).stake(sarah, collateral, amount);
    //   const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(sarah, eve, collateral);
    //   assert.equal(accTokensPerShare[0].toString(), "100000000000000000");
    //   assert.equal(accTokensPerShare[1].toString(), "0");
    //   assert.equal(currentDelegatorStakes[1].toString(), "970000000");
    //   assert.equal(currentDelegatorStakes[2].toString(), "970000000");
    //   assert.equal(currentDelegatorStakes[4].toString(), "97000000");
    // });

    // it("pass in case of collateral staking not exceeded", async function() {
    //   const amount = toWei("10");
    //   const collateral = this.linkToken.address;
    //   await this.delegatedStaking.updateCollateral(collateral, toWei("1000"));
    //   const prevOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
    //   const prevDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
    //   const prevCollateral = await this.delegatedStaking.collaterals(collateral);
    //   await this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount);
    //   const currentOracleStaking = await this.delegatedStaking.getOracleStaking(david, collateral);
    //   const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
    //   const currentCollateral = await this.delegatedStaking.collaterals(collateral);
    //   assert.equal(
    //     prevOracleStaking[0].toString(),
    //     currentOracleStaking[0].toString()
    //   );
    //   assert.equal(
    //     prevDelegatorStakes[1].add(toBN(amount)).toString(),
    //     currentDelegatorStakes[1].toString()
    //   );
    //   assert.equal(
    //     prevCollateral.totalLocked.add(toBN(amount)).toString(),
    //     currentCollateral.totalLocked.toString()
    //   );
    //   await this.delegatedStaking.updateCollateral(this.linkToken.address, MaxUint256);
    // });

    // it("fail in case of collateral staking exceed", async function() {
    //   const amount = toWei("1000");
    //   const collateral = this.linkToken.address;
    //   await this.delegatedStaking.updateCollateral(collateral, toWei("1000"));
    //   await expectRevert(
    //     this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount),
    //     "CollateralLimited()"
    //   );
    //   await this.delegatedStaking.updateCollateral(this.linkToken.address, MaxUint256);
    // });

    // it("test delegator admin is set to sender if admin zero address", async function() {
    //   const amount = toWei("50");
    //   const prevCarol = await this.delegatedStaking.getDelegatorInfo(carol);
    //   assert.equal(
    //     prevCarol.admin.toString(),
    //     ZERO_ADDRESS
    //   );
    //   await this.delegatedStaking.connect(carolAccount).stake(david, this.linkToken.address, amount);
    //   const currentCarol = await this.delegatedStaking.getDelegatorInfo(carol);
    //   assert.equal(
    //     currentCarol.admin.toString(),
    //     carol
    //   );
    // });

    // it("should not increment oracle delegator count if already exists", async function() {
    //   const collateral = this.linkToken.address;
    //   const amount = toWei("10");
    //   await this.delegatedStaking.connect(eveAccount).stake(david, this.linkToken.address, amount);
    //   const previousDelegationInfo = await this.delegatedStaking.getDelegationInfo(david, collateral);
    //   const previousDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
    //   assert.equal(previousDelegatorStakes[0], true);
    //   await this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount);
    //   const currentDelegatorsInfo = await this.delegatedStaking.getDelegationInfo(david, collateral);
    //   assert.equal(
    //     previousDelegationInfo[2].toString(),
    //     currentDelegatorsInfo[2].toString()
    //   );
    // });

    // it("should give all shares to first depositor, equal to amount", async function() {
    //   const amount = toWei("50");
    //   const collateral = this.linkToken.address;
    //   const previousDelegation = await this.delegatedStaking.getDelegationInfo(bob, collateral);
    //   assert.equal(
    //     previousDelegation[1].toString(),
    //     "0"
    //   );
    //   await this.delegatedStaking.connect(eveAccount).stake(bob, collateral, amount);
    //   const currentDelegation = await this.delegatedStaking.getDelegationInfo(bob, collateral);
    //   assert.equal(
    //     previousDelegation[1].add(toBN(amount)).toString(),
    //     currentDelegation[1].toString()
    //   );
    //   const delegatorStakes = await this.delegatedStaking.getDelegatorStakes(bob, eve, collateral);
    //   assert.equal(
    //     delegatorStakes[2].toString(),
    //     amount.toString()
    //   );
    // });

    // it("should increment oracle delegator count if does not exist", async function() {
    //   const collateral = this.linkToken.address;
    //   const amount = toWei("50");
    //   const previousDelegation = await this.delegatedStaking.getDelegationInfo(bob, this.linkToken.address);
    //   const previousDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(bob, sam, collateral);
    //   assert.equal(previousDelegatorStakes[0], false);
    //   await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: sam });
    //   await this.delegatedStaking.connect(samAccount).stake(bob, this.linkToken.address, amount);
    //   const currentDelegation = await this.delegatedStaking.getDelegationInfo(bob, this.linkToken.address);
    //   const currentDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(bob, sam, collateral);
    //   assert.equal(currentDelegatorStakes[0], true);
    //   assert.equal(
    //     previousDelegation[2].add(toBN(1)).toString(),
    //     currentDelegation[2].toString()
    //   );
    // });

    // it("should correctly calculate shares for subsequent deposits", async function() {
    //   const amount = toWei("50");
    //   const collateral = this.linkToken.address;
    //   await this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount);
    //   const previousDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
    //   await this.delegatedStaking.connect(carolAccount).stake(david, collateral, amount);
    //   const currentDelegation = await this.delegatedStaking.getDelegationInfo(david, collateral);
    //   assert(currentDelegation[1].toString() > previousDelegation[1].toString(), "shares increase with deposits");
    //   const firstDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, eve, collateral);
    //   const secondDelegatorStakes = await this.delegatedStaking.getDelegatorStakes(david, carol, collateral);
    //   assert(secondDelegatorStakes[2].toString() <= firstDelegatorStakes[2].toString(),
    //     "subsequent delegators receive equal or fewer shares per amount");
    // });
  });

  // context("Test realistic scenarios", async function() {
  //   it("several hundred delegators to 6 validators", async function() {
  //     random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  //     this.signers = await ethers.getSigners();
  //     const amount = toWei("200");
  //     this.timeout(0);
  //     for(i=0; i<200; i++) {
  //       delegatorAccount = this.signers[i+13];
  //       validatorAccount = this.signers[random(1, 6) + 7];
  //       validator = validatorAccount.address;
  //       delegator = delegatorAccount.address
  //       await this.linkToken.mint(delegator, toWei("3200000"));
  //       await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: delegator });
  //       await this.delegatedStaking.connect(delegatorAccount).stake(validator, this.linkToken.address, amount);
  //     }
  //     this.timeout(20000);
  //     await this.delegatedStaking.distributeRewards(this.signers[random(1, 6) + 7].address, this.linkToken.address, toWei("2000"));
  //     delegatorAccount = this.signers[14];
  //     validatorAccount = this.signers[8];
  //     await this.delegatedStaking.connect(delegatorAccount).stake(validatorAccount.address, this.linkToken.address, amount);
  //   });
  // });

  context("Test request unstaking of different amounts by oracle", async () => {
    it("should unstake 0 tokens", async function () {
      const amount = 0;
      const collateral = this.linkToken.address;
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.requestUnstake(bob, collateral, alice, amount);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(prevCollateral.totalLocked.toString(), currentCollateral.totalLocked.toString());
    });

    before(async function () {
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(alice, bob, this.linkToken.address, toWei("5"));
    })
    it("should unstake 5 tokens", async function () {
      const amount = toWei("5");
      const collateral = this.linkToken.address;
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.requestUnstake(bob, collateral, alice, amount);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
    });

    it("unstaking all balance in case of unstaking greater than balance", async function () {
      const amount = toWei("3200000");
      const collateral = this.linkToken.address;
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevStakerBalance = await prevCollateral.delegators;
      console.log(prevStakerBalance, 'stakerBalance')
      await this.delegatedStaking.requestUnstake(bob, collateral, bob, amount);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentStakerBalance = await currentCollateral.delegators;
      console.log(currentStakerBalance, 'currentStakerBalance')
    });

  });

  context("Test request unstaking of different amounts by delegator", async () => {
    before(async function () {
      const amount = toWei("100");
      const collateral = this.linkToken.address;
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: david });
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(eveAccount.address, david, collateral, amount);
      await this.delegatedStaking.connect(eveAccount).stake(eveAccount.address, david, collateral, amount);
    });

    it("should unstake 0 tokens", async function () {
      const amount = 0;
      const collateral = this.linkToken.address;
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevDelegation = await this.delegatedStaking.getDelegatorsInfo(david, collateral, eve);
      await this.delegatedStaking.connect(eveAccount).requestUnstake(david, collateral, alice, amount);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentDelegation = await this.delegatedStaking.getDelegatorsInfo(david, collateral, eve);
      assert.equal(prevCollateral.totalLocked.toString(), currentCollateral.totalLocked.toString());
      assert.equal(prevDelegation.shares.toString(), currentDelegation.shares.toString());
    });

    it("should unstake 5 shares", async function () {
      const amount = toWei("5");
      const collateral = this.linkToken.address;
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevDelegation = await this.delegatedStaking.getDelegatorsInfo(david, collateral, eve);
      await this.delegatedStaking.connect(eveAccount).requestUnstake(david, collateral, eve, amount);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentDelegation = await this.delegatedStaking.getDelegatorsInfo(david, collateral, eve);
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
      assert.equal(
        prevDelegation.shares.sub(toBN(amount)).toString(),
        currentDelegation.shares.toString(),
        "number of shares decrease"
      );
    });

  });

  context("Test request unstaking permissions", async () => {
    before(async function () {
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(alice, bob, this.linkToken.address, toWei("10"));
    })
    it("should unstake by admin", async function () {
      const amount = toWei("1");
      const collateral = this.linkToken.address;
      const prevDelegation = await this.delegatedStaking.getDelegatorsInfo(bob, collateral, alice);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const sharePrice = await this.delegatedStaking.getPricePerFullValidatorShare(bob, collateral);
      console.log(sharePrice, 'sharePrice')
      await this.delegatedStaking.requestUnstake(bob, collateral, alice, amount);
      const currentDelegation = await this.delegatedStaking.getDelegatorsInfo(bob, collateral, alice);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const amountUnlocked = amount * sharePrice
      console.log(amountUnlocked, 'amountUnlocked')
      assert.equal(
        prevDelegation.shares.sub(currentDelegation.shares).toString(),
        amount.toString(),
        'shares amount mismatch'
      );
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amountUnlocked)).toString(),
        currentCollateral.totalLocked.toString(),
        "total locked amount mismatch"
      );
    });
  });

  context("Test execute unstaking of different amounts", async () => {
    before(async function () {
      const amount = toWei("100");
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(alice, sarah, this.linkToken.address, amount);
      await this.delegatedStaking.requestUnstake(sarah, this.linkToken.address, alice, toWei("10"));
    })

    it("fail in case of execute unstaking before timelock", async function () {
      await this.delegatedStaking.requestUnstake(sarah, this.linkToken.address, alice, toWei("10"));
      await expectRevert(
        this.delegatedStaking.executeUnstake(sarah, [1]),
        "Timelock()"
      );
    });

    it("fail in case of execute unstaking from future", async function () {
      await expectRevert(
        this.delegatedStaking.executeUnstake(sarah, [10]),
        "WrongRequest(10)"
      );
    });

    it("should execute unstake", async function () {
      await sleep(2000);
      const withdrawalId = 0;
      const prevWithdrawalInfo = await this.delegatedStaking.getWithdrawalRequest(sarah, withdrawalId)
      const collateral = prevWithdrawalInfo.collateral;
      const prevValidatorCollateral = await this.delegatedStaking.getValidatorCollateral(sarah, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.executeUnstake(sarah, [withdrawalId]);
      const currentValidatorCollateral = await this.delegatedStaking.getValidatorCollateral(sarah, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentWithdrawalInfo = await this.delegatedStaking.getWithdrawalRequest(sarah, withdrawalId);

      assert.equal(prevWithdrawalInfo.executed, false, 'prevWithdrawal is executed');
      assert.equal(currentWithdrawalInfo.executed, true, 'currentWithdrawal is not executed');
      assert.equal(
        prevValidatorCollateral[0].toString(),
        currentValidatorCollateral[0].toString()
      );
      assert.equal(prevCollateral.totalLocked.toString(), currentCollateral.totalLocked.toString());
    });

    it("fail in case of execute unstaking twice", async function () {
      await expectRevert(
        this.delegatedStaking.executeUnstake(sarah, [0]),
        "AlreadyExecuted(0)"
      );
    });
  });

  context("Test cancel unstake", async () => {
    before(async function () {
      const amount = toWei("100");
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(alice, sarah, this.linkToken.address, amount);
      //await this.delegatedStaking.requestUnstake(sarah, this.linkToken.address, alice, amount);
    });

    it("should cancel unstake 10 shares", async function () {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.delegatedStaking.requestUnstake(sarah, collateral, alice, amount);
      const prevValidatorCollateral = await this.delegatedStaking.getValidatorCollateral(sarah, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const lastWithdrawalId = await this.delegatedStaking.getWithdrawalRequests(sarah);
      await this.delegatedStaking.cancelUnstake(sarah, [lastWithdrawalId - 1]);
      const currentValidatorCollateral = await this.delegatedStaking.getValidatorCollateral(sarah, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevValidatorCollateral[1].add(toBN(amount)).toString(),
        currentValidatorCollateral[1].toString()
      );
      assert.equal(
        prevCollateral.totalLocked.add(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
    });
    it("should fail cancel unstake if already executed", async function () {
      await expectRevert(
        this.delegatedStaking.cancelUnstake(sarah, [0]),
        "AlreadyExecuted(0)");
    });
  });

  context.skip("Test liquidate different amounts", async () => {
    before(async function () {
      const amount = toWei("10");
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(alice, bob, this.linkToken.address, amount);
    })

    it("should execute liquidate 0 tokens", async function () {
      const amount = toWei("0");
      const collateral = this.linkToken.address;
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking['liquidate(address,address,uint256)'](bob, collateral, amount);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
      assert.equal(
        prevCollateral.confiscatedFunds.add(toBN(amount)).toString(),
        currentCollateral.confiscatedFunds.toString()
      );
    });

    it("should execute liquidate of normal amount of tokens", async function () {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking['liquidate(address,address,uint256)'](bob, collateral, amount);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
      assert.equal(
        prevCollateral.confiscatedFunds.add(toBN(amount)).toString(),
        currentCollateral.confiscatedFunds.toString()
      );
    });

    it("fail in case of liquidate of too many tokens", async function () {
      const amount = toWei("1000");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.delegatedStaking['liquidate(address,address,uint256)'](bob, collateral, amount),
        "bad amount"
      );
    });
  });

  context.skip("Test liquidate by different users", async () => {
    before(async function () {
      const amount = toWei("10");
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(alice, bob, this.linkToken.address, amount);
    })
    it("should execute liquidate by admin", async function () {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking['liquidate(address,address,uint256)'](bob, collateral, amount);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      assert.equal(
        prevCollateral.totalLocked.sub(toBN(amount)).toString(),
        currentCollateral.totalLocked.toString()
      );
      assert.equal(
        prevCollateral.confiscatedFunds.add(toBN(amount)).toString(),
        currentCollateral.confiscatedFunds.toString()
      );
    });

    it("fail in case of liquidate by non-admin", async function () {
      const amount = toWei("1");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.delegatedStaking.connect(carolAccount)['liquidate(address,address,uint256)'](bob, collateral, amount),
        "onlyAdmin"
      );
    });
  });

  context.skip("Test withdraw different liquidated amounts", async () => {
    before(async function () {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(alice, bob, collateral, amount);
      await this.delegatedStaking['liquidate(address,address,uint256)'](bob, collateral, amount);
    })
    it("should execute withdrawal of 0 liquidated tokens", async function () {
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

    it("should execute liquidate of normal amount of tokens", async function () {
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

    it("fail in case of withdrawal of too many tokens", async function () {
      const amount = toWei("1000");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.delegatedStaking.withdrawFunds(alice, collateral, amount),
        "bad amount"
      );
    });
  });

  context.skip("Test withdraw liquidated funds by different users", async () => {
    before(async function () {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(alice, bob, collateral, amount);
      await this.delegatedStaking['liquidate(address,address,uint256)'](bob, collateral, amount);
    })
    it("should execute withdrawal by the admin", async function () {
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

    it("fail in case of withdrawal by non-admin", async function () {
      const amount = toWei("1");
      const collateral = this.linkToken.address;
      await expectRevert(
        this.delegatedStaking.connect(bobAccount).withdrawFunds(alice, collateral, amount),
        "onlyAdmin"
      );
    });
  });

  context("Test rewards distribution", async () => {
    before(async function () {
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.delegatedStaking.connect(eveAccount).stake(eveAccount.address, bob, this.linkToken.address, toWei("200"));
    });
    it("should pay for oracle who set profit sharing as zero", async function () {
      const collateral = this.linkToken.address;
      const amount = toWei("100");
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.sendRewards(collateral, amount);
      await this.delegatedStaking.distributeValidatorRewards(collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);

      assert.equal(prevCollateral.totalLocked.add(toBN(amount)).toString(), currentCollateral.totalLocked.toString());
    });
    it("should pay for oracle who shares profit with delegators", async function () {
      const collateral = this.linkToken.address;
      const dependsCollateral = this.usdcToken.address;
      const amount = toWei("100"), amountForDelegator = toWei("25");
      await this.usdcToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.delegatedStaking.connect(eveAccount).stake(eveAccount.address, david, this.usdcToken.address, "200000000");
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevDelegation = await this.delegatedStaking.getDelegatorsInfo(david, collateral, eveAccount.address);

      const prevSharePrice = await this.delegatedStaking.getPricePerFullValidatorShare(david, collateral);
      await this.delegatedStaking.sendRewards(collateral, amount);
      await this.delegatedStaking.distributeValidatorRewards(collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentDelegation = await this.delegatedStaking.getDelegatorsInfo(david, collateral, eveAccount.address);
      const currentSharePrice = await this.delegatedStaking.getPricePerFullValidatorShare(david, collateral);

      assert.equal(prevCollateral.totalLocked.add(toBN(amount)).toString(), currentCollateral.totalLocked.toString());

      assert.equal(
        prevDelegation.shares.toString(),
        currentDelegation.shares.toString()
      );
      assert(prevSharePrice.toString() <= currentSharePrice.toString(), "tokenPrice does not increase");
    });
    it("fail in case of reward collateral not enabled", async function () {
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      await this.delegatedStaking.updateCollateralEnabled(collateral, false);
      await expectRevert(
        this.delegatedStaking.distributeValidatorRewards(collateral),
        "CollateralDisabled()"
      );
      await this.delegatedStaking.updateCollateralEnabled(collateral, true);
    });
  });

  context.skip("Test deposit to strategy", async () => {
    it("should fail if strategy not enabled", async function () {
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
    it("should fail if delegator !exist", async function () {
      const amount = toWei("10");
      const strategy = this.mockAaveController.address;
      await expectRevert(
        this.delegatedStaking.connect(bobAccount).depositToStrategy(eve, amount, strategy, this.linkToken.address),
        "delegator !exist"
      );
    });
    it("should update balances after deposit to aave", async function () {
      const stakeAmount = toWei("100");
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const strategy = this.mockAaveController.address;
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(alice, bob, collateral, stakeAmount);
      const prevStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      const prevDepositInfo = await this.delegatedStaking['getStrategyDepositInfo(address,address,address)'](bob, strategy, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.depositToStrategy(bob, amount, strategy, collateral);
      const currentStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      const currentDepositInfo = await this.delegatedStaking['getStrategyDepositInfo(address,address,address)'](bob, strategy, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);

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
    it("should update balances after deposit to compound", async function () {
      const stakeAmount = toWei("100");
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const strategy = this.mockCompoundController.address;
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(alice, bob, collateral, stakeAmount);
      const prevStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      const prevDepositInfo = await this.delegatedStaking['getStrategyDepositInfo(address,address,address)'](bob, strategy, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.depositToStrategy(bob, amount, strategy, collateral);
      const currentStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      const currentDepositInfo = await this.delegatedStaking['getStrategyDepositInfo(address,address,address)'](bob, strategy, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);

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
    it("should update balances after deposit to yearn", async function () {
      const stakeAmount = toWei("100");
      const amount = toWei("10");
      const collateral = this.linkToken.address;
      const strategy = this.mockYearnController.address;
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.delegatedStaking.stake(alice, bob, collateral, stakeAmount);
      const prevStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      const prevDepositInfo = await this.delegatedStaking['getStrategyDepositInfo(address,address,address)'](bob, strategy, collateral);
      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      await this.delegatedStaking.depositToStrategy(bob, amount, strategy, collateral);
      const currentStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      const currentDepositInfo = await this.delegatedStaking['getStrategyDepositInfo(address,address,address)'](bob, strategy, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);

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
    it("should fail when deposit insufficient fund", async function () {
      const amount = toWei("320000");
      const strategy = this.mockAaveController.address;
      await expectRevert(this.delegatedStaking.depositToStrategy(bob, amount, strategy, this.linkToken.address), "bad amount");
    });
  });

  context.skip("Test withdraw from strategy", async () => {
    before(async function () {
      const collateral = this.linkToken.address;
      const amount = toWei("200");
      const strategy = this.mockAaveController.address;
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.delegatedStaking.stake(alice, david, collateral, amount);
      await this.delegatedStaking.stake(alice, bob, collateral, toWei("100"));
      await this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount);
      await this.delegatedStaking.connect(eveAccount).stake(bob, collateral, amount);
      await this.delegatedStaking.depositToStrategy(david, toWei("10"), strategy, collateral);
      await this.delegatedStaking.depositToStrategy(bob, toWei("10"), strategy, collateral);
      await this.delegatedStaking.connect(eveAccount).depositToStrategy(david, toWei("10"), strategy, collateral);
      await this.lendingPool.increaseCurrentTime(60 * 24 * 60 * 60);
    });
    it("should fail if strategy not enabled", async function () {
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
    it("should fail if delegator !exist", async function () {
      const amount = toWei("10");
      const strategy = this.mockAaveController.address;
      await expectRevert(
        this.delegatedStaking.withdrawFromStrategy(eve, amount, strategy, this.linkToken.address),
        "delegator !exist"
      );
    });
    it("should fail when withdraw insufficient share", async function () {
      const amount = toWei("320000");
      const strategy = this.mockAaveController.address;
      await expectRevert(this.delegatedStaking.withdrawFromStrategy(bob, amount, strategy, this.linkToken.address), "bad amount");
    });
    it("should decrement strategy and deposit info after withdraw from aave", async function () {
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
    it("should increase staking after oracle withdraw from aave", async function () {
      const collateral = this.linkToken.address;
      const strategy = this.mockAaveController.address;

      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevRewards = await this.delegatedStaking.getRewards(david, collateral);
      await this.delegatedStaking.withdrawFromStrategy(david, toWei("2"), strategy, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentRewards = await this.delegatedStaking.getRewards(david, collateral);

      assert(
        prevRewards[0].toString() <
        currentRewards[0].toString()
      );
      assert(
        prevCollateral.totalLocked.toString() <
        currentCollateral.totalLocked.toString()
      );

    });
    it("should increase stakes after delegator withdraw from aave", async function () {
      const collateral = this.linkToken.address;
      const strategy = this.mockAaveController.address;
      const prevDelegation = await this.delegatedStaking.getDelegatorsInfo(david, collateral, eve);
      await this.delegatedStaking.connect(eveAccount).withdrawFromStrategy(david, toWei("2"), strategy, collateral);
      const currentDelegation = await this.delegatedStaking.getDelegatorsInfo(david, collateral, eve);

      assert(prevDelegation.locked.toString() > currentDelegation.locked.toString());
    });
    it("should decrement strategy and deposit info after withdraw from compound", async function () {
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
    it("should increase staking after oracle withdraw from compound", async function () {
      const collateral = this.linkToken.address;
      const strategy = this.mockCompoundController.address;

      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevRewards = await this.delegatedStaking.getRewards(david, collateral);
      await this.delegatedStaking.withdrawFromStrategy(david, toWei("2"), strategy, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentRewards = await this.delegatedStaking.getRewards(david, collateral);

      assert(
        prevRewards[0].toString() <
        currentRewards[0].toString()
      );
      assert(
        prevCollateral.totalLocked.toString() <
        currentCollateral.totalLocked.toString()
      );

    });
    it("should increase stakes after delegator withdraw from compound", async function () {
      const collateral = this.linkToken.address;
      const strategy = this.mockCompoundController.address;
      const prevDelegation = await this.delegatedStaking.getDelegatorsInfo(david, collateral, eve);
      await this.delegatedStaking.connect(eveAccount).withdrawFromStrategy(david, toWei("2"), strategy, collateral);
      const currentDelegation = await this.delegatedStaking.getDelegatorsInfo(david, collateral, eve);

      assert(prevDelegation.locked.toString() > currentDelegation.locked.toString());
    });
    it("should decrement strategy and deposit info after withdraw from yearn", async function () {
      const collateral = this.linkToken.address;
      const amount = toWei("100");
      const strategy = this.mockCompoundController.address;
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
    it("should increase staking after oracle withdraw from yearn", async function () {
      const collateral = this.linkToken.address;
      const strategy = this.mockYearnController.address;

      const prevCollateral = await this.delegatedStaking.collaterals(collateral);
      const prevRewards = await this.delegatedStaking.getRewards(david, collateral);
      await this.delegatedStaking.withdrawFromStrategy(david, toWei("2"), strategy, collateral);
      const currentCollateral = await this.delegatedStaking.collaterals(collateral);
      const currentRewards = await this.delegatedStaking.getRewards(david, collateral);

      assert(
        prevRewards[0].toString() <
        currentRewards[0].toString()
      );
      assert(
        prevCollateral.totalLocked.toString() <
        currentCollateral.totalLocked.toString()
      );

    });
    it("should increase stakes after delegator withdraw from yearn", async function () {
      const collateral = this.linkToken.address;
      const strategy = this.mockYearnController.address;
      const prevDelegation = await this.delegatedStaking.getDelegatorsInfo(david, collateral, eve);
      await this.delegatedStaking.connect(eveAccount).withdrawFromStrategy(david, toWei("2"), strategy, collateral);
      const currentDelegation = await this.delegatedStaking.getDelegatorsInfo(david, collateral, eve);

      assert(prevDelegation.locked.toString() > currentDelegation.locked.toString());
    });
    it("should increment reward balances", async function () {
      const collateral = this.linkToken.address;
      const strategy = this.mockYearnController.address;
      const prevRewards = await this.delegatedStaking.getRewards(bob, collateral);
      const prevStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      await this.delegatedStaking.withdrawFromStrategy(bob, toWei("2"), strategy, collateral);
      const currentRewards = await this.delegatedStaking.getRewards(bob, collateral);
      const currentStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);

      assert(prevRewards[0].toString() < currentRewards[0].toString());
      assert(prevRewards[1].toString() < currentRewards[1].toString());
      assert(prevStrategyStakes[1].toString() > currentStrategyStakes[1].toString());
    });
  });

  context.skip("Test emergency withdraw from strategy", async function () {
    beforeEach(async function () {
      const collateral = this.linkToken.address;
      const amount = toWei("200");
      const strategy = this.mockAaveController.address;
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.delegatedStaking.stake(alice, david, collateral, amount);
      await this.delegatedStaking.stake(alice, bob, collateral, toWei("100"));
      await this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount);
      await this.delegatedStaking.connect(eveAccount).stake(bob, collateral, amount);
      await this.delegatedStaking.depositToStrategy(david, toWei("100"), strategy, collateral);
      await this.delegatedStaking.depositToStrategy(bob, toWei("100"), strategy, collateral);
      await this.delegatedStaking.connect(eveAccount).depositToStrategy(david, toWei("100"), strategy, collateral);
      await this.lendingPool.increaseCurrentTime(60 * 24 * 60 * 60);
    });
    it("should fail if not called by contract admin", async function () {
      const strategy = this.mockAaveController.address;
      await expectRevert(
        this.delegatedStaking.connect(bobAccount).emergencyWithdrawFromStrategy(strategy, this.linkToken.address),
        "onlyAdmin"
      );
    });
    it("should fail if strategy not enabled", async function () {
      const strategy = this.mockAaveController.address;
      const collateral = this.linkToken.address;
      await this.delegatedStaking.updateStrategy(strategy, collateral, false);
      await expectRevert(
        this.delegatedStaking.emergencyWithdrawFromStrategy(strategy, collateral),
        "strategy disabled"
      );
      await this.delegatedStaking.updateStrategy(strategy, collateral, true);
    });
    it("should disable aave strategy and set recoverable", async function () {
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
    it("should disable compound strategy and set recoverable", async function () {
      const strategy = this.mockCompoundController.address;
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
    it("should disable yearn strategy and set recoverable", async function () {
      const strategy = this.mockYearnController.address;
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

  context.skip("Test recover from emergency", async () => {
    beforeEach(async function () {
      const collateral = this.linkToken.address;
      const amount = toWei("200");
      const strategy = this.mockAaveController.address;
      await this.delegatedStaking.updateStrategy(strategy, collateral, false);
      await this.delegatedStaking.updateStrategyRecoverable(strategy, collateral, true);
      await this.delegatedStaking.resetStrategy(strategy, collateral);
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.delegatedStaking.stake(alice, david, collateral, amount);
      await this.delegatedStaking.stake(alice, bob, collateral, toWei("100"));
      await this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount);
      await this.delegatedStaking.connect(eveAccount).stake(bob, collateral, amount);
      await this.delegatedStaking.depositToStrategy(david, toWei("100"), strategy, collateral);
      await this.delegatedStaking.depositToStrategy(bob, toWei("100"), strategy, collateral);
      await this.delegatedStaking.connect(eveAccount).depositToStrategy(david, toWei("100"), strategy, collateral);
      await this.lendingPool.increaseCurrentTime(60 * 24 * 60 * 60);
      await this.delegatedStaking.emergencyWithdrawFromStrategy(strategy, collateral);
    });
    it("should fail if strategy enabled", async function () {
      const strategy = this.mockAaveController.address;
      const collateral = this.linkToken.address;
      await this.delegatedStaking.updateStrategy(strategy, collateral, true);
      await expectRevert(
        this.delegatedStaking.recoverFromEmergency(strategy, collateral, [david, bob]),
        "strategy enabled"
      );
    });
    it("should fail if funds not recoverable", async function () {
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
    it("should succeed if called by non contract admin", async function () {
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
    it("should decrease strategy shares and reserves", async function () {
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
    it("should reset oracle locked", async function () {
      const strategy = this.mockAaveController.address;
      const collateral = this.linkToken.address;
      await this.delegatedStaking.recoverFromEmergency(strategy, collateral, [david, bob]);
      await this.delegatedStaking.resetStrategy(strategy, collateral);
    });
    it("should reset delegator locked", async function () {
      const strategy = this.mockAaveController.address;
      const collateral = this.linkToken.address;
      await this.delegatedStaking.recoverFromEmergency(strategy, collateral, [david, bob]);
      await this.delegatedStaking.resetStrategy(strategy, collateral);
    });
  });
  context.skip("Test simulate hack", async function () {
    beforeEach(async function () {
      const collateral = this.linkToken.address;
      const amount = toWei("200");
      const strategy = this.mockAaveController.address;
      await this.delegatedStaking.updateStrategy(strategy, collateral, false);
      await this.delegatedStaking.updateStrategyRecoverable(strategy, collateral, true);
      await this.delegatedStaking.resetStrategy(strategy, collateral);
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256);
      await this.linkToken.approve(this.delegatedStaking.address, MaxUint256, { from: eve });
      await this.delegatedStaking.stake(alice, david, collateral, amount);
      await this.delegatedStaking.stake(alice, bob, collateral, toWei("100"));
      await this.delegatedStaking.connect(eveAccount).stake(david, collateral, amount);
      await this.delegatedStaking.connect(eveAccount).stake(bob, collateral, amount);
      await this.delegatedStaking.depositToStrategy(david, toWei("100"), strategy, collateral);
      await this.delegatedStaking.depositToStrategy(bob, toWei("100"), strategy, collateral);
      await this.delegatedStaking.connect(eveAccount).depositToStrategy(david, toWei("100"), strategy, collateral);
      await this.lendingPool.increaseCurrentTime(60 * 24 * 60 * 60);
      await this.aLinkToken.hack([bob, david, eve]);
      await this.delegatedStaking.emergencyWithdrawFromStrategy(strategy, collateral);
    });
    it("should decrease stakes if funds are lost from hack", async function () {
      const collateral = this.linkToken.address;
      const strategy = this.mockAaveController.address;
      const prevStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      const prevDepositInfo = await this.delegatedStaking['getStrategyDepositInfo(address,address,address)'](bob, strategy, collateral);
      await this.delegatedStaking.recoverFromEmergency(strategy, collateral, [david, bob]);
      const currentStrategyStakes = await this.delegatedStaking.getStrategyStakes(strategy, collateral);
      const currentDepositInfo = await this.delegatedStaking['getStrategyDepositInfo(address,address,address)'](bob, strategy, collateral);
      assert.equal(
        toBN(prevStrategyStakes[0]).div(2).toString(),
        currentStrategyStakes[0].toString()
      );
      assert(
        prevStrategyStakes[1].toString() >
        currentStrategyStakes[1].toString(),
        "shares decrease"
      );
      assert.equal(
        toBN(prevDepositInfo[0]).div(2).toString(),
        currentDepositInfo[0].toString()
      );
      assert(
        prevDepositInfo[1].toString() >
        currentDepositInfo[1].toString(),
        "shares decrease"
      );
      await this.delegatedStaking.resetStrategy(strategy, collateral);
    });
  });

  context.skip('Test upgrades', function () {
    it('should succeed upgrading to v2', async function () {
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
