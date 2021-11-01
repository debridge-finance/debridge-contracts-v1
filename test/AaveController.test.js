const { expect } = require("chai");
const { ethers } = require("hardhat");

const ZERO_ADDRESS = ethers.constants.AddressZero;

contract("AaveController (AaveInteractor)", function () {
  before(async function () {
    this.signers = await ethers.getSigners();
    this.alice = this.signers[0];
    this.bob = this.signers[1];
    this.carol = this.signers[2];

    this.TokenFactory = await ethers.getContractFactory("MockToken");
    this.TokenAFactory = await ethers.getContractFactory("MockAToken");

    this.AaveProtocolDataProviderFactory = await ethers.getContractFactory(
      "AaveProtocolDataProvider"
    );
    this.LendingPoolFactory = await ethers.getContractFactory("LendingPool");
    this.AddressesProviderFactory = await ethers.getContractFactory("LendingPoolAddressesProvider");

    this.AaveControllerFactory = await ethers.getContractFactory("AaveController");
    this.IncentivesControllerFactory = await ethers.getContractFactory("IncentivesController");
  });

  beforeEach(async function () {
    this.addressProvider = await this.AddressesProviderFactory.deploy();
    await this.addressProvider.deployed();

    this.dataProvider = await this.AaveProtocolDataProviderFactory.deploy(
      this.addressProvider.address
    );
    await this.dataProvider.deployed();

    this.lendingPool = await this.LendingPoolFactory.deploy();
    await this.lendingPool.deployed();
    await this.lendingPool.initialize(this.addressProvider.address);

    this.stkAAVEToken = await this.TokenFactory.deploy("Staked AAVE Token", "stkAAVE", 18);
    this.incentivesController = await this.IncentivesControllerFactory.deploy(this.stkAAVEToken.address);

    this.uToken = await this.TokenFactory.deploy("uToken", "uTKN", 18);

    this.aToken = await this.TokenAFactory.deploy(
      this.lendingPool.address,
      this.incentivesController.address,
      "aToken",
      "aTKN",
      18,
      this.uToken.address
    );

    await this.addressProvider.setLendingPool(this.lendingPool.address);
    await this.lendingPool.addReserveAsset(this.uToken.address, this.aToken.address);

    this.aaveController = await this.AaveControllerFactory.deploy(
      this.addressProvider.address,
      this.dataProvider.address
    );
    await this.aaveController.deployed();
  });

  describe("Check initial states", function () {
    it("has proper lendingPool address ", async function () {
      expect(await this.aaveController.lendingPool()).to.equal(this.lendingPool.address);
    });
    it("has atoken", async function () {
      expect(await this.aaveController.strategyToken(this.uToken.address)).to.equal(this.aToken.address);
    });
    it("asset configured", async function () {
      expect((await this.lendingPool.getReserveData(this.uToken.address)).aTokenAddress).to.equal(
        this.aToken.address
      );
    });
  });

  describe("tokens deposited to Aave through controller", function () {
    beforeEach(async function () {
      this.depositAmount = 200;
      await this.uToken.mint(this.alice.address, this.depositAmount);
      await this.uToken.approve(this.aaveController.address, this.depositAmount);
      this.depositTx = await this.aaveController.deposit(this.uToken.address, this.depositAmount);
    });

    it("Deposit event emitted", async function () {
      await expect(this.depositTx)
        .to.emit(this.lendingPool, "Deposit")
        .withArgs(
          this.uToken.address,
          this.alice.address,
          this.alice.address,
          this.depositAmount,
          0
        );
    });

    it("Mint event emitted", async function () {
      await expect(this.depositTx)
        .to.emit(this.aToken, "Transfer")
        .withArgs(ZERO_ADDRESS, this.alice.address, this.depositAmount);

      const reserve = await this.lendingPool.getReserveData(this.uToken.address);
      await expect(this.depositTx)
        .to.emit(this.aToken, "Mint")
        .withArgs(this.alice.address, this.depositAmount, reserve.liquidityIndex);
    });

    it("uToken transferred and aToken paid back", async function () {
      expect(await this.uToken.balanceOf(this.alice.address)).to.equal(0);
      expect(await this.uToken.balanceOf(this.aToken.address)).to.equal(this.depositAmount);

      expect(await this.aToken.balanceOf(this.alice.address)).to.equal(this.depositAmount);
    });

    it("has updated reserves", async function () {
      expect(
        await this.aaveController.updateReserves(this.alice.address, this.aToken.address)
      ).to.equal(this.depositAmount);
    });

    describe("after 25% of tokens withdrawn back", function () {
      beforeEach(async function () {
        this.withdrawAmount = 50;
        this.withdrawTx = await this.aaveController.withdraw(
          this.uToken.address,
          this.withdrawAmount
        );
      });

      it("Withdraw and Transfer and Burn events emitted", async function () {
        await expect(this.withdrawTx)
          .to.emit(this.lendingPool, "Withdraw")
          .withArgs(
            this.uToken.address,
            this.aaveController.address,
            this.alice.address,
            this.withdrawAmount
          );

        await expect(this.withdrawTx)
          .to.emit(this.aToken, "Transfer")
          .withArgs(this.aaveController.address, ZERO_ADDRESS, this.withdrawAmount);

        const reserve = await this.lendingPool.getReserveData(this.uToken.address);
        await expect(this.withdrawTx)
          .to.emit(this.aToken, "Burn")
          .withArgs(
            this.aaveController.address,
            this.alice.address,
            this.withdrawAmount,
            reserve.liquidityIndex);
      });

      it("aToken and uToken balances are correct ", async function () {
        expect(await this.uToken.balanceOf(this.alice.address)).to.equal(this.withdrawAmount);
        expect(await this.aToken.balanceOf(this.alice.address)).to.equal(
          this.depositAmount - this.withdrawAmount
        );

        expect(await this.aToken.totalSupply()).to.equal(this.depositAmount - this.withdrawAmount);
      });

      describe("after all remaining aTokens withdrawn", function () {
        beforeEach(async function () {
          this.withdrawAllTx = await this.aaveController.withdrawAll(this.uToken.address);
        });

        it("events emitted", async function () {
          await expect(this.withdrawAllTx)
            .to.emit(this.lendingPool, "Withdraw")
            .withArgs(
              this.uToken.address,
              this.aaveController.address,
              this.alice.address,
              this.depositAmount - this.withdrawAmount
            );

          await expect(this.withdrawAllTx)
            .to.emit(this.aToken, "Transfer")
            .withArgs(this.aaveController.address, ZERO_ADDRESS, 150);

          const reserve = await this.lendingPool.getReserveData(this.uToken.address);
          await expect(this.withdrawAllTx)
            .to.emit(this.aToken, "Burn")
            .withArgs(
              this.aaveController.address,
              this.alice.address,
              this.depositAmount - this.withdrawAmount,
              reserve.liquidityIndex,
            );
        });

        it("aToken and uToken balances are equal to initial", async function () {
          expect(await this.aToken.balanceOf(this.alice.address)).to.equal(0);
          expect(await this.uToken.balanceOf(this.alice.address)).to.equal(this.depositAmount);

          expect(await this.aToken.totalSupply()).to.equal(0);
        });
      });
    });
  });
});
