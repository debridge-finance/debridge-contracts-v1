const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");
const { ethers } = require("hardhat");
const { toWei } = web3.utils;
const MockToken = artifacts.require("MockToken");
const IUniswapV2Pair = artifacts.require("IUniswapV2Pair");

describe("PriceConsumer", function () {
  let wethAmount, usdtAmount;
  const usdtDecimals = 6

  before(async function () {
    [deployer, other] = await ethers.getSigners();

    const WETH9 = await deployments.getArtifact("WETH9");
    const WETH9Factory = await ethers.getContractFactory(WETH9.abi,WETH9.bytecode, deployer);
    const UniswapV2 = await deployments.getArtifact("UniswapV2Factory");
    const UniswapV2Factory = await ethers.getContractFactory(UniswapV2.abi,UniswapV2.bytecode, deployer);
    
    this.weth = await WETH9Factory.deploy();
    this.factory = await UniswapV2Factory.deploy(deployer.address);
    this.usdtToken = await MockToken.new("USDT Token", "dUSDT", usdtDecimals);

    await this.factory.createPair(
      this.usdtToken.address,
      this.weth.address,
    );

    const pairAddress = await this.factory.getPair(this.usdtToken.address, this.weth.address)
    this.pair = await IUniswapV2Pair.at(pairAddress);
    
    // setup
    wethAmount = toWei("27"); // 27 ETH
    usdtAmount = "78000000000"; // 78k USDT with usdtDecimals 6

    await this.weth.connect(other).deposit({
      value: wethAmount,
    });
    await this.usdtToken.mint(this.pair.address, usdtAmount);
    await this.weth.connect(other).transfer(this.pair.address, wethAmount);
    await this.pair.sync();
  });

  beforeEach(async function () {
    this.PriceConsumerFactory = await ethers.getContractFactory("PriceConsumer");
    this.priceConsumer = await this.PriceConsumerFactory.deploy();
    this.priceConsumer.initialize(this.weth.address, this.factory.address);
  });

  it("deployer is owner", async function () {
    expect(await this.priceConsumer.owner()).to.be.equal(deployer.address);
  });

  describe("using uniswap", function () {
    let ethUsdtPrice, usdtEthPrice;

    beforeEach(async function () {
      ethUsdtPrice = await this.priceConsumer.getRate(this.weth.address, this.usdtToken.address);
      usdtEthPrice = await this.priceConsumer.getRate(this.usdtToken.address, this.weth.address);
    });

    it("tokens price is greater than 0", async function () {
      expect(+ethUsdtPrice).to.be.greaterThan(0, 'ethUsdPrice is 0');
      expect(+usdtEthPrice).to.be.greaterThan(0, 'usdtEthPrice is 0');
    });

    it("tokens price is correct", async function () {
      console.log('actual USDT/ETH price in wei', +usdtEthPrice)
      console.log('actual ETH/USDT price in wei', +ethUsdtPrice);

      const expectedUsdtEthPrice = ((wethAmount / 10 ** 18) / (usdtAmount / 10 ** usdtDecimals))
      const expectedEthUsdtPrice = ((usdtAmount / 10 ** usdtDecimals) / (wethAmount / 10 ** 18))
      console.log('expected USDT/ETH price', expectedUsdtEthPrice)
      console.log('expected ETH/USDT price', expectedEthUsdtPrice)

      expect(+usdtEthPrice).to.be.equal(parseInt(expectedUsdtEthPrice * 10 ** 18), 'ethUsdPrice is incorrect');
      expect(+ethUsdtPrice).to.be.equal(parseInt(expectedEthUsdtPrice * 10 ** usdtDecimals), 'usdtEthPrice is incorrect');
    });

    it("getPriceOfTokenInWETH always considers WETH as quote", async function () {
      const price = await this.priceConsumer.getPriceOfTokenInWETH(this.usdtToken.address);
      expect(price).to.be.equal(usdtEthPrice, 'getPriceOfTokenInWETH is incorrect');
    });
  });
})
