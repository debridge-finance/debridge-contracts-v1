const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");
const { ethers } = require("hardhat");

describe("PriceConsumer", function () {
  before(async function () {
    [deployer, other] = await ethers.getSigners();
  });

  beforeEach(async function () {
    this.PriceConsumerFactory = await ethers.getContractFactory("PriceConsumer");
    this.priceConsumer = await this.PriceConsumerFactory.deploy();
  });

  it("deployer is owner", async function () {
    expect(await this.priceConsumer.owner()).to.be.equal(deployer.address);
  });

  it("non-owner is unable to add priceFeed", async function () {
    await expectRevert(
      this.priceConsumer.connect(other).addPriceFeed(other.address, other.address),
      "Ownable: caller is not the owner"
    );
  });

  describe("using aggregator as pricefeed", function () {
    beforeEach(async function () {
      this.MockAggregatorFactory = await ethers.getContractFactory("MockAggregator");
      this.mockAggregator = await this.MockAggregatorFactory.deploy();
      await this.mockAggregator.setAnswer("123");
      await this.priceConsumer.addPriceFeed(other.address, this.mockAggregator.address);
    });

    it("token price is available", async function () {
      expect(await this.priceConsumer.getPriceOfToken(other.address)).to.be.equal("123");
    });
  });
});
