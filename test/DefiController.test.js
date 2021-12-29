const { expect } = require("chai");
const { cons } = require("fp-ts/lib/NonEmptyArray2v");
const { ethers } = require("hardhat");
const { DEFAULT_ADMIN_ROLE, WORKER_ROLE } = require("./utils.spec");

const ZERO_ADDRESS = ethers.constants.AddressZero;

describe("DefiController", function () {
  const tokenSupply = 1000;
  const nativeTokenSupply = 2000;
  let admin, worker, other;
  before(async function () {
    [admin, worker, other] = await ethers.getSigners();
    this.DefiControllerFactory = await ethers.getContractFactory("MockDefiController");
    this.DeBridgeFactory = await ethers.getContractFactory("MockDeBridgeGateForDefiController");
    this.MockTokenFactory = await ethers.getContractFactory("MockToken");
    this.MockStrategyFactory = await ethers.getContractFactory("MockStrategy");
  });

  beforeEach(async function () {
    this.defiController = await upgrades.deployProxy(this.DefiControllerFactory, []);
    this.BPS_DENOMINATOR = (await this.defiController.BPS_DENOMINATOR()).toNumber();
    this.STRATEGY_RESERVES_DELTA_BPS = (
      await this.defiController.STRATEGY_RESERVES_DELTA_BPS()
    ).toNumber();
  });

  it.skip("contract deployer became admin", async function () {
    expect(await this.defiController.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.equal(true);
  });

  it.skip("only admin can setDeBridgeGate", async function () {
    await expect(
      this.defiController.connect(other).setDeBridgeGate(other.address)
    ).to.be.revertedWith("AdminBadRole()");
  });

  describe.skip("with debridgeGate", function () {
    beforeEach(async function () {
      this.debridge = await this.DeBridgeFactory.deploy();
      await this.defiController.setDeBridgeGate(this.debridge.address);
    });

    it("deBridgeGate is correct", async function () {
      expect(this.debridge.address).to.be.equal(await this.defiController.deBridgeGate());
    });

    it("non-worker can't rebalanceStrategy", async function () {
      await expect(this.defiController.rebalanceStrategy(ZERO_ADDRESS)).to.be.revertedWith(
        "WorkerBadRole()"
      );
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

        it("rebalanceStrategy for native token reverts if it's not enabled", async function () {
          await expect(
            this.defiController.connect(worker).rebalanceStrategy(this.strategyNativeToken.address)
          ).to.be.revertedWith("StrategyNotFound");
        });

        it("rebalanceStrategy for stake token reverts if it's not enabled", async function () {
          await expect(
            this.defiController.connect(worker).rebalanceStrategy(this.strategyStakeToken.address)
          ).to.be.revertedWith("StrategyNotFound");
        });

        describe("then add stakeToken and native strategies", function () {
          const name = "Stake Token";
          const symbol = "STK";
          const decimal = 18;
          const nativeTokenStrategyMaxReservesBps = 7000; // 70%
          const stakeTokenStrategyMaxReservesBps = 2000; // 20%
          const otherStrategyMaxReservesBps = 1000; // 10%

          beforeEach(async function () {
            this.stakeToken = await this.MockTokenFactory.deploy(name, symbol, decimal);
            await this.defiController.addStrategy(
              this.strategyNativeToken.address,
              true,
              nativeTokenStrategyMaxReservesBps,
              ZERO_ADDRESS,
              ZERO_ADDRESS
            );
            await this.defiController.addStrategy(
              this.strategyStakeToken.address,
              true,
              stakeTokenStrategyMaxReservesBps,
              this.stakeToken.address,
              ZERO_ADDRESS
            );
          });

          it("only admin can adding strategy", async function () {
            await expect(
              this.defiController
                .connect(worker)
                .addStrategy(
                  this.strategyStakeToken.address,
                  true,
                  0,
                  this.stakeToken.address,
                  ZERO_ADDRESS
                )
            ).to.be.revertedWith("AdminBadRole()");

            await expect(
              this.defiController
                .connect(other)
                .addStrategy(this.strategyNativeToken.address, true, 0, ZERO_ADDRESS, ZERO_ADDRESS)
            ).to.be.revertedWith("AdminBadRole()");
          });

          it("should revert adding strategy if it's already exists", async function () {
            await expect(
              this.defiController.addStrategy(
                this.strategyStakeToken.address,
                true,
                stakeTokenStrategyMaxReservesBps,
                this.stakeToken.address,
                ZERO_ADDRESS
              )
            ).to.be.revertedWith("StrategyAlreadyExists");
          });

          it("should revert adding strategy with invalid maxReservesBps", async function () {
            const token = await this.MockTokenFactory.deploy("Test Token", "TEST", 18);
            const strategy = await this.MockStrategyFactory.deploy();
            await expect(
              this.defiController.addStrategy(
                strategy.address,
                true,
                this.STRATEGY_RESERVES_DELTA_BPS / 2,
                token.address,
                ZERO_ADDRESS
              )
            ).to.be.revertedWith("InvalidMaxReservesBps");

            await expect(
              this.defiController.addStrategy(
                strategy.address,
                true,
                this.BPS_DENOMINATOR + 1,
                token.address,
                ZERO_ADDRESS
              )
            ).to.be.revertedWith("InvalidMaxReservesBps");
          });

          it("should revert adding strategy with invalid total maxReservesBps", async function () {
            const strategy = await this.MockStrategyFactory.deploy();
            const invalidMaxReservesBps =
              this.BPS_DENOMINATOR - stakeTokenStrategyMaxReservesBps + 1;
            await expect(
              this.defiController.addStrategy(
                strategy.address,
                true,
                invalidMaxReservesBps,
                this.stakeToken.address,
                ZERO_ADDRESS
              )
            ).to.be.revertedWith("InvalidTotalMaxReservesBps");
          });

          it("should revert updating strategy with invalid total maxReservesBps", async function () {
            // try to set invalid maxReservesBps for enabled strategy, should revert
            const invalidNewMaxReservesBps = this.BPS_DENOMINATOR + 1;
            await expect(
              this.defiController.updateStrategy(
                this.strategyNativeToken.address,
                true,
                invalidNewMaxReservesBps
              )
            ).to.be.revertedWith("InvalidTotalMaxReservesBps");

            // disable strategy and set invalid maxReservesBps, should not revert
            await expect(
              this.defiController.updateStrategy(
                this.strategyNativeToken.address,
                false,
                invalidNewMaxReservesBps
              )
            ).to.be.not.revertedWith("InvalidTotalMaxReservesBps");

            // enable strategy with invalid maxReservesBps, should revert
            await expect(
              this.defiController.updateStrategy(
                this.strategyNativeToken.address,
                true,
                invalidNewMaxReservesBps
              )
            ).to.be.revertedWith("InvalidTotalMaxReservesBps");
          });

          it("check correct values in strategy", async function () {
            const strategyFromContract = await this.defiController.strategies(
              this.strategyNativeToken.address
            );
            expect(true).to.be.equal(strategyFromContract.exists);
            expect(true).to.be.equal(strategyFromContract.isEnabled);
            expect(nativeTokenStrategyMaxReservesBps).to.be.equal(
              strategyFromContract.maxReservesBps
            );
            //TODO: check for non ZERO_ADDRESS
            expect(ZERO_ADDRESS).to.be.equal(strategyFromContract.stakeToken);
            expect(ZERO_ADDRESS).to.be.equal(strategyFromContract.strategyToken);
          });

          it("only admin can update strategy", async function () {
            await expect(
              this.defiController
                .connect(other)
                .updateStrategy(this.strategyNativeToken.address, false, 0)
            ).to.be.revertedWith("AdminBadRole()");
          });

          it("should update strategy by admin", async function () {
            await this.defiController.updateStrategy(this.strategyNativeToken.address, false, 10);

            const strategyFromContract = await this.defiController.strategies(
              this.strategyNativeToken.address
            );
            expect(true).to.be.equal(strategyFromContract.exists);
            expect(false).to.be.equal(strategyFromContract.isEnabled);
            expect(10).to.be.equal(strategyFromContract.maxReservesBps);
            //TODO: check for non ZERO_ADDRESS
            expect(ZERO_ADDRESS).to.be.equal(strategyFromContract.stakeToken);
            expect(ZERO_ADDRESS).to.be.equal(strategyFromContract.strategyToken);
          });

          describe("mint stakeToken and send native eth on debridge", function () {
            beforeEach(async function () {
              await this.stakeToken.mint(this.debridge.address, tokenSupply);
              await this.debridge.sendETH({ value: nativeTokenSupply });
            });

            it("balanceOf debridge increased", async function () {
              expect(await this.stakeToken.balanceOf(this.debridge.address)).to.be.equal(
                tokenSupply
              );
              expect(await ethers.provider.getBalance(this.debridge.address)).to.be.equal(
                nativeTokenSupply
              );
            });

            it("rebalanceStrategy reverts if called by wrong role", async function () {
              await expect(
                this.defiController
                  .connect(other)
                  .rebalanceStrategy(this.strategyStakeToken.address)
              ).to.be.revertedWith("WorkerBadRole()");
              await expect(
                this.defiController
                  .connect(other)
                  .rebalanceStrategy(this.strategyNativeToken.address)
              ).to.be.revertedWith("WorkerBadRole()");
            });

            describe("add bridges & connect deBridgeGate", function () {
              const chainId = 1;
              const maxAmount = 0;
              const collectedFees = 0;
              const balance = 1000;
              const lockedInStrategies = 0;
              const minReservesBps = 1000;
              const chainFee = 0;
              const exist = true;

              let token, strategyToken, strategy;

              beforeEach(async function () {
                token = await this.MockTokenFactory.deploy("Test Token", "TEST", 18);
                strategyToken = await this.MockTokenFactory.deploy("Strategy Token", "STEST", 18);
                strategy = await this.MockStrategyFactory.deploy();

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

              it("rebalanceStrategy should do nothing if there is no avaliable reserves and strategy doesn't have reserves", async function () {
                await this.defiController.addStrategy(
                  strategy.address,
                  true,
                  otherStrategyMaxReservesBps,
                  token.address,
                  strategyToken.address
                );

                // add debridge with zero balance
                await this.debridge.addDebridge(
                  token.address,
                  chainId,
                  maxAmount,
                  0,
                  0,
                  0,
                  minReservesBps,
                  chainFee,
                  true
                );

                // avaliableReserves == 0
                expect(await this.debridge.getDefiAvaliableReserves(token.address)).to.be.equal(0);

                // currentReserves == 0
                expect(
                  await strategy.updateReserves(this.defiController.address, strategyToken.address)
                ).to.be.equal(0);

                expect(
                  await this.defiController.connect(worker).isStrategyUnbalanced(strategy.address)
                ).to.be.eql([ethers.BigNumber.from(0), false]);

                // test rebalanceStrategy
                await expect(
                  this.defiController.connect(worker).rebalanceStrategy(strategy.address)
                )
                  .to.not.emit(this.defiController, "WithdrawFromStrategy")
                  .and.not.emit(this.defiController, "DepositToStrategy");

                // still currentReserves == 0
                expect(
                  await strategy.updateReserves(this.defiController.address, strategyToken.address)
                ).to.be.equal(0);
              });

              it("rebalanceStrategy should do nothing if maxReservesBps equals to zero and strategy doesn't have reserves", async function () {
                // add strategy with maxReservesBps = 0
                await this.defiController.addStrategy(
                  strategy.address,
                  true,
                  0,
                  token.address,
                  strategyToken.address
                );

                // add debridge with non zero balance
                await this.debridge.addDebridge(
                  token.address,
                  chainId,
                  maxAmount,
                  0,
                  1000,
                  0,
                  minReservesBps,
                  chainFee,
                  true
                );

                // avaliableReserves > 0
                expect(await this.debridge.getDefiAvaliableReserves(token.address)).to.be.not.equal(
                  0
                );

                // currentReserves == 0
                expect(
                  await strategy.updateReserves(this.defiController.address, strategyToken.address)
                ).to.be.equal(0);

                expect(
                  await this.defiController.connect(worker).isStrategyUnbalanced(strategy.address)
                ).to.be.eql([ethers.BigNumber.from(0), false]);

                // test rebalanceStrategy
                await expect(
                  this.defiController.connect(worker).rebalanceStrategy(strategy.address)
                )
                  .to.not.emit(this.defiController, "WithdrawFromStrategy")
                  .and.not.emit(this.defiController, "DepositToStrategy");

                // still currentReserves == 0
                expect(
                  await strategy.updateReserves(this.defiController.address, strategyToken.address)
                ).to.be.equal(0);
              });

              it("rebalanceStrategy should do nothing if strategy is disabled and doesn't have reserves", async function () {
                // add disabled strategy
                await this.defiController.addStrategy(
                  strategy.address,
                  false,
                  otherStrategyMaxReservesBps,
                  token.address,
                  strategyToken.address
                );

                // add debridge with non zero balance
                await this.debridge.addDebridge(
                  token.address,
                  chainId,
                  maxAmount,
                  0,
                  1000,
                  0,
                  minReservesBps,
                  chainFee,
                  true
                );

                // avaliableReserves > 0
                expect(await this.debridge.getDefiAvaliableReserves(token.address)).to.be.not.equal(
                  0
                );

                // currentReserves == 0
                expect(
                  await strategy.updateReserves(this.defiController.address, strategyToken.address)
                ).to.be.equal(0);

                expect(
                  await this.defiController.connect(worker).isStrategyUnbalanced(strategy.address)
                ).to.be.eql([ethers.BigNumber.from(0), false]);

                // test rebalanceStrategy
                await expect(
                  this.defiController.connect(worker).rebalanceStrategy(strategy.address)
                )
                  .to.not.emit(this.defiController, "WithdrawFromStrategy")
                  .and.not.emit(this.defiController, "DepositToStrategy");

                // still currentReserves == 0
                expect(
                  await strategy.updateReserves(this.defiController.address, strategyToken.address)
                ).to.be.equal(0);
              });

              describe("After strategies rebalanced", async function () {
                // TODO: add tests for native token strategies

                let stakeTokenAvaliableReserves;
                let strategyStakeTokenOptimalReserves;

                beforeEach(async function () {
                  stakeTokenAvaliableReserves = await this.debridge.getDefiAvaliableReserves(
                    this.stakeToken.address
                  );

                  strategyStakeTokenOptimalReserves = stakeTokenAvaliableReserves
                    .mul(stakeTokenStrategyMaxReservesBps - this.STRATEGY_RESERVES_DELTA_BPS / 2)
                    .div(this.BPS_DENOMINATOR);

                  expect(
                    await this.defiController
                      .connect(worker)
                      .isStrategyUnbalanced(this.strategyStakeToken.address)
                  ).to.be.eql([strategyStakeTokenOptimalReserves, true]);

                  await expect(
                    this.defiController
                      .connect(worker)
                      .rebalanceStrategy(this.strategyStakeToken.address)
                  )
                    .to.emit(this.defiController, "DepositToStrategy")
                    .withArgs(this.strategyStakeToken.address, strategyStakeTokenOptimalReserves);
                });

                it("strategy reserves should be optimal", async function () {
                  expect(
                    await this.strategyStakeToken.updateReserves(
                      this.defiController.address,
                      strategyToken.address
                    )
                  ).to.be.equal(strategyStakeTokenOptimalReserves);
                });

                it("rebalanceStrategy should do nothing if strategy reserves are optimal", async function () {
                  expect(
                    await this.defiController
                      .connect(worker)
                      .isStrategyUnbalanced(this.strategyStakeToken.address)
                  ).to.be.eql([ethers.BigNumber.from(0), false]);

                  await expect(
                    this.defiController
                      .connect(worker)
                      .rebalanceStrategy(this.strategyStakeToken.address)
                  )
                    .to.not.emit(this.defiController, "DepositToStrategy")
                    .and.not.emit(this.defiController, "WithdrawFromStrategy");
                });

                it("rebalanceStrategy should do nothing if strategy reserves in STRATEGY_RESERVES_DELTA_BPS", async function () {
                  const newStakeTokenStrategyMaxReservesBps = stakeTokenStrategyMaxReservesBps - 1;
                  await this.defiController.updateStrategy(
                    this.strategyStakeToken.address,
                    true,
                    newStakeTokenStrategyMaxReservesBps
                  );

                  const newStrategyStakeTokenOptimalReserves = stakeTokenAvaliableReserves
                    .mul(newStakeTokenStrategyMaxReservesBps - this.STRATEGY_RESERVES_DELTA_BPS / 2)
                    .div(this.BPS_DENOMINATOR);
                  const delta = strategyStakeTokenOptimalReserves.sub(
                    newStrategyStakeTokenOptimalReserves
                  );

                  expect(delta.lt(this.STRATEGY_RESERVES_DELTA_BPS)).to.be.equal(true);

                  expect(
                    await this.defiController
                      .connect(worker)
                      .isStrategyUnbalanced(this.strategyStakeToken.address)
                  ).to.be.eql([ethers.BigNumber.from(0), false]);

                  await expect(
                    this.defiController
                      .connect(worker)
                      .rebalanceStrategy(this.strategyStakeToken.address)
                  )
                    .to.not.emit(this.defiController, "DepositToStrategy")
                    .and.not.emit(this.defiController, "WithdrawFromStrategy");
                });

                it("rebalanceStrategy should deposit if strategy reserves are less than optimal", async function () {
                  // divide stakeTokenStrategyMaxReservesBps by 4 and rebalance strategy again
                  const newStakeTokenStrategyMaxReservesBps = stakeTokenStrategyMaxReservesBps / 4;
                  await this.defiController.updateStrategy(
                    this.strategyStakeToken.address,
                    true,
                    newStakeTokenStrategyMaxReservesBps
                  );

                  const newStrategyStakeTokenOptimalReserves = stakeTokenAvaliableReserves
                    .mul(newStakeTokenStrategyMaxReservesBps - this.STRATEGY_RESERVES_DELTA_BPS / 2)
                    .div(this.BPS_DENOMINATOR);
                  const delta = strategyStakeTokenOptimalReserves.sub(
                    newStrategyStakeTokenOptimalReserves
                  );

                  expect(
                    await this.defiController
                      .connect(worker)
                      .isStrategyUnbalanced(this.strategyStakeToken.address)
                  ).to.be.eql([delta, false]);

                  await expect(
                    this.defiController
                      .connect(worker)
                      .rebalanceStrategy(this.strategyStakeToken.address)
                  )
                    .to.emit(this.defiController, "WithdrawFromStrategy")
                    .withArgs(this.strategyStakeToken.address, delta);

                  expect(
                    await this.strategyStakeToken.updateReserves(
                      this.defiController.address,
                      strategyToken.address
                    )
                  ).to.be.equal(newStrategyStakeTokenOptimalReserves);
                });

                it("rebalanceStrategy should withdraw if strategy reserves are more than optimal", async function () {
                  // increase stakeTokenStrategyMaxReservesBps and rebalance strategy again
                  const newStakeTokenStrategyMaxReservesBps =
                    stakeTokenStrategyMaxReservesBps + otherStrategyMaxReservesBps;
                  await this.defiController.updateStrategy(
                    this.strategyStakeToken.address,
                    true,
                    newStakeTokenStrategyMaxReservesBps
                  );

                  const newStrategyStakeTokenOptimalReserves = stakeTokenAvaliableReserves
                    .mul(newStakeTokenStrategyMaxReservesBps - this.STRATEGY_RESERVES_DELTA_BPS / 2)
                    .div(this.BPS_DENOMINATOR);
                  const delta = newStrategyStakeTokenOptimalReserves.sub(
                    strategyStakeTokenOptimalReserves
                  );

                  expect(
                    await this.defiController
                      .connect(worker)
                      .isStrategyUnbalanced(this.strategyStakeToken.address)
                  ).to.be.eql([delta, true]);

                  await expect(
                    this.defiController
                      .connect(worker)
                      .rebalanceStrategy(this.strategyStakeToken.address)
                  )
                    .to.emit(this.defiController, "DepositToStrategy")
                    .withArgs(this.strategyStakeToken.address, delta);

                  expect(
                    await this.strategyStakeToken.updateReserves(
                      this.defiController.address,
                      strategyToken.address
                    )
                  ).to.be.equal(newStrategyStakeTokenOptimalReserves);
                });

                it("rebalanceStrategy should withdraw all if maxReservesBps equals to zero and strategy have reserves", async function () {
                  // set strategy's maxReservesBps to 0
                  await this.defiController.updateStrategy(
                    this.strategyStakeToken.address,
                    true,
                    0
                  );

                  expect(
                    await this.defiController
                      .connect(worker)
                      .isStrategyUnbalanced(this.strategyStakeToken.address)
                  ).to.be.eql([strategyStakeTokenOptimalReserves, false]);

                  // rebalance strategy
                  await expect(
                    this.defiController
                      .connect(worker)
                      .rebalanceStrategy(this.strategyStakeToken.address)
                  )
                    .to.emit(this.defiController, "WithdrawFromStrategy")
                    .withArgs(this.strategyStakeToken.address, strategyStakeTokenOptimalReserves);

                  // strategy balance should be 0
                  expect(
                    await this.strategyStakeToken.updateReserves(
                      this.defiController.address,
                      strategyToken.address
                    )
                  ).to.be.equal(0);
                });

                it("rebalanceStrategy should withdraw all if avaliableReserves equals to zero and strategy have reserves", async function () {
                  // set debridge's _minReservesBps to 100%
                  const debridgeId = await this.debridge.getDebridgeId(
                    chainId,
                    this.stakeToken.address
                  );
                  await this.debridge.updateAsset(debridgeId, 0, this.BPS_DENOMINATOR, 0);

                  expect(
                    await this.defiController
                      .connect(worker)
                      .isStrategyUnbalanced(this.strategyStakeToken.address)
                  ).to.be.eql([strategyStakeTokenOptimalReserves, false]);

                  // rebalance strategy
                  await expect(
                    this.defiController
                      .connect(worker)
                      .rebalanceStrategy(this.strategyStakeToken.address)
                  )
                    .to.emit(this.defiController, "WithdrawFromStrategy")
                    .withArgs(this.strategyStakeToken.address, strategyStakeTokenOptimalReserves);

                  // strategy balance should be 0
                  expect(
                    await this.strategyStakeToken.updateReserves(
                      this.defiController.address,
                      strategyToken.address
                    )
                  ).to.be.equal(0);
                });

                it("rebalanceStrategy should withdraw all if strategy disabled and it has reserves", async function () {
                  // disable strategy
                  await this.defiController.updateStrategy(
                    this.strategyStakeToken.address,
                    false,
                    stakeTokenStrategyMaxReservesBps
                  );

                  expect(
                    await this.defiController
                      .connect(worker)
                      .isStrategyUnbalanced(this.strategyStakeToken.address)
                  ).to.be.eql([strategyStakeTokenOptimalReserves, false]);

                  // rebalance strategy
                  await expect(
                    this.defiController
                      .connect(worker)
                      .rebalanceStrategy(this.strategyStakeToken.address)
                  )
                    .to.emit(this.defiController, "WithdrawFromStrategy")
                    .withArgs(this.strategyStakeToken.address, strategyStakeTokenOptimalReserves);

                  // strategy balance should be 0
                  expect(
                    await this.strategyStakeToken.updateReserves(
                      this.defiController.address,
                      strategyToken.address
                    )
                  ).to.be.equal(0);
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
              ethers.utils.keccak256(ethers.utils.toUtf8Bytes("WORKER_ROLE")),
              worker.address
            )
          ).to.be.equal(false);
        });

        it("rebalanceStrategy reverts if called by worker after it's role was revoked", async function () {
          await expect(
            this.defiController.connect(worker).rebalanceStrategy(ZERO_ADDRESS)
          ).to.be.revertedWith("WorkerBadRole()");
          await expect(
            this.defiController.connect(worker).rebalanceStrategy(ZERO_ADDRESS)
          ).to.be.revertedWith("WorkerBadRole()");
        });
      });
    });
  });
});
