const { expect } = require("chai");

describe("CallProxy", function () {
  before(async function () {
    [deployer, reserve, receiver] = await ethers.getSigners();
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
          // ABI-encoded call of setUint256Payable(12345)
          const callData = "0xa85dcaea0000000000000000000000000000000000000000000000000000000000003039";
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

        it("call with array");
      });

      describe("when receiver is uniswap", function () {
        it("addLiquidityETH");

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
        it("addLiquidity");

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
        it("addLiquidityETH");
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
        it("addLiquidity");
        it("swapTokensForExactTokens");
        it("swapTokensForExactETH");
        it("swapExactTokensForETH");
      });
    });
  });
});
