const { expect } = require("chai");
const { ethers } = require("hardhat");
const { ZERO_ADDRESS } = require("./utils.spec");

describe("DefiController", function () {
  const amount = 100;
  before(async function () {
    [admin, worker, other] = await ethers.getSigners();
  });

  beforeEach(async function () {
    this.DefiControllerFactory = await ethers.getContractFactory("MockDefiController");
    this.defiController = await this.DefiControllerFactory.deploy();
  });

  it("contract deployer became admin");

  it("only admin can addDeBridgeGate", async function () {
    await expect(this.defiController.connect(other).addDeBridgeGate(other.address)).to.be.revertedWith("onlyAdmin: bad role");
  });

  describe("with debridgeGate", function () {
    beforeEach(async function () {
      this.DeBridgeFactory = await ethers.getContractFactory("DeBridgeGate");
      this.debridge = await this.DeBridgeFactory.deploy();
      await this.defiController.addDeBridgeGate(this.debridge.address);
    });

    it("deBridgeGate is correct");

    it("non-worker can't depositToStrategy");

    it("non-worker can't withdrawFromStrategy");

    describe("with worker added", function () {
      beforeEach(async function () {
        this.result = await this.defiController.addWorker(worker.address);
      });

      it("WORKER_ROLE was assigned to worker", async function () {
        await expect(this.result)
          .to.emit(this.defiController, "RoleGranted")
          .withArgs(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("WORKER_ROLE")), worker.address, admin.address);
        expect(this.defiController.hasRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("WORKER_ROLE")), worker.address), true);
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
            "depositToStrategy: strategy is not enabled"
          );
        });

        it("withdrawFromStrategy reverts", async function () {
          await expect(this.defiController.connect(worker).withdrawFromStrategy(amount, this.strategy.address)).to.be.revertedWith(
            "withdrawFromStrategy: strategy is not enabled"
          );
        });

        describe("after strategy enabled", function () {
          beforeEach(async function () {
            await this.defiController.addStrategy(this.strategy.address, true, false, false, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, 0, 0);
          });

          describe("after deposited to strategy", function () {
            beforeEach(async function () {
              // todo: mint token on this.debridge
              // todo: assert token.balanceOf(this.debridge) == amount
              // todo: assert token.balanceOf(this.strategy) == 0
              await this.defiController.connect(worker).depositToStrategy(amount, this.strategy.address);
              // todo: assert token.balanceOf(this.debridge) == 0
              // todo: assert token.balanceOf(this.strategy) == amount
            });

            it("tokens transferred from deBridgeGate to strategy");

            describe("after withdrawn from strategy", function () {
              beforeEach(async function () {
                await this.defiController.connect(worker).withdrawFromStrategy(amount, this.strategy.address);
              });

              it("tokens transferred from strategy back to deBridgeGate");
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
            .withArgs(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("WORKER_ROLE")), worker.address, admin.address);
          expect(await this.defiController.hasRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("WORKER_ROL")), worker.address)).to.be.equal(false);
        });
      });
    });
  });
});
