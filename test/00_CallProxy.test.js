const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CallProxy", function () {
  before(async function () {
    [deployer, reserve, receiver, tokenHolder] = await ethers.getSigners();
  });

  beforeEach(async function () {
    this.proxyFactory = await ethers.getContractFactory("CallProxy");
    this.proxy = await this.proxyFactory.deploy();
  });

  describe("Direct interaction", function () {
    describe("plain calls", function () {
      it("when receiver is EOA - ETH goes to receiver", async function () {
        const receiverBalanceBefore = await ethers.provider.getBalance(receiver.address);
        transferResult = await this.proxy.call(reserve.address, receiver.address, 0, { value: 1234876 });
        await transferResult.wait();
        const receiverBalanceAfter = await ethers.provider.getBalance(receiver.address);
        expect(receiverBalanceAfter.sub(receiverBalanceBefore)).to.be.equal("1234876");
        expect(transferResult.value).to.be.equal("1234876");
      });

      it("when receiver is reverting contract - ETH goes to reserve", async function () {
        // Internal Tx fails but main (External) transaction gets executed anyway
        // Ethers get transerred to reserve address as fallback
        const receiverContractFactory = await ethers.getContractFactory("MockProxyReceiverAlwaysReverting");
        const receiverContract = await receiverContractFactory.deploy();
        const receiverBalanceBefore = await ethers.provider.getBalance(receiverContract.address);
        const reserveBalanceBefore = await ethers.provider.getBalance(reserve.address);
        const transferResult = await this.proxy.call(reserve.address, receiverContract.address, 0, { value: 1234876 });
        const receiverBalanceAfter = await ethers.provider.getBalance(receiverContract.address);
        const reserveBalanceAfter = await ethers.provider.getBalance(reserve.address);
        expect(reserveBalanceAfter.sub(reserveBalanceBefore)).to.be.equal("1234876");
        expect(receiverBalanceAfter.sub(receiverBalanceBefore)).to.be.equal("0");
        expect(transferResult.value).to.be.equal("1234876");
      });

      describe("when receiver contract is executed - ETH stays on receiver", function () {
        it("plain ETH to payable receive()", async function () {
          const receiverContractFactory = await ethers.getContractFactory("MockProxyReceiver");
          const receiverContract = await receiverContractFactory.deploy();
          const receiverBalanceBefore = await ethers.provider.getBalance(receiverContract.address);
          const reserveBalanceBefore = await ethers.provider.getBalance(reserve.address);
          // passing empty calldata to hit receive function
          // https://docs.soliditylang.org/en/v0.8.6/contracts.html?highlight=receive#receive-ether-function
          const transferResult = await this.proxy.call(reserve.address, receiverContract.address, "0x", { value: 123487678 });
          // check internal tx was ok - hit payable receive() function and saved receiver's states
          expect(await receiverContract.lastHit()).to.be.equal("receive");
          expect(await receiverContract.weiReceived()).to.be.equal("123487678");
          const receiverBalanceAfter = await ethers.provider.getBalance(receiverContract.address);
          const reserveBalanceAfter = await ethers.provider.getBalance(reserve.address);
          expect(reserveBalanceAfter.sub(reserveBalanceBefore)).to.be.equal("0");
          expect(receiverBalanceAfter.sub(receiverBalanceBefore)).to.be.equal("123487678");
        });

        it("plain ETH to payable fallback()", async function () {
          const receiverContractFactory = await ethers.getContractFactory("MockProxyReceiver");
          const receiverContract = await receiverContractFactory.deploy();
          const receiverBalanceBefore = await ethers.provider.getBalance(receiverContract.address);
          const reserveBalanceBefore = await ethers.provider.getBalance(reserve.address);
          const transferResult = await this.proxy.call(reserve.address, receiverContract.address, 0, { value: 123487678 });
          // check internal tx was ok - hit payable fallback() function and saved receiver's state
          expect(await receiverContract.lastHit()).to.be.equal("fallback");
          const receiverBalanceAfter = await ethers.provider.getBalance(receiverContract.address);
          const reserveBalanceAfter = await ethers.provider.getBalance(reserve.address);
          expect(reserveBalanceAfter.sub(reserveBalanceBefore)).to.be.equal("0");
          expect(receiverBalanceAfter.sub(receiverBalanceBefore)).to.be.equal("123487678");
          expect(transferResult.value).to.be.equal("123487678");
        });

        it("single-argument uint256 call", async function () {
          const receiverContractFactory = await ethers.getContractFactory("MockProxyReceiver");
          const receiverContract = await receiverContractFactory.deploy();
          const receiverBalanceBefore = await ethers.provider.getBalance(receiverContract.address);
          const reserveBalanceBefore = await ethers.provider.getBalance(reserve.address);
          const callData = receiverContract.interface.encodeFunctionData("setUint256Payable", [12345]);
          const transferResult = await this.proxy.call(reserve.address, receiverContract.address, callData, { value: 12348767 });
          // check internal tx hit correct function
          expect(await receiverContract.lastHit()).to.be.equal("setUint256Payable");
          // check internal tx was ok and uint256 arg passed and saved successfully
          expect(await receiverContract.result()).to.be.equal("12345");
          expect(await receiverContract.weiReceived()).to.be.equal("12348767");
          const receiverBalanceAfter = await ethers.provider.getBalance(receiverContract.address);
          const reserveBalanceAfter = await ethers.provider.getBalance(reserve.address);
          expect(reserveBalanceAfter.sub(reserveBalanceBefore)).to.be.equal("0");
          // transferred balance appeared on receiving contract as expected
          expect(receiverBalanceAfter.sub(receiverBalanceBefore)).to.be.equal("12348767");
        });

        it("call with array", async function () {
          const receiverContractFactory = await ethers.getContractFactory("MockProxyReceiver");
          const receiverContract = await receiverContractFactory.deploy();
          const receiverBalanceBefore = await ethers.provider.getBalance(receiverContract.address);
          const reserveBalanceBefore = await ethers.provider.getBalance(reserve.address);
          const callData = receiverContract.interface.encodeFunctionData("setArrayUint256Payable", [[1,12,123,1234,12345,123456,1234567,12345678,123456789,1234567890]]);
          const transferResult = await this.proxy.call(reserve.address, receiverContract.address, callData, { value: 12348767 });
          // check internal tx hit correct function
          expect(await receiverContract.lastHit()).to.be.equal("setArrayUint256Payable");
          // check internal tx was ok and uint256 arg passed and saved successfully
          expect(await receiverContract.resultArray(0)).to.be.equal(1);
          expect(await receiverContract.resultArray(1)).to.be.equal(12);
          expect(await receiverContract.resultArray(2)).to.be.equal(123);
          expect(await receiverContract.resultArray(3)).to.be.equal(1234);
          expect(await receiverContract.resultArray(4)).to.be.equal(12345);
          expect(await receiverContract.resultArray(5)).to.be.equal(123456);
          expect(await receiverContract.resultArray(6)).to.be.equal(1234567);
          expect(await receiverContract.resultArray(7)).to.be.equal(12345678);
          expect(await receiverContract.resultArray(8)).to.be.equal(123456789);
          expect(await receiverContract.resultArray(9)).to.be.equal(1234567890);
          expect(await receiverContract.weiReceived()).to.be.equal("12348767");
          const receiverBalanceAfter = await ethers.provider.getBalance(receiverContract.address);
          const reserveBalanceAfter = await ethers.provider.getBalance(reserve.address);
          expect(reserveBalanceAfter.sub(reserveBalanceBefore)).to.be.equal("0");
          // transferred balance appeared on receiving contract as expected
          expect(receiverBalanceAfter.sub(receiverBalanceBefore)).to.be.equal("12348767");
        });
      });

      describe("when receiver is uniswap", function () {
        beforeEach(async function () {
          const WETH9Artifact = await deployments.getArtifact("WETH9");
          const WETH9Factory = await ethers.getContractFactory(WETH9Artifact.abi, WETH9Artifact.bytecode);
          this.weth = await WETH9Factory.deploy();
          await this.weth.deployed();

          const MockTokenArtifact = await deployments.getArtifact("MockToken");
          const MockTokenFactory = await ethers.getContractFactory(MockTokenArtifact.abi, MockTokenArtifact.bytecode);
          this.token = await MockTokenFactory.deploy("TOKEN", "TOKEN", "18");
          await this.token.deployed();

          const UniswapV2FactoryArtifact = await deployments.getArtifact("UniswapV2Factory");
          const UniswapV2Factory = await ethers.getContractFactory(UniswapV2FactoryArtifact.abi, UniswapV2FactoryArtifact.bytecode);
          this.factory = await UniswapV2Factory.deploy(deployer.address);
          await this.factory.deployed();

          const UniswapV2RouterArtifact = await deployments.getArtifact("UniswapV2Router02");
          const UniswapV2Router = await ethers.getContractFactory(UniswapV2RouterArtifact.abi, UniswapV2RouterArtifact.bytecode);
          this.router = await UniswapV2Router.deploy(this.factory.address, this.weth.address);
          await this.router.deployed();

          const UniswapV2PairArtifact = await deployments.getArtifact("UniswapV2Pair");
          const UniswapV2Pair = await ethers.getContractFactory(UniswapV2PairArtifact.abi, UniswapV2PairArtifact.bytecode);
          const pairResult = await this.factory.createPair(this.weth.address, this.token.address);
          this.pair = await UniswapV2Pair.attach((await pairResult.wait()).events[0].args.pair);

          await this.token.mint(deployer.address, ethers.constants.WeiPerEther.mul("10"));
          await this.token.approve(this.router.address, ethers.constants.MaxUint256);
          await this.weth.deposit({ value: ethers.constants.WeiPerEther.mul("10") });
          await this.weth.approve(this.router.address, ethers.constants.MaxUint256);

          await this.router.addLiquidity(
            this.weth.address,
            this.token.address,
            ethers.constants.WeiPerEther.mul("1"),
            ethers.constants.WeiPerEther.mul("1"),
            0,
            0,
            deployer.address,
            9999999999
          );
        });

        it("successful swapExactETHForTokens", async function () {
          expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal("0");
          const callData = this.router.interface.encodeFunctionData("swapExactETHForTokens", [
            1,
            [this.weth.address, this.token.address],
            tokenHolder.address,
            9999999999,
          ]);
          const transferResult = await this.proxy.call(reserve.address, this.router.address, callData, { value: 1234534567 });
          // relaxed check because AMM price impact and Uniswap v2 fee
          expect(await this.token.balanceOf(tokenHolder.address)).to.be.gt("1230000000");
        });

        it("reverting swapExactETHForTokens", async function () {
          const reserveETHBalanceBefore = await ethers.provider.getBalance(reserve.address);
          // amountOutMin increased to enforce swap failure
          const callData = this.router.interface.encodeFunctionData("swapExactETHForTokens", [
            9999999999,
            [this.weth.address, this.token.address],
            tokenHolder.address,
            9999999999,
          ]);
          const transferResult = await this.proxy.call(reserve.address, this.router.address, callData, { value: 1234534567 });
          const reserveETHBalanceAfter = await ethers.provider.getBalance(reserve.address);
          // Results of failing swap:
          // * Swap had no effect (no ETH spent, no tokens acquired)
          // * ETHers of tx.value got evacuated to reserve.address
          expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal("0");
          expect(reserveETHBalanceAfter.sub(reserveETHBalanceBefore)).to.be.equal("1234534567");
        });

        it("swapETHForExactTokens");
      });
    });

    describe("ERC20 calls", function () {
      beforeEach(async function () {
        const MockTokenArtifact = await deployments.getArtifact("MockToken");
        const MockTokenFactory = await ethers.getContractFactory(MockTokenArtifact.abi, MockTokenArtifact.bytecode);
        this.token = await MockTokenFactory.deploy("TOKEN", "TOKEN", "18");
        await this.token.deployed();
        await this.token.mint(this.proxy.address, "8765432");
      });

      it("reverts if _token fails", async function () {
        const BrokenTokenFactory = await ethers.getContractFactory("MockProxyReceiverAlwaysReverting");
        const brokenToken = await BrokenTokenFactory.deploy();
        await expect(this.proxy.callERC20(brokenToken.address, reserve.address, receiver.address, "0x")).to.be.reverted;
        await expect(this.proxy.callERC20(brokenToken.address, reserve.address, receiver.address, "0xdeadbeef")).to.be.reverted;
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("8765432");
      });

      it("when receiving contract doesn't pull tokens - they stay on proxy (Is it expected?)", async function () {
        const nonPullingReceiverContractFactory = await ethers.getContractFactory("MockProxyReceiver");
        const nonPullingReceiver = await nonPullingReceiverContractFactory.deploy();
        expect(await this.token.balanceOf(reserve.address)).to.be.equal("0");
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("8765432");
        // call the method that doesn't pull approved tokens
        const callData = nonPullingReceiver.interface.encodeFunctionData("setUint256Payable", [12345]);
        await this.proxy.callERC20(this.token.address, reserve.address, nonPullingReceiver.address, callData);
        // check we hit the non-pulling function
        expect(await nonPullingReceiver.lastHit()).to.be.equal("setUint256Payable");
        // token balance stays intact
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("8765432");
      });

      it("when receiver is EOA - tokens stay on proxy (Is it expected?)", async function () {
        expect(await this.token.balanceOf(reserve.address)).to.be.equal("0");
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("8765432");
        transferResult = await this.proxy.callERC20(this.token.address, reserve.address, receiver.address, "0x");
        transferResult = await this.proxy.callERC20(this.token.address, reserve.address, receiver.address, "0xdeadbeef");
        expect(await this.token.balanceOf(reserve.address)).to.be.equal("0");
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("8765432");
      });

      it("when receiver is reverting contract");

      describe("when receiver is ordinary contract", function () {
        it("single-argument call");

        it("call with array");
      });

      describe("when receiver is uniswap", function () {

        it("swapTokensForExactTokens");

        it("swapTokensForExactETH");

        it("swapExactTokensForETH");
      });
    });
  });

  describe("Cross-contract interaction", function () {
    describe("plain calls", function () {
      it("when receiver is EOA");
      it("when receiver is reverting contract");
      describe("when receiver is ordinary contract", function () {
        it("single-argument call");
        it("call with array");
      });
      describe("when receiver is uniswap", function () {
        it("swapExactETHForTokens");
        it("swapETHForExactTokens");
      });
    });
    describe("ERC20 calls", function () {
      it("reverts if _token is non-ERC-20 comlpliant");
      it("when receiver is EOA");
      it("when receiver is reverting contract");
      describe("when receiver is ordinary contract", function () {
        it("single-argument call");
        it("call with array");
      });
      describe("when receiver is uniswap", function () {
        it("swapTokensForExactTokens");
        it("swapTokensForExactETH");
        it("swapExactTokensForETH");
      });
    });
  });
});
