const { expect } = require("chai");
const { ethers } = require("hardhat");

const flags = 0;
const nativeSender = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
const chainIdFrom = 42;
describe("CallProxy", function () {
  before(async function () {
    [deployer, reserve, receiver, tokenHolder] = await ethers.getSigners();
  });

  beforeEach(async function () {
    this.proxyFactory = await ethers.getContractFactory("CallProxy", deployer);
    this.proxy = await upgrades.deployProxy(this.proxyFactory, []);

    const DEBRIDGE_GATE_ROLE = await this.proxy.DEBRIDGE_GATE_ROLE();
    await this.proxy.grantRole(DEBRIDGE_GATE_ROLE, deployer.address);
  });

  describe("Direct interaction", function () {
    describe("plain calls", function () {
      it("when receiver is EOA - ETH goes to receiver", async function () {
        const receiverBalanceBefore = await ethers.provider.getBalance(receiver.address);
        transferResult = await this.proxy.call(
          reserve.address,
          receiver.address,
          0,
          flags,
          nativeSender,
          chainIdFrom,
          {
            value: 1234876,
          }
        );
        await transferResult.wait();
        const receiverBalanceAfter = await ethers.provider.getBalance(receiver.address);
        expect(receiverBalanceAfter.sub(receiverBalanceBefore)).to.be.equal("1234876");
        expect(transferResult.value).to.be.equal("1234876");
      });

      it("when receiver is reverting contract - ETH goes to reserve", async function () {
        // Internal Tx fails but main (External) transaction gets executed anyway
        // Ethers get transerred to reserve address as fallback
        const receiverContractFactory = await ethers.getContractFactory(
          "MockProxyReceiverAlwaysReverting"
        );
        const receiverContract = await receiverContractFactory.deploy();
        const receiverBalanceBefore = await ethers.provider.getBalance(receiverContract.address);
        const reserveBalanceBefore = await ethers.provider.getBalance(reserve.address);
        const transferResult = await this.proxy.call(
          reserve.address,
          receiverContract.address,
          0,
          flags,
          nativeSender,
          chainIdFrom,
          {
            value: 1234876,
          }
        );
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
          const transferResult = await this.proxy.call(
            reserve.address,
            receiverContract.address,
            [],
            flags,
            nativeSender,
            chainIdFrom,
            {
              value: 123487678,
            }
          );
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
          const transferResult = await this.proxy.call(
            reserve.address,
            receiverContract.address,
            0,
            flags,
            nativeSender,
            chainIdFrom,
            {
              value: 123487678,
            }
          );
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
          const callData = receiverContract.interface.encodeFunctionData("setUint256Payable", [
            12345,
          ]);
          const transferResult = await this.proxy.call(
            reserve.address,
            receiverContract.address,
            callData,
            flags,
            nativeSender,
            chainIdFrom,
            {
              value: 12348767,
            }
          );
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
          const callData = receiverContract.interface.encodeFunctionData("setArrayUint256Payable", [
            [1, 12, 123, 1234, 12345, 123456, 1234567, 12345678, 123456789, 1234567890],
          ]);
          const transferResult = await this.proxy.call(
            reserve.address,
            receiverContract.address,
            callData,
            flags,
            nativeSender,
            chainIdFrom,
            {
              value: 12348767,
            }
          );
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
          const WETH9Factory = await ethers.getContractFactory(
            WETH9Artifact.abi,
            WETH9Artifact.bytecode
          );
          this.weth = await WETH9Factory.deploy();
          await this.weth.deployed();

          const MockTokenArtifact = await deployments.getArtifact("MockToken");
          const MockTokenFactory = await ethers.getContractFactory(
            MockTokenArtifact.abi,
            MockTokenArtifact.bytecode
          );
          this.token = await MockTokenFactory.deploy("TOKEN", "TOKEN", "18");
          await this.token.deployed();

          const UniswapV2FactoryArtifact = await deployments.getArtifact("UniswapV2Factory");
          const UniswapV2Factory = await ethers.getContractFactory(
            UniswapV2FactoryArtifact.abi,
            UniswapV2FactoryArtifact.bytecode
          );
          this.factory = await UniswapV2Factory.deploy(deployer.address);
          await this.factory.deployed();

          const UniswapV2RouterArtifact = await deployments.getArtifact("UniswapV2Router02");
          const UniswapV2Router = await ethers.getContractFactory(
            UniswapV2RouterArtifact.abi,
            UniswapV2RouterArtifact.bytecode
          );
          this.router = await UniswapV2Router.deploy(this.factory.address, this.weth.address);
          await this.router.deployed();

          const UniswapV2PairArtifact = await deployments.getArtifact("UniswapV2Pair");
          const UniswapV2Pair = await ethers.getContractFactory(
            UniswapV2PairArtifact.abi,
            UniswapV2PairArtifact.bytecode
          );
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
          const transferResult = await this.proxy.call(
            reserve.address,
            this.router.address,
            callData,
            flags,
            nativeSender,
            chainIdFrom,
            {
              value: 1234534567,
            }
          );
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
          const transferResult = await this.proxy.call(
            reserve.address,
            this.router.address,
            callData,
            flags,
            nativeSender,
            chainIdFrom,
            {
              value: 1234534567,
            }
          );
          const reserveETHBalanceAfter = await ethers.provider.getBalance(reserve.address);
          // Results of failing swap:
          // * Swap had no effect (no ETH spent, no tokens acquired)
          // * ETHers of tx.value got evacuated to reserve.address
          expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal("0");
          expect(reserveETHBalanceAfter.sub(reserveETHBalanceBefore)).to.be.equal("1234534567");
        });

        it("successful swapETHForExactTokens", async function () {
          const amountOut = await this.router.getAmountsOut(100, [
            this.weth.address,
            this.token.address,
          ]);
          expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal("0");
          const callData = this.router.interface.encodeFunctionData("swapETHForExactTokens", [
            amountOut[1],
            [this.weth.address, this.token.address],
            tokenHolder.address,
            9999999999,
          ]);
          const transferResult = await this.proxy.call(
            reserve.address,
            this.router.address,
            callData,
            flags,
            nativeSender,
            chainIdFrom,
            {
              value: amountOut[0],
            }
          );
          expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal(amountOut[1]);
        });

        it("if swapExactETHForTokens reverts - ETH go to reserve", async function () {
          const reserveETHBalanceBefore = await ethers.provider.getBalance(reserve.address);
          // amountOutMin increased to enforce swap failure
          const callData = this.router.interface.encodeFunctionData("swapETHForExactTokens", [
            9999999999,
            [this.weth.address, this.token.address],
            tokenHolder.address,
            9999999999,
          ]);
          const transferResult = await this.proxy.call(
            reserve.address,
            this.router.address,
            callData,
            flags,
            nativeSender,
            chainIdFrom,
            {
              value: 1234534567,
            }
          );
          const reserveETHBalanceAfter = await ethers.provider.getBalance(reserve.address);
          // Results of failing swap:
          // * Swap had no effect (no ETH spent, no tokens acquired)
          // * ETHers of tx.value got evacuated to reserve.address
          expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal("0");
          expect(reserveETHBalanceAfter.sub(reserveETHBalanceBefore)).to.be.equal("1234534567");
        });
      });
    });

    describe("ERC20 calls", function () {
      beforeEach(async function () {
        const MockTokenArtifact = await deployments.getArtifact("MockToken");
        const MockTokenFactory = await ethers.getContractFactory(
          MockTokenArtifact.abi,
          MockTokenArtifact.bytecode
        );
        this.token = await MockTokenFactory.deploy("TOKEN", "TOKEN", "18");
        await this.token.deployed();
        await this.token.mint(this.proxy.address, "8765432");
      });

      it("reverts if _token fails", async function () {
        const BrokenTokenFactory = await ethers.getContractFactory(
          "MockProxyReceiverAlwaysReverting"
        );
        const brokenToken = await BrokenTokenFactory.deploy();
        await expect(
          this.proxy.callERC20(
            brokenToken.address,
            reserve.address,
            receiver.address,
            [],
            flags,
            nativeSender,
            chainIdFrom,
          )
        ).to.be.reverted;
        await expect(
          this.proxy.callERC20(
            brokenToken.address,
            reserve.address,
            receiver.address,
            "0xdeadbeef",
            flags,
            nativeSender,
            chainIdFrom,
          )
        ).to.be.reverted;
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("8765432");
      });

      it("when receiving contract doesn't pull tokens - they transfer to reserve", async function () {
        const nonPullingReceiverContractFactory = await ethers.getContractFactory(
          "MockProxyReceiver"
        );
        const nonPullingReceiver = await nonPullingReceiverContractFactory.deploy();
        expect(await this.token.balanceOf(reserve.address)).to.be.equal("0");
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("8765432");
        // call the method that doesn't pull approved tokens
        const callData = nonPullingReceiver.interface.encodeFunctionData("setUint256Payable", [
          12345,
        ]);
        await this.proxy.callERC20(
          this.token.address,
          reserve.address,
          nonPullingReceiver.address,
          callData,
          flags,
          nativeSender,
          chainIdFrom,
        );
        // check we hit the non-pulling function
        expect(await nonPullingReceiver.lastHit()).to.be.equal("setUint256Payable");
        // token balance stays intact
        expect(await this.token.balanceOf(reserve.address)).to.be.equal("8765432");
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("0");
      });

      it("when receiver is EOA - tokens transfer to reserve", async function () {
        expect(await this.token.balanceOf(reserve.address)).to.be.equal("0");
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("8765432");
        transferResult = await this.proxy.callERC20(
          this.token.address,
          reserve.address,
          receiver.address,
          [],
          flags,
          nativeSender,
          chainIdFrom,
        );
        transferResult = await this.proxy.callERC20(
          this.token.address,
          reserve.address,
          receiver.address,
          "0xdeadbeef",
          flags,
          nativeSender,
          chainIdFrom,
        );
        expect(await this.token.balanceOf(reserve.address)).to.be.equal("8765432");
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("0");
      });

      it("when receiver is reverting contract - tokens go to reserve", async function () {
        // const callData = MockProxyReceiver.interface.encodeFunctionData("setUint256Payable", [12345]);
        const callData =
          "0xa85dcaea0000000000000000000000000000000000000000000000000000000000003039";

        const alwaysRevertingReceiverContractFactory = await ethers.getContractFactory(
          "MockProxyReceiverAlwaysReverting"
        );
        const alwaysRevertingReceiver = await alwaysRevertingReceiverContractFactory.deploy();
        expect(await this.token.balanceOf(reserve.address)).to.be.equal("0");
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("8765432");

        await this.proxy.callERC20(
          this.token.address,
          reserve.address,
          alwaysRevertingReceiver.address,
          callData,
          flags,
          nativeSender,
          chainIdFrom,
        );

        expect(await this.token.balanceOf(reserve.address)).to.be.equal("8765432");
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("0");
      });

      describe("when receiver is token-pulling contract", function () {
        let receiverContract;
        beforeEach(async function () {
          const receiverContractFactory = await ethers.getContractFactory("MockProxyReceiver");
          receiverContract = await receiverContractFactory.deploy();
          await this.token.mint(reserve.address, "1111");
        });

        it("receiver got data and pulled tokens from proxy", async function () {
          const callData = receiverContract.interface.encodeFunctionData("setArrayAndPullToken", [
            this.token.address,
            1111,
            [1, 12, 123, 1234, 12345, 123456, 1234567, 12345678, 123456789, 1234567890],
          ]);
          const receiverBalanceBefore = await this.token.balanceOf(receiverContract.address);
          const reserveBalanceBefore = await this.token.balanceOf(reserve.address);
          const proxyBalance = await this.token.balanceOf(this.proxy.address);
          const transferResult = await this.proxy.callERC20(
            this.token.address,
            reserve.address,
            receiverContract.address,
            callData,
            flags,
            nativeSender,
            chainIdFrom,
          );
          // check internal tx hit correct function
          expect(await receiverContract.lastHit()).to.be.equal("setArrayAndPullToken");
          // check internal tx was ok and arguments passed in and saved successfully
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
          expect(await receiverContract.tokensReceived()).to.be.equal("1111");
          const receiverBalanceAfter = await this.token.balanceOf(receiverContract.address);
          const reserveBalanceAfter = await this.token.balanceOf(reserve.address);
          const proxyBalanceAfter = await this.token.balanceOf(this.proxy.address);
          expect(reserveBalanceAfter).to.be.equal(proxyBalance);
          expect(proxyBalanceAfter).to.be.equal("0");
          // transferred balance appeared on receiving contract as expected
          expect(receiverBalanceAfter.sub(receiverBalanceBefore)).to.be.equal("1111");
        });
      });

      describe("when receiver is uniswap", function () {
        beforeEach(async function () {
          const WETH9Artifact = await deployments.getArtifact("WETH9");
          const WETH9Factory = await ethers.getContractFactory(
            WETH9Artifact.abi,
            WETH9Artifact.bytecode
          );
          this.weth = await WETH9Factory.deploy();
          await this.weth.deployed();

          const MockTokenArtifact = await deployments.getArtifact("MockToken");
          const MockTokenFactory = await ethers.getContractFactory(
            MockTokenArtifact.abi,
            MockTokenArtifact.bytecode
          );
          this.token = await MockTokenFactory.deploy("TOKEN", "TOKEN", "18");
          await this.token.deployed();

          const UniswapV2FactoryArtifact = await deployments.getArtifact("UniswapV2Factory");
          const UniswapV2Factory = await ethers.getContractFactory(
            UniswapV2FactoryArtifact.abi,
            UniswapV2FactoryArtifact.bytecode
          );
          this.factory = await UniswapV2Factory.deploy(deployer.address);
          await this.factory.deployed();

          const UniswapV2RouterArtifact = await deployments.getArtifact("UniswapV2Router02");
          const UniswapV2Router = await ethers.getContractFactory(
            UniswapV2RouterArtifact.abi,
            UniswapV2RouterArtifact.bytecode
          );
          this.router = await UniswapV2Router.deploy(this.factory.address, this.weth.address);
          await this.router.deployed();

          const UniswapV2PairArtifact = await deployments.getArtifact("UniswapV2Pair");
          const UniswapV2Pair = await ethers.getContractFactory(
            UniswapV2PairArtifact.abi,
            UniswapV2PairArtifact.bytecode
          );
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
        it("swapTokensForExactTokens", async function () {
          await this.weth.transfer(this.proxy.address, 1000);
          const amountOut = await this.router.getAmountsOut(100, [
            this.weth.address,
            this.token.address,
          ]);
          expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal("0");
          const callData = this.router.interface.encodeFunctionData("swapTokensForExactTokens", [
            amountOut[1],
            amountOut[0],
            [this.weth.address, this.token.address],
            tokenHolder.address,
            9999999999,
          ]);
          const transferResult = await this.proxy.callERC20(
            this.weth.address,
            reserve.address,
            this.router.address,
            callData,
            flags,
            nativeSender,
            chainIdFrom,
          );
          expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal(amountOut[1]);
          expect(await this.weth.balanceOf(this.proxy.address)).to.be.equal(0);
          expect(await this.weth.balanceOf(reserve.address)).to.be.equal(
            1000 - parseInt(amountOut[0])
          );
        });

        it("swapTokensForExactETH", async function () {
          const tokenHolderBalanceBefore = await ethers.provider.getBalance(tokenHolder.address);
          await this.token.transfer(this.proxy.address, 1000);
          const amountOut = await this.router.getAmountsOut(100, [
            this.token.address,
            this.weth.address,
          ]);
          expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal("0");
          const callData = this.router.interface.encodeFunctionData("swapTokensForExactETH", [
            amountOut[1],
            parseInt(amountOut[0]) + 500,
            [this.token.address, this.weth.address],
            tokenHolder.address,
            9999999999,
          ]);
          const transferResult = await this.proxy.callERC20(
            this.token.address,
            reserve.address,
            this.router.address,
            callData,
            flags,
            nativeSender,
            chainIdFrom,
          );
          const tokenHolderBalanceAfter = await ethers.provider.getBalance(tokenHolder.address);
          expect(tokenHolderBalanceAfter.sub(tokenHolderBalanceBefore)).to.be.equal(amountOut[1]);
          expect(await this.token.balanceOf(this.proxy.address)).to.be.equal(0);
          expect(await this.token.balanceOf(reserve.address)).to.be.equal(
            1000 - parseInt(amountOut[0])
          );
        });

        it("swapExactTokensForETH", async function () {
          const tokenHolderBefore = await ethers.provider.getBalance(tokenHolder.address);
          await this.token.transfer(this.proxy.address, 1000);
          const amountOut = await this.router.getAmountsOut(100, [
            this.token.address,
            this.weth.address,
          ]);
          expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal("0");
          const callData = this.router.interface.encodeFunctionData("swapExactTokensForETH", [
            amountOut[0],
            1,
            [this.token.address, this.weth.address],
            tokenHolder.address,
            9999999999,
          ]);
          const transferResult = await this.proxy.callERC20(
            this.token.address,
            reserve.address,
            this.router.address,
            callData,
            flags,
            nativeSender,
            chainIdFrom,
          );
          const tokenHolderAfter = await ethers.provider.getBalance(tokenHolder.address);
          expect(tokenHolderAfter.sub(tokenHolderBefore)).to.be.equal(amountOut[1]);
          expect(await this.token.balanceOf(this.proxy.address)).to.be.equal(0);
          expect(await this.token.balanceOf(reserve.address)).to.be.equal(
            1000 - parseInt(amountOut[0])
          );
        });
      });
    });
  });

  describe("Cross-contract interaction", function () {
    before(async function () {
      TokenFactory = await ethers.getContractFactory("MockToken");
      ProxyConsumer = await ethers.getContractFactory("MockProxyConsumer");
    });

    beforeEach(async function () {
      this.token = await TokenFactory.deploy("TOKEN", "TOKEN", "18");
      await this.token.deployed();
      this.ProxyConsumer = await ProxyConsumer.deploy(this.proxy.address, this.token.address);
      await this.ProxyConsumer.deployed();

      const DEBRIDGE_GATE_ROLE = await this.proxy.DEBRIDGE_GATE_ROLE();
      await this.proxy.grantRole(DEBRIDGE_GATE_ROLE, this.ProxyConsumer.address);
    });

    describe("plain calls", function () {
      it("when receiver is EOA", async function () {
        const receiverBalanceBefore = await ethers.provider.getBalance(receiver.address);
        const transferResult = await this.ProxyConsumer.transferToken(
          ethers.constants.AddressZero,
          receiver.address,
          reserve.address,
          0,
          {
            value: 1234876,
          }
        );
        await transferResult.wait();
        const receiverBalanceAfter = await ethers.provider.getBalance(receiver.address);
        expect(receiverBalanceAfter.sub(receiverBalanceBefore)).to.be.equal("1234876");
        expect(transferResult.value).to.be.equal("1234876");
      });

      it("when receiver is reverting contract", async function () {
        // Internal Tx fails but main (External) transaction gets executed anyway
        // Ethers get transerred to reserve address as fallback
        const receiverContractFactory = await ethers.getContractFactory(
          "MockProxyReceiverAlwaysReverting"
        );
        const receiverContract = await receiverContractFactory.deploy();
        const receiverBalanceBefore = await ethers.provider.getBalance(receiverContract.address);
        const reserveBalanceBefore = await ethers.provider.getBalance(reserve.address);
        const transferResult = await this.ProxyConsumer.transferToken(
          ethers.constants.AddressZero,
          receiverContract.address,
          reserve.address,
          0,
          {
            value: 1234876,
          }
        );
        const receiverBalanceAfter = await ethers.provider.getBalance(receiverContract.address);
        const reserveBalanceAfter = await ethers.provider.getBalance(reserve.address);
        expect(reserveBalanceAfter.sub(reserveBalanceBefore)).to.be.equal("1234876");
        expect(receiverBalanceAfter.sub(receiverBalanceBefore)).to.be.equal("0");
        expect(transferResult.value).to.be.equal("1234876");
      });
      describe("when receiver is ordinary contract", function () {
        it("single-argument uint256 call", async function () {
          const receiverContractFactory = await ethers.getContractFactory("MockProxyReceiver");
          const receiverContract = await receiverContractFactory.deploy();
          const receiverBalanceBefore = await ethers.provider.getBalance(receiverContract.address);
          const reserveBalanceBefore = await ethers.provider.getBalance(reserve.address);
          const callData = receiverContract.interface.encodeFunctionData("setUint256Payable", [
            12345,
          ]);
          const transferResult = await this.ProxyConsumer.transferToken(
            ethers.constants.AddressZero,
            receiverContract.address,
            reserve.address,
            callData,
            { value: 12348767 }
          );
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
          const callData = receiverContract.interface.encodeFunctionData("setArrayUint256Payable", [
            [1, 12, 123, 1234, 12345, 123456, 1234567, 12345678, 123456789, 1234567890],
          ]);
          const transferResult = await this.ProxyConsumer.transferToken(
            ethers.constants.AddressZero,
            receiverContract.address,
            reserve.address,
            callData,
            { value: 12348767 }
          );
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

        describe("when receiver is uniswap", function () {
          beforeEach(async function () {
            const WETH9Artifact = await deployments.getArtifact("WETH9");
            const WETH9Factory = await ethers.getContractFactory(
              WETH9Artifact.abi,
              WETH9Artifact.bytecode
            );
            this.weth = await WETH9Factory.deploy();
            await this.weth.deployed();

            const MockTokenArtifact = await deployments.getArtifact("MockToken");
            const MockTokenFactory = await ethers.getContractFactory(
              MockTokenArtifact.abi,
              MockTokenArtifact.bytecode
            );
            this.token = await MockTokenFactory.deploy("TOKEN", "TOKEN", "18");
            await this.token.deployed();

            const UniswapV2FactoryArtifact = await deployments.getArtifact("UniswapV2Factory");
            const UniswapV2Factory = await ethers.getContractFactory(
              UniswapV2FactoryArtifact.abi,
              UniswapV2FactoryArtifact.bytecode
            );
            this.factory = await UniswapV2Factory.deploy(deployer.address);
            await this.factory.deployed();

            const UniswapV2RouterArtifact = await deployments.getArtifact("UniswapV2Router02");
            const UniswapV2Router = await ethers.getContractFactory(
              UniswapV2RouterArtifact.abi,
              UniswapV2RouterArtifact.bytecode
            );
            this.router = await UniswapV2Router.deploy(this.factory.address, this.weth.address);
            await this.router.deployed();

            const UniswapV2PairArtifact = await deployments.getArtifact("UniswapV2Pair");
            const UniswapV2Pair = await ethers.getContractFactory(
              UniswapV2PairArtifact.abi,
              UniswapV2PairArtifact.bytecode
            );
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
            const transferResult = await this.ProxyConsumer.transferToken(
              ethers.constants.AddressZero,
              this.router.address,
              reserve.address,
              callData,
              { value: 1234534567 }
            );
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
            const transferResult = await this.ProxyConsumer.transferToken(
              ethers.constants.AddressZero,
              this.router.address,
              reserve.address,
              callData,
              { value: 1234534567 }
            );
            const reserveETHBalanceAfter = await ethers.provider.getBalance(reserve.address);
            // Results of failing swap:
            // * Swap had no effect (no ETH spent, no tokens acquired)
            // * ETHers of tx.value got evacuated to reserve.address
            expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal("0");
            expect(reserveETHBalanceAfter.sub(reserveETHBalanceBefore)).to.be.equal("1234534567");
          });

          it("swapETHForExactTokens", async function () {
            const amountOut = await this.router.getAmountsOut(100, [
              this.weth.address,
              this.token.address,
            ]);
            expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal("0");
            const callData = this.router.interface.encodeFunctionData("swapETHForExactTokens", [
              amountOut[1],
              [this.weth.address, this.token.address],
              tokenHolder.address,
              9999999999,
            ]);
            const transferResult = await this.ProxyConsumer.transferToken(
              ethers.constants.AddressZero,
              this.router.address,
              reserve.address,
              callData,
              { value: amountOut[0] }
            );
            expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal(amountOut[1]);
          });

          it("reverting swapExactETHForTokens", async function () {
            const amountOut = await this.router.getAmountsOut(100, [
              this.weth.address,
              this.token.address,
            ]);
            const reserveETHBalanceBefore = await ethers.provider.getBalance(reserve.address);
            // amountOutMin increased to enforce swap failure
            const callData = this.router.interface.encodeFunctionData("swapETHForExactTokens", [
              9999999999,
              [this.weth.address, this.token.address],
              tokenHolder.address,
              9999999999,
            ]);
            const transferResult = await this.ProxyConsumer.transferToken(
              ethers.constants.AddressZero,
              this.router.address,
              reserve.address,
              callData,
              { value: amountOut[0] }
            );
            const reserveETHBalanceAfter = await ethers.provider.getBalance(reserve.address);
            // Results of failing swap:
            // * Swap had no effect (no ETH spent, no tokens acquired)
            // * ETHers of tx.value got evacuated to reserve.address
            expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal("0");
            expect(reserveETHBalanceAfter.sub(reserveETHBalanceBefore)).to.be.equal("100");
          });
        });
      });
    });
    describe("ERC20 calls", function () {
      it("reverts if _token fails", async function () {
        const BrokenTokenFactory = await ethers.getContractFactory(
          "MockProxyReceiverAlwaysReverting"
        );
        const brokenToken = await BrokenTokenFactory.deploy();
        await expect(
          this.ProxyConsumer.transferToken(
            brokenToken.address,
            receiver.address,
            reserve.address,
            [],
            {
              value: 1111,
            }
          )
        ).to.be.reverted;
        await expect(
          this.ProxyConsumer.transferToken(
            brokenToken.address,
            receiver.address,
            reserve.address,
            "0xdeadbeef",
            {
              value: 1111,
            }
          )
        ).to.be.reverted;
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("0");
      });

      it("when receiving contract doesn't pull tokens - they transfer to reserve", async function () {
        await this.token.mint(this.ProxyConsumer.address, "1111");
        const nonPullingReceiverContractFactory = await ethers.getContractFactory(
          "MockProxyReceiver"
        );
        const nonPullingReceiver = await nonPullingReceiverContractFactory.deploy();
        expect(await this.token.balanceOf(reserve.address)).to.be.equal("0");
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("0");
        // call the method that doesn't pull approved tokens
        const callData = nonPullingReceiver.interface.encodeFunctionData("setUint256Payable", [
          12345,
        ]);
        const transferResultTwo = await this.ProxyConsumer.transferToken(
          this.token.address,
          nonPullingReceiver.address,
          reserve.address,
          callData,
          { value: 1111 }
        );
        // check we hit the non-pulling function
        expect(await nonPullingReceiver.lastHit()).to.be.equal("setUint256Payable");
        // token balance stays intact
        expect(await this.token.balanceOf(reserve.address)).to.be.equal("1111");
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("0");
      });

      it("when receiver is EOA - tokens transfer to reserve", async function () {
        await this.token.mint(this.ProxyConsumer.address, "2222");

        expect(await this.token.balanceOf(reserve.address)).to.be.equal("0");
        expect(await this.token.balanceOf(this.ProxyConsumer.address)).to.be.equal("2222");
        const transferResult = await this.ProxyConsumer.transferToken(
          this.token.address,
          receiver.address,
          reserve.address,
          [],
          {
            value: 1111,
          }
        );
        const transferResultTwo = await this.ProxyConsumer.transferToken(
          this.token.address,
          receiver.address,
          reserve.address,
          "0xdeadbeef",
          {
            value: 1111,
          }
        );
        expect(await this.token.balanceOf(reserve.address)).to.be.equal("2222");
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("0");
      });

      it("when receiver is reverting contract", async function () {
        const unusableContractFactory = await ethers.getContractFactory("MockProxyReceiver");
        const unusableContract = await unusableContractFactory.deploy();
        // call the method that doesn't pull approved tokens
        const callData = unusableContract.interface.encodeFunctionData("setUint256Payable", [
          12345,
        ]);

        await this.token.mint(this.ProxyConsumer.address, "1111");

        const nonPullingReceiverContractFactory = await ethers.getContractFactory(
          "MockProxyReceiverAlwaysReverting"
        );
        const nonPullingReceiver = await nonPullingReceiverContractFactory.deploy();
        expect(await this.token.balanceOf(reserve.address)).to.be.equal("0");
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("0");

        await this.proxy.callERC20(
          this.token.address,
          reserve.address,
          nonPullingReceiver.address,
          callData,
          flags,
          nativeSender,
          chainIdFrom,
        );
        const transferResultTwo = await this.ProxyConsumer.transferToken(
          this.token.address,
          nonPullingReceiver.address,
          reserve.address,
          callData,
          { value: 1111 }
        );
        // token balance stays intact
        expect(await this.token.balanceOf(reserve.address)).to.be.equal("1111");
        expect(await this.token.balanceOf(this.proxy.address)).to.be.equal("0");
      });
      describe("when receiver is ordinary contract", function () {
        let receiverContract;
        beforeEach(async function () {
          const receiverContractFactory = await ethers.getContractFactory("MockProxyReceiver");
          receiverContract = await receiverContractFactory.deploy();
          await this.token.mint(this.ProxyConsumer.address, "1111");
        });

        it("single-argument uint256 call and pulled tokens", async function () {
          const receiverBalanceBefore = await this.token.balanceOf(receiverContract.address);
          const reserveBalanceBefore = await this.token.balanceOf(reserve.address);
          const callData = receiverContract.interface.encodeFunctionData("setUint256AndPullToken", [
            this.token.address,
            1111,
            12345,
          ]);
          const transferResult = await this.ProxyConsumer.transferToken(
            this.token.address,
            receiverContract.address,
            reserve.address,
            callData,
            {
              value: 1111,
            }
          );
          // check internal tx hit correct function
          expect(await receiverContract.lastHit()).to.be.equal("setUint256AndPullToken");
          // check internal tx was ok and uint256 arg passed and saved successfully
          expect(await receiverContract.result()).to.be.equal("12345");
          const receiverBalanceAfter = await this.token.balanceOf(receiverContract.address);
          const reserveBalanceAfter = await this.token.balanceOf(reserve.address);
          expect(reserveBalanceAfter.sub(reserveBalanceBefore)).to.be.equal("0");
          // transferred balance appeared on receiving contract as expected
          expect(receiverBalanceAfter.sub(receiverBalanceBefore)).to.be.equal("1111");
        });

        it("receiver got data and pulled tokens", async function () {
          const callData = receiverContract.interface.encodeFunctionData("setArrayAndPullToken", [
            this.token.address,
            1111,
            [1, 12, 123, 1234, 12345, 123456, 1234567, 12345678, 123456789, 1234567890],
          ]);
          const receiverBalanceBefore = await this.token.balanceOf(receiverContract.address);
          const reserveBalanceBefore = await this.token.balanceOf(reserve.address);
          const proxyBalance = await this.token.balanceOf(this.proxy.address);
          const transferResult = await this.ProxyConsumer.transferToken(
            this.token.address,
            receiverContract.address,
            reserve.address,
            callData,
            {
              value: 1111,
            }
          );
          // check internal tx hit correct function
          expect(await receiverContract.lastHit()).to.be.equal("setArrayAndPullToken");
          // check internal tx was ok and arguments passed in and saved successfully
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
          expect(await receiverContract.tokensReceived()).to.be.equal("1111");
          const receiverBalanceAfter = await this.token.balanceOf(receiverContract.address);
          const reserveBalanceAfter = await this.token.balanceOf(reserve.address);
          const proxyBalanceAfter = await this.token.balanceOf(this.proxy.address);
          expect(reserveBalanceAfter).to.be.equal(proxyBalance);
          expect(proxyBalanceAfter).to.be.equal("0");
          // transferred balance appeared on receiving contract as expected
          expect(receiverBalanceAfter.sub(receiverBalanceBefore)).to.be.equal("1111");
        });
      });

      describe("when receiver is uniswap", function () {
        beforeEach(async function () {
          const WETH9Artifact = await deployments.getArtifact("WETH9");
          const WETH9Factory = await ethers.getContractFactory(
            WETH9Artifact.abi,
            WETH9Artifact.bytecode
          );
          this.weth = await WETH9Factory.deploy();
          await this.weth.deployed();

          const MockTokenArtifact = await deployments.getArtifact("MockToken");
          const MockTokenFactory = await ethers.getContractFactory(
            MockTokenArtifact.abi,
            MockTokenArtifact.bytecode
          );
          this.token = await MockTokenFactory.deploy("TOKEN", "TOKEN", "18");
          await this.token.deployed();

          const UniswapV2FactoryArtifact = await deployments.getArtifact("UniswapV2Factory");
          const UniswapV2Factory = await ethers.getContractFactory(
            UniswapV2FactoryArtifact.abi,
            UniswapV2FactoryArtifact.bytecode
          );
          this.factory = await UniswapV2Factory.deploy(deployer.address);
          await this.factory.deployed();

          const UniswapV2RouterArtifact = await deployments.getArtifact("UniswapV2Router02");
          const UniswapV2Router = await ethers.getContractFactory(
            UniswapV2RouterArtifact.abi,
            UniswapV2RouterArtifact.bytecode
          );
          this.router = await UniswapV2Router.deploy(this.factory.address, this.weth.address);
          await this.router.deployed();

          const UniswapV2PairArtifact = await deployments.getArtifact("UniswapV2Pair");
          const UniswapV2Pair = await ethers.getContractFactory(
            UniswapV2PairArtifact.abi,
            UniswapV2PairArtifact.bytecode
          );
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

        it("swapTokensForExactTokens", async function () {
          await this.weth.transfer(this.ProxyConsumer.address, 1000);
          const amountOut = await this.router.getAmountsOut(100, [
            this.weth.address,
            this.token.address,
          ]);
          expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal("0");
          const callData = this.router.interface.encodeFunctionData("swapTokensForExactTokens", [
            amountOut[1],
            amountOut[0],
            [this.weth.address, this.token.address],
            tokenHolder.address,
            9999999999,
          ]);
          const transferResult = await this.ProxyConsumer.transferToken(
            this.weth.address,
            this.router.address,
            reserve.address,
            callData,
            {
              value: amountOut[0],
            }
          );
          expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal(amountOut[1]);
          expect(await this.weth.balanceOf(this.proxy.address)).to.be.equal(0);
          expect(await this.weth.balanceOf(reserve.address)).to.be.equal(0);
          expect(await this.weth.balanceOf(this.ProxyConsumer.address)).to.be.equal(900);
        });

        it("swapTokensForExactETH", async function () {
          const tokenHolderBefore = await ethers.provider.getBalance(tokenHolder.address);
          await this.token.transfer(this.ProxyConsumer.address, 1000);
          const amountOut = await this.router.getAmountsOut(100, [
            this.token.address,
            this.weth.address,
          ]);
          expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal("0");
          const callData = this.router.interface.encodeFunctionData("swapTokensForExactETH", [
            amountOut[1],
            parseInt(amountOut[0]) + 500,
            [this.token.address, this.weth.address],
            tokenHolder.address,
            9999999999,
          ]);
          const transferResult = await this.ProxyConsumer.transferToken(
            this.token.address,
            this.router.address,
            reserve.address,
            callData,
            {
              value: parseInt(amountOut[0]) + 500,
            }
          );
          const tokenHolderAfter = await ethers.provider.getBalance(tokenHolder.address);
          expect(tokenHolderAfter.sub(tokenHolderBefore)).to.be.equal(amountOut[1]);
          expect(await this.token.balanceOf(this.proxy.address)).to.be.equal(0);
          expect(await this.token.balanceOf(reserve.address)).to.be.equal(500);
          expect(await this.token.balanceOf(this.ProxyConsumer.address)).to.be.equal(400);
        });

        it("swapExactTokensForETH", async function () {
          const tokenHolderBefore = await ethers.provider.getBalance(tokenHolder.address);
          await this.token.transfer(this.ProxyConsumer.address, 1000);
          const amountOut = await this.router.getAmountsOut(100, [
            this.token.address,
            this.weth.address,
          ]);
          expect(await this.token.balanceOf(tokenHolder.address)).to.be.equal("0");
          const callData = this.router.interface.encodeFunctionData("swapExactTokensForETH", [
            amountOut[0],
            1,
            [this.token.address, this.weth.address],
            tokenHolder.address,
            9999999999,
          ]);
          const transferResult = await this.ProxyConsumer.transferToken(
            this.token.address,
            this.router.address,
            reserve.address,
            callData,
            {
              value: amountOut[0],
            }
          );
          const tokenHolderAfter = await ethers.provider.getBalance(tokenHolder.address);
          expect(tokenHolderAfter.sub(tokenHolderBefore)).to.be.equal(amountOut[1]);
          expect(await this.token.balanceOf(this.proxy.address)).to.be.equal(0);
          expect(await this.token.balanceOf(reserve.address)).to.be.equal(0);
          expect(await this.token.balanceOf(this.ProxyConsumer.address)).to.be.equal(900);
        });
      });
    });
  });
});
