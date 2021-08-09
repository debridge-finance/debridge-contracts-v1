const { ethers, companionNetworks } = require("hardhat")
const { ZERO_ADDRESS } = require("./utils.spec");
const { expect } = require("chai")
const { BN } = require("bn.js")
const MockToken = artifacts.require("MockToken");
const { BigNumber } = require("ethers");


contract("AaveController (AaveInteractor)", function() {
  before(async function() {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]

    this.token = await MockToken.new("DAI", "DAI", 18)
    this.token.mint(this.alice.address, BigNumber.from(100000))
    
    this.lendingPoolArtifacts = await deployments.getArtifact("LendingPool");
    this.lendingPoolFactory = await ethers.getContractFactory(this.lendingPoolArtifacts.abi, this.lendingPoolArtifacts.bytecode);

    this.poolProviderArtifacts = await deployments.getArtifact("LendingPoolAddressesProvider");
    this.poolProviderAdrFactory = await ethers.getContractFactory(this.poolProviderArtifacts.abi, this.poolProviderArtifacts.bytecode);

    this.dataProviderArtifacts = await deployments.getArtifact("ProtocolDataProvider");
    this.dataProviderFactory = await ethers.getContractFactory(this.dataProviderArtifacts.abi, this.dataProviderArtifacts.bytecode);
    
    this.aaveFactory = await ethers.getContractFactory("AaveInteractor")
  })

  beforeEach(async function() {

    this.poolAdrProvider = await this.poolProviderAdrFactory.deploy("Aave genesis market")
    await this.poolAdrProvider.deployed()

    // this.lendingPool = await upgrades.deployProxy(this.lendingPoolFactory, [this.poolAdrProvider.address, ])
    this.lendingPool = await this.lendingPoolFactory.deploy()
    await this.lendingPool.deployed()
    await this.poolAdrProvider.setLendingPoolImpl(this.lendingPool.address)
    this.lendingPoolProxy = await this.poolAdrProvider.getLendingPool()

    this.dataProvider = await this.dataProviderFactory.deploy(this.poolAdrProvider.address)
    await this.dataProvider.deployed()

    this.aave = await this.aaveFactory.deploy(this.poolAdrProvider.address, this.dataProvider.address)
    await this.aave.deployed()
  })

  describe("Contract has right initial states", function() {
    it("should has proper proxied lendingPool address ", async function() {
      // console.log("1: ", await this.aave.lendingPool())
      // console.log("2: ", this.lendingPoolProxy)
      expect(await this.aave.lendingPool()).to.equal(this.lendingPoolProxy)
    })
  })

  

  describe("Depositing tokens", function() {
    it("should make deposit and create 'aToken' with new address", async function() {
      this.depositAmount = BigNumber.from(200)
      await this.token.approve(this.aave.address, this.depositAmount)

      // await expect(this.aave.deposit(this.token.address, this.depositAmount))
      //         .to.be.reverted

      const depositTx = await this.aave.deposit(this.token.address, this.depositAmount)
      // await expect(depositTx).to.emit(this.lendingPool, "Deposit")
      //         .withArgs(this.token.address, this.alice.address, this.alice.address, this.depositAmount, 0)

    })
  })

  describe("Wrapping assets", function() {
    it("should display 'aToken' address", async function() {
      const aToken = await this.aave.aToken(this.token.address)
      console.log(aToken)
    })
    
  })


});
