const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");
const { ethers } = require("hardhat");

describe("PriceConsumer", function () {
  before(async function () {
    [deployer, other] = await ethers.getSigners();
  });

  beforeEach(async function () {
    this.PriceConsumerFactory = await ethers.getContractFactory("MockPriceConsumer");
    this.priceConsumer = await this.PriceConsumerFactory.deploy();
  });

  it("deployer is owner", async function () {
    expect(await this.priceConsumer.owner()).to.be.equal(deployer.address);
  });

  it("non-owner is unable to add priceFeed", async function () {
    await expectRevert(this.priceConsumer.connect(other).addPriceFeed(other.address, other.address), "Ownable: caller is not the owner");
  });

  describe("using aggregator as pricefeed", function () {

    const answer = '123';
    const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

    beforeEach(async function () {
      this.MockAggregatorFactory = await ethers.getContractFactory("MockAggregator");
      this.mockAggregator = await this.MockAggregatorFactory.deploy();
      await this.mockAggregator.setAnswer(answer)
      await this.priceConsumer.addPriceFeed(other.address, this.mockAggregator.answer());
    });

    it("token price is available", async function () {
        expect(await this.priceConsumer.getPriceOfToken(other.address)).to.be.equal(answer);
    });

    it("token price is available", async function () {
      const realPrice = await this.priceConsumer.getRate(WETH,USDT);
      console.log(realPrice)
    });
  });
})
