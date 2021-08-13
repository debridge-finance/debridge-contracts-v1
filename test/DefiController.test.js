const { expect } = require("chai");
const { cons } = require("fp-ts/lib/NonEmptyArray2v");
const { ethers } = require("hardhat");
const { ZERO_ADDRESS, DEFAULT_ADMIN_ROLE, WORKER_ROLE } = require("./utils.spec");

describe("DefiController", function () {
  const amount = 100;
  const totalSupplyAmount = amount * 2;
  before(async function () {
    [admin, worker, other] = await ethers.getSigners();
    this.DefiControllerFactory = await ethers.getContractFactory("MockDefiController");
    this.DeBridgeFactory = await ethers.getContractFactory("MockDeBridgeGateForDefiController");
    this.MockTokenFactory = await ethers.getContractFactory("MockToken");
    this.MockStrategyFactory = await ethers.getContractFactory("MockStrategy");
  });

  beforeEach(async function () {
    this.defiController = await upgrades.deployProxy(this.DefiControllerFactory, []);
  });

  it("contract deployer became admin", async function () {
    expect(await this.defiController.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.equal(true);
  });

  it("only admin can setDeBridgeGate", async function () {
    await expect(
      this.defiController.connect(other).setDeBridgeGate(other.address)
    ).to.be.revertedWith("onlyAdmin: bad role");
  });

  describe("with debridgeGate", function () {
    beforeEach(async function () {
      this.debridge = await this.DeBridgeFactory.deploy();
      await this.defiController.setDeBridgeGate(this.debridge.address);
    });

    it("deBridgeGate is correct", async function () {
      expect(this.debridge.address).to.be.equal(await this.defiController.deBridgeGate());
    });

    it("non-worker can't depositToStrategy", async function () {
      await expect(this.defiController.depositToStrategy(amount, ZERO_ADDRESS)).to.be.revertedWith(
        "onlyWorker: bad role"
      );
    });

    it("non-worker can't withdrawFromStrategy", async function () {
      await expect(
        this.defiController.withdrawFromStrategy(amount, ZERO_ADDRESS)
      ).to.be.revertedWith("onlyWorker: bad role");
    });

    describe("with worker added", function () {
      beforeEach(async function () {
        this.result = await this.defiController.addWorker(worker.address);
      });

      it("WORKER_ROLE was assigned to worker", async function () {
        await expect(this.result)
          .to.emit(this.defiController, "RoleGranted")
          .withArgs(WORKER_ROLE, worker.address, admin.address);
        expect(this.defiController.hasRole(WORKER_ROLE, worker.address), true);
      });

      describe("with strategy (inactive)", function () {
        beforeEach(async function () {
          this.strategyNativeToken = await this.MockStrategyFactory.deploy();
          this.strategyStakeToken = await this.MockStrategyFactory.deploy();
        });
        it("depositToStrategy reverts", async function () {
          await expect(
            this.defiController
              .connect(worker)
              .depositToStrategy(amount, this.strategyStakeToken.address)
          ).to.be.revertedWith("strategy is not enabled");
          await expect(
            this.defiController
              .connect(worker)
              .depositToStrategy(amount, this.strategyNativeToken.address)
          ).to.be.revertedWith("strategy is not enabled");
        });

        it("withdrawFromStrategy reverts", async function () {
          await expect(
            this.defiController
              .connect(worker)
              .withdrawFromStrategy(amount, this.strategyStakeToken.address)
          ).to.be.revertedWith("strategy is not enabled");
          await expect(
            this.defiController
              .connect(worker)
              .withdrawFromStrategy(amount, this.strategyNativeToken.address)
          ).to.be.revertedWith("strategy is not enabled");
        });

        describe("then add stakeToken and native strategies", function () {
          const name = "Stake Token";
          const symbol = "STK";
          const decimal = 18;

          beforeEach(async function () {
            this.stakeToken = await this.MockTokenFactory.deploy(name, symbol, decimal);
            await this.defiController.addStrategy(
              this.strategyNativeToken.address,
              false,
              true,
              false,
              ZERO_ADDRESS,
              ZERO_ADDRESS,
              ZERO_ADDRESS,
              0,
              0
            );
            await this.defiController.addStrategy(
              this.strategyStakeToken.address,
              false,
              true,
              false,
              this.stakeToken.address,
              ZERO_ADDRESS,
              ZERO_ADDRESS,
              0,
              0
            );
          });

          describe("mint stakeToken and send native eth on debridge", function () {
            beforeEach(async function () {
              await this.stakeToken.mint(this.debridge.address, totalSupplyAmount);
              await this.debridge.sendETH({ value: totalSupplyAmount });
            });

            it("balanceOf debridge increased", async function () {
              expect(await this.stakeToken.balanceOf(this.debridge.address)).to.be.equal(
                totalSupplyAmount
              );
              expect(await ethers.provider.getBalance(this.debridge.address)).to.be.equal(
                totalSupplyAmount
              );
            });

            it("check funds were deposited to strategy");
            // todo: since DeFi protocols have different interfaces, these tests should be written per strategy

            it("depositToStrategy reverts if called by wrong role", async function () {
              await expect(
                this.defiController
                  .connect(worker)
                  .depositToStrategy(amount, this.strategyStakeToken.address)
              ).to.be.revertedWith("defiController: bad role");
              await expect(
                this.defiController
                  .connect(worker)
                  .depositToStrategy(amount, this.strategyNativeToken.address)
              ).to.be.revertedWith("defiController: bad role");
            });

            describe("add bridges & connect deBridgeGate", function () {
              const chainId = 1;
              const maxAmount = 0;
              const collectedFees = 0;
              const balance = 1000;
              const lockedInStrategies = 0;
              const minReservesBps = 10;
              const chainFee = 0;
              const exist = false;

              beforeEach(async function () {
                await this.debridge.init();
                await this.debridge.addDebridge(
                  this.stakeToken.address,
                  chainId,
                  maxAmount,
                  collectedFees,
                  balance,
                  lockedInStrategies,
                  minReservesBps,
                  chainFee,
                  exist
                );

                await this.debridge.addDebridge(
                  ZERO_ADDRESS,
                  chainId,
                  maxAmount,
                  collectedFees,
                  balance,
                  lockedInStrategies,
                  minReservesBps,
                  chainFee,
                  exist
                );
                await this.debridge.setDefiController(this.defiController.address);
              });
              describe("after deposited native token to strategy", function () {
                beforeEach(async function () {
                  await expect(
                    this.defiController
                      .connect(worker)
                      .depositToStrategy(amount, this.strategyNativeToken.address)
                  ).to.be.reverted;

                  // Error: Transaction reverted: function selector was not recognized and there's no fallback nor receive function
                  // Reason: DefiController can't accept ether
                  // Decision: receive() external payable {  }

                  // Error: VM Exception while processing transaction: reverted with reason string 'Address: call to non-contract'
                  // Reason: DefiController does not have an implementation for accepting a native token
                  // Decision: Add branching to the ERC20 and native token

                  //await this.defiController.connect(worker).depositToStrategy(amount, this.strategyNativeToken.address)
                  // todo: assert token.balanceOf(this.debridge) == 0
                  // todo: assert token.balanceOf(this.strategy) == amount
                });

                it("native tokens transferred to strategy");

                describe("after withdrawn from strategy", function () {
                  beforeEach(async function () {
                    await expect(
                      this.defiController
                        .connect(worker)
                        .withdrawFromStrategy(amount, this.strategyNativeToken.address)
                    ).to.be.reverted;
                    //Error: VM Exception while processing transaction: reverted with reason string 'Address: call to non-contract'
                  });

                  it("tokens transferred from strategy back to deBridgeGate");
                });
              });

              describe("after deposited stake token to strategy", function () {
                beforeEach(async function () {
                  await this.defiController
                    .connect(worker)
                    .depositToStrategy(amount, this.strategyStakeToken.address);
                  // todo: assert token.balanceOf(this.debridge) == 0
                  // todo: assert token.balanceOf(this.strategy) == amount
                });

                // they should be transferred to the strategy, but it is mocked up and its function does not pull tokens
                // and they remain on DefiController
                it("tokens transferred to strategy");
                // todo: expect(await this.stakeToken.balanceOf(this.strategy)).to.be.equal(amount);

                it("the number of tokens owned by the bridge decreases", async function () {
                  expect(await this.stakeToken.balanceOf(this.debridge.address)).to.be.equal(
                    totalSupplyAmount - amount
                  );
                });

                describe("after withdrawn from strategy", function () {
                  beforeEach(async function () {
                    await this.defiController
                      .connect(worker)
                      .withdrawFromStrategy(amount, this.strategyStakeToken.address);
                  });

                  it("tokens transferred from strategy back to deBridgeGate", async function () {
                    expect(await this.stakeToken.balanceOf(this.debridge.address)).to.be.equal(
                      totalSupplyAmount
                    );
                  });
                });
              });
            });
          });
        });
      });

      describe("After worker removal", function () {
        beforeEach(async function () {
          this.result = await this.defiController.removeWorker(worker.address);
        });

        it("WORKER_ROLE was revoked from worker", async function () {
          await expect(this.result)
            .to.emit(this.defiController, "RoleRevoked")
            .withArgs(
              ethers.utils.keccak256(ethers.utils.toUtf8Bytes("WORKER_ROLE")),
              worker.address,
              admin.address
            );
          expect(
            await this.defiController.hasRole(
              ethers.utils.keccak256(ethers.utils.toUtf8Bytes("WORKER_ROL")),
              worker.address
            )
          ).to.be.equal(false);
        });
      });
    });
  });
});
