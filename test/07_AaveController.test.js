const { ethers, upgrades } = require("hardhat")
const { ZERO_ADDRESS } = require("./utils.spec");
const { expect } = require("chai")
const { BN } = require("bn.js")
const MockToken = artifacts.require("MockToken");
const { BigNumber } = require("ethers");
const { TASK_ETHERSCAN_VERIFY } = require("hardhat-deploy");


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


    // periphery
    this.stableDebtArtifacts = await deployments.getArtifact("StableDebtToken")
    this.stableDebtFactory = await ethers.getContractFactory(this.stableDebtArtifacts.abi, this.stableDebtArtifacts.bytecode)

    this.variableDebtArtifacts = await deployments.getArtifact("VariableDebtToken")
    this.variableDebtFactory = await ethers.getContractFactory(this.variableDebtArtifacts.abi, this.variableDebtArtifacts.bytecode)

    this.aTokenArtifacts = await deployments.getArtifact("Atoken")
    this.aTokenFactory = await ethers.getContractFactory(this.aTokenArtifacts.abi, this.aTokenArtifacts.bytecode)


    this.RateStrategyArtifacts = await deployments.getArtifact("InterestRateStrategy")
    this.RateFactory = await ethers.getContractFactory(this.RateStrategyArtifacts.abi, this.RateStrategyArtifacts.bytecode)

    this.LPConfiguratorArtifacts = await deployments.getArtifact("LendingPoolConfigurator")
    this.LPConfiguratorFactory = await ethers.getContractFactory(this.LPConfiguratorArtifacts.abi, this.LPConfiguratorArtifacts.bytecode)

    this.collectorArtifacts = await deployments.getArtifact("Collector")
    this.collectorFactory = await ethers.getContractFactory(this.collectorArtifacts.abi, this.collectorArtifacts.bytecode)

  })

  beforeEach(async function() {

    this.poolAdrProvider = await this.poolProviderAdrFactory.deploy("Aave genesis market")
    await this.poolAdrProvider.deployed()


    this.lendingPool = await this.lendingPoolFactory.deploy()
    await this.lendingPool.deployed()
    await this.poolAdrProvider.setLendingPoolImpl(this.lendingPool.address)
    this.lendingPoolProxy = await this.poolAdrProvider.getLendingPool()
    // this.lendingPoolU = await upgrades.upgradeProxy(this.poolAdrProvider.address)//  TODO comment deprecated

    this.dataProvider = await this.dataProviderFactory.deploy(this.poolAdrProvider.address)
    await this.dataProvider.deployed()

    this.aave = await this.aaveFactory.deploy(this.poolAdrProvider.address, this.dataProvider.address)
    await this.aave.deployed()

    this.collector = await this.collectorFactory.deploy()


    this.stableDebt = await this.stableDebtFactory.deploy(
      this.lendingPool.address,
      this.token.address,
      "Stable Debt",
      "SBT",
      ZERO_ADDRESS)
    await this.stableDebt.deployed()

    this.variableDebt = await this.stableDebtFactory.deploy(
      this.lendingPool.address,
      this.token.address,
      "Veriable Debt",
      "VBT",
      ZERO_ADDRESS)
    await this.variableDebt.deployed()

    this.aToken = await this.aTokenFactory.deploy(
      this.lendingPool.address,
      this.token.address,
      this.collector.address,
      "Aave DAI",
      "aDAI",
      ZERO_ADDRESS
    )
    await this.aToken.deployed()

    this.RateStrategy = await this.RateFactory.deploy(
                                                this.poolAdrProvider.address,
                                                BigNumber.from(900000000000),
                                                0,
                                                BigNumber.from(40000000000),
                                                BigNumber.from(600000000000),
                                                BigNumber.from(20000000000),
                                                BigNumber.from(600000000000))
    await this.RateStrategy.deployed()

    this.lpConfigurator = await this.LPConfiguratorFactory.deploy()
    await this.lpConfigurator.deployed()

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
      
      // await this.lpConfigurator.initReserve(
      //   this.aToken.address,
      //   this.stableDebt.address,
      //   this.variableDebt.address,
      //   18,
      //   this.RateStrategy.address
      // )


      // //* the following function must be called from lpConfigurator
      // await this.lendingPool.initReserve(
      //   this.token.address,
      //   this.aToken.address,
      //   this.stableDebt.address,
      //   this.variableDebt.address,
      //   this.RateStrategy.address
      //   )
      
      this.depositAmount = BigNumber.from(200)
      await this.token.approve(this.aave.address, this.depositAmount)


      // const reservedToken = await this.lendingPool.getReserveData(this.token.address)
      // console.log('reservedToken: ', reservedToken)
      // console.log("reserve list: ", await this.lendingPool.getReservesList());

      const depositTx = await this.aave.deposit(this.token.address, this.depositAmount)
      // await expect(depositTx).to.emit(this.lendingPool, "Deposit")
      //         .withArgs(this.token.address, this.alice.address, this.alice.address, this.depositAmount, 0)

    })
  })

  describe("Wrapping assets", function() {
    it("should display 'aToken' address", async function() {

      // const aToken = await this.aave.aToken(this.token.address)
      // console.log(aToken)
    })
  })

  describe("Update reserves", function() {
    
    it("should update reserves", async function() {
      const reserves = await this.aave.updateReserves(this.alice.address, this.token.address)
      console.log(reserves)
    })
    
  })


});
