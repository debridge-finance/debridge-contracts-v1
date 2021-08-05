const { expect } = require("chai");
const { ethers } = require("hardhat");
const { ZERO_ADDRESS, DEFAULT_ADMIN_ROLE, WORKER_ROLE } = require("./utils.spec");

describe("DefiController", function () {
  const amount = 100;
  before(async function () {
    [admin, worker, other] = await ethers.getSigners();
  });

  beforeEach(async function () {
    const DefiControllerFactory = await ethers.getContractFactory("MockDefiController");
    this.defiController = await upgrades.deployProxy(DefiControllerFactory, []);
  });

  it("contract deployer became admin", async function () {
    expect(await this.defiController.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.equal(true);
  });

  it("only admin can addDeBridgeGate", async function () {
    await expect(this.defiController.connect(other).addDeBridgeGate(other.address)).to.be.revertedWith("onlyAdmin: bad role");
  });

  describe("with debridgeGate", function () {
    beforeEach(async function () {
      this.DeBridgeFactory = await ethers.getContractFactory("MockDeBridgeGateForDefiController");
      this.debridge = await this.DeBridgeFactory.deploy();
      await this.defiController.addDeBridgeGate(this.debridge.address);
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
      await expect(this.defiController.withdrawFromStrategy(amount, ZERO_ADDRESS)).to.be.revertedWith(
        "onlyWorker: bad role"
      );
    });

    describe("with worker added", function () {
      beforeEach(async function () {
        this.result = await this.defiController.addWorker(worker.address);
      });

      it("WORKER_ROLE was assigned to worker", async function () {
        await expect(this.result)
          .to.emit(this.defiController, "RoleGranted").withArgs(WORKER_ROLE, worker.address, admin.address);
        expect(this.defiController.hasRole(WORKER_ROLE, worker.address), true);
      });

      describe("with strategy (inactive)", function () {
        beforeEach(async function () {
          this.MockStrategyFactory = await ethers.getContractFactory("MockStrategy");
          this.strategy = await this.MockStrategyFactory.deploy();

          // toDo deploy token

          await this.defiController.addStrategy(this.strategy.address, false, false, false, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, 0, 0);
        });

        it("depositToStrategy reverts", async function () {
          await expect(this.defiController.connect(worker).depositToStrategy(amount, this.strategy.address)).to.be.revertedWith(
            "strategy is not enabled"
          );
        });

        it("withdrawFromStrategy reverts", async function () {
          await expect(this.defiController.connect(worker).withdrawFromStrategy(amount, this.strategy.address)).to.be.revertedWith(
            "strategy is not enabled"
          );
        });

        describe("after strategy enabled", function () {
          const name = "FAKE";
          const symbol = "FAKE";
          const decimal = 18;

          beforeEach(async function () {
            this.MockTokenFactory = await ethers.getContractFactory("MockToken");
            this.stakeToken = await this.MockTokenFactory.deploy(name, symbol, decimal);
            await this.defiController.addStrategy(
                    this.strategy.address, false, true, false, this.stakeToken.address, ZERO_ADDRESS, ZERO_ADDRESS, 0, 0
                  );
          });

          describe("before deposited to strategy", function () {
            beforeEach(async function () {
              await this.stakeToken.mint(this.debridge.address, amount);
            });

            it("check balanceOf debridge", async function () {
              expect(await this.stakeToken.balanceOf(this.debridge.address)).to.be.equal(amount);
            });

//            // todo need to implement deposit/balanceOf methods on strategy contract
//            it("check balanceOf strategy", async function () {
//              expect(await this.strategy.balanceOf(this.stakeToken.address)).to.be.equal(0);
//            });

            it("depositToStrategy reverts", async function () {
              await expect(this.defiController.connect(worker).depositToStrategy(amount, this.strategy.address)).to.be.revertedWith(
                "defiController: bad role"
              );
            });

            describe("add defiController to deBridgeGate", function () {

              const chainId = 1;
              const maxAmount = 0;
              const collectedFees = 0;
              const balance = 0;
              const lockedInStrategies = 0;
              const minReservesBps = 0;
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
                await this.debridge.setDefiController(this.defiController.address);
              });

              describe("after deposited to strategy", function () {
                beforeEach(async function () {
                  await this.defiController.connect(worker).depositToStrategy(amount, this.strategy.address);

                  //Error: VM Exception while processing transaction: reverted with reason string 'requestReserves: not enough reserves'

                  // todo: assert token.balanceOf(this.debridge) == 0
                  // todo: assert token.balanceOf(this.strategy) == amount
                });

                it("tokens transferred to defiController", async function () {
                  expect(await this.stakeToken.balanceOf(this.defiController.address)).to.be.equal(amount);
                });

                describe("after withdrawn from strategy", function () {
                  beforeEach(async function () {
                    await this.defiController.connect(worker).withdrawFromStrategy(amount, this.strategy.address);
                  });

                  it("tokens transferred from strategy back to deBridgeGate");
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
            .withArgs(WORKER_ROLE, worker.address, admin.address);
          expect(await this.defiController.hasRole(WORKER_ROLE, worker.address)).to.be.equal(false);
        });
      });
    });
  });
});
