const { expect } = require("chai");
const { cons } = require("fp-ts/lib/NonEmptyArray2v");
const { ethers } = require("hardhat");
const { ZERO_ADDRESS, DEFAULT_ADMIN_ROLE, WORKER_ROLE } = require("./utils.spec");

describe("DefiController", function () {
  const amount = 100;
  const totalSupplyAmount = amount * 2;
  const rewardAmount=1;
  const badRewardAmount=rewardAmount+amount/2
  before(async function () {
    [admin, worker, other] = await ethers.getSigners();
    this.DefiControllerFactory = await ethers.getContractFactory("MockDefiController");
    this.DeBridgeFactory = await ethers.getContractFactory("MockDeBridgeGateForDefiController");
    this.MockTokenFactory = await ethers.getContractFactory("MockToken");
    this.StrategyFactory = await ethers.getContractFactory("MockStrategy");
    this.BadStrategyFactory = await ethers.getContractFactory("BadMockStrategy");
  });

  beforeEach(async function () {
    this.defiController = await upgrades.deployProxy(this.DefiControllerFactory, []);
  });

  it("contract deployer became admin", async function () {
    expect(await this.defiController.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.equal(true);
  });

  it("only admin can addDeBridgeGate", async function () {
    await expect(
      this.defiController.connect(other).addDeBridgeGate(other.address)
    ).to.be.revertedWith("onlyAdmin: bad role");
  });

  describe("with debridgeGate", function () {
    beforeEach(async function () {
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
          this.strategyNativeToken = await this.StrategyFactory.deploy(this.defiController.address);
          this.strategyStakeToken = await this.StrategyFactory.deploy(this.defiController.address);
          this.badStrategyNativeToken = await this.BadStrategyFactory.deploy(this.defiController.address);
          this.badStrategyStakeToken = await this.BadStrategyFactory.deploy(this.defiController.address);
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
          await expect(
            this.defiController
              .connect(worker)
              .depositToStrategy(amount, this.badStrategyNativeToken.address)
          ).to.be.revertedWith("strategy is not enabled");
          await expect(
            this.defiController
              .connect(worker)
              .depositToStrategy(amount, this.badStrategyStakeToken.address)
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
          await expect(
            this.defiController
              .connect(worker)
              .withdrawFromStrategy(amount, this.badStrategyNativeToken.address)
          ).to.be.revertedWith("strategy is not enabled");
          await expect(
            this.defiController
              .connect(worker)
              .withdrawFromStrategy(amount, this.badStrategyStakeToken.address)
          ).to.be.revertedWith("strategy is not enabled");
        });

        describe("then add strategy for native token", function () {
          beforeEach(async function () {
            await this.defiController.addStrategy(
              this.strategyNativeToken.address,
              true,
              ZERO_ADDRESS,
              0,
            );
          });

          describe("mint send native eth on debridge & reward on strategy", function () {
            beforeEach(async function () {
              await this.debridge.sendETH({ value: totalSupplyAmount });
              await this.strategyNativeToken.sendETH({value:rewardAmount});
            });

            it("balance native eth debridge increased", async function () {
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

                describe("after withdraw from strategy", function () {
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

                describe("after withdrawAll from strategy", function () {
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
            });
          });
        });

        describe("then add bad strategy for native token", function () {
          beforeEach(async function () {
            await this.defiController.addStrategy(
              this.badStrategyNativeToken.address,
              true,
              ZERO_ADDRESS,
              0,
            );
          });

          describe("mint send native eth on debridge & reward on strategy", function () {
            beforeEach(async function () {
              await this.debridge.sendETH({ value: totalSupplyAmount });
              await this.badStrategyNativeToken.sendETH({value:badRewardAmount});
            });

            it("balance native eth debridge increased", async function () {
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
                  .depositToStrategy(amount, this.badStrategyNativeToken.address)
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
              describe("after deposited native token to bad strategy", function () {
                beforeEach(async function () {
                  await expect(
                    this.defiController
                      .connect(worker)
                      .depositToStrategy(amount, this.badStrategyNativeToken.address)
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

                it("native tokens transferred to bad strategy");

                describe("after withdraw from bad strategy", function () {
                  beforeEach(async function () {
                    await expect(
                      this.defiController
                        .connect(worker)
                        .withdrawFromStrategy(amount, this.badStrategyNativeToken.address)
                    ).to.be.reverted;
                    //Error: VM Exception while processing transaction: reverted with reason string 'Address: call to non-contract'
                  });

                  it("tokens transferred from strategy back to deBridgeGate");
                  it("admin can transferLostTokens");
                  it("should reject transferLostTokens if called by the non-admin");
                });

                describe("after withdrawAll from bad strategy", function () {
                  beforeEach(async function () {
                    await expect(
                      this.defiController
                        .connect(worker)
                        .withdrawFromStrategy(amount, this.badStrategyNativeToken.address)
                    ).to.be.reverted;
                    //Error: VM Exception while processing transaction: reverted with reason string 'Address: call to non-contract'
                  });

                  it("tokens transferred from strategy back to deBridgeGate");
                  it("lost tokens remain on DefiController");
                  it("admin can transferLostTokens");
                  it("should reject transferLostTokens if called by the non-admin");
                });
              });
            });
          });
        });

        describe("then add strategy for stake token", function () {
          const name = "Stake Token";
          const symbol = "STK";
          const decimal = 18;

          beforeEach(async function () {
            this.stakeToken = await this.MockTokenFactory.deploy(name, symbol, decimal);
            await this.defiController.addStrategy(
              this.strategyStakeToken.address,
              true,
              this.stakeToken.address,
              0,
            );
          });

          describe("mint stakeToken on debridge & reward on strategy", function () {
            beforeEach(async function () {
              await this.stakeToken.mint(this.debridge.address, totalSupplyAmount);
              await this.stakeToken.mint(this.strategyStakeToken.address, rewardAmount);
            });

            it("balanceOf stake token debridge increased", async function () {
              expect(await this.stakeToken.balanceOf(this.debridge.address)).to.be.equal(
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
                await this.debridge.setDefiController(this.defiController.address);
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
                it("tokens transferred to strategy", async function(){
                  expect(await this.stakeToken.balanceOf(this.strategyStakeToken.address)).to.be.equal(amount+rewardAmount);
                })
                it("the number of tokens owned by the bridge decreases", async function () {
                  expect(await this.stakeToken.balanceOf(this.debridge.address)).to.be.equal(
                    totalSupplyAmount - amount
                  );
                });

                describe("after withdrawAll from strategy", function () {
                  beforeEach(async function () {
                    await this.defiController
                      .connect(worker)
                      .withdrawAllFromStrategy(this.strategyStakeToken.address);
                  });

                  it("tokens transferred from strategy back to deBridgeGate", async function () {
                    expect(await this.stakeToken.balanceOf(this.debridge.address)).to.be.equal(
                      totalSupplyAmount
                    );
                  });
                });

                describe("after withdraw from strategy", function () {
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

        describe("then add bad strategy for stake token", function () {
          const name = "Stake Token";
          const symbol = "STK";
          const decimal = 18;

          beforeEach(async function () {
            this.stakeToken = await this.MockTokenFactory.deploy(name, symbol, decimal);
            await this.defiController.addStrategy(
              this.badStrategyStakeToken.address,
              true,
              this.stakeToken.address,
              0,
            );
          });

          describe("mint stakeToken on debridge & reward on bad strategy", function () {
            beforeEach(async function () {
              await this.stakeToken.mint(this.debridge.address, totalSupplyAmount);
              await this.stakeToken.mint(this.badStrategyStakeToken.address, badRewardAmount);
            });

            it("balanceOf stake token debridge increased", async function () {
              expect(await this.stakeToken.balanceOf(this.debridge.address)).to.be.equal(
                totalSupplyAmount
              );
            });

            it("check funds were deposited to strategy");
            // todo: since DeFi protocols have different interfaces, these tests should be written per strategy

            it("depositToStrategy reverts if called by wrong role", async function () {
              await expect(
                this.defiController
                  .connect(worker)
                  .depositToStrategy(amount, this.badStrategyStakeToken.address)
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
                await this.debridge.setDefiController(this.defiController.address);
              });
              describe("after deposited stake token to bad strategy", function () {
                beforeEach(async function () {
                  await this.defiController
                    .connect(worker)
                    .depositToStrategy(amount, this.badStrategyStakeToken.address);
                  // todo: assert token.balanceOf(this.debridge) == 0
                  // todo: assert token.balanceOf(this.strategy) == amount
                });

                // they should be transferred to the strategy, but it is mocked up and its function does not pull tokens
                // and they remain on DefiController
                it("tokens transferred to strategy", async function(){
                  expect(await this.stakeToken.balanceOf(this.badStrategyStakeToken.address)).to.be.equal(amount+badRewardAmount);
                })
                it("the number of tokens owned by the bridge decreases", async function () {
                  expect(await this.stakeToken.balanceOf(this.debridge.address)).to.be.equal(
                    totalSupplyAmount - amount
                  );
                });

                describe("after withdrawAll from strategy", function () {
                  beforeEach(async function () {
                    await this.defiController
                      .connect(worker)
                      .withdrawAllFromStrategy(this.badStrategyStakeToken.address);
                  });

                  it("tokens transferred from bad strategy back to deBridgeGate", async function () {
                    expect(await this.stakeToken.balanceOf(this.debridge.address)).to.be.equal(
                      totalSupplyAmount
                    );  
                  });
                  it("lost tokens remain on DefiController", async function () {
                    expect(await this.stakeToken.balanceOf(this.defiController.address)).to.be.equal(
                      badRewardAmount
                    );  
                    expect((await this.defiController.strategies(this.badStrategyStakeToken.address)).lostTokens).to.be.equal(
                      badRewardAmount-rewardAmount
                    );  
                  });

                  it("admin can transferLostTokens", async function(){
                    const lostTokens=badRewardAmount-rewardAmount
                    const balanceBefore=await this.stakeToken.balanceOf(other.address)
                    const lostTokensBefore=(await this.defiController.strategies(this.badStrategyStakeToken.address)).lostTokens

                    await this.defiController.transferLostTokens(this.badStrategyStakeToken.address,other.address,lostTokens);

                    const balanceAfter=await this.stakeToken.balanceOf(other.address)
                    const lostTokensAfter=(await this.defiController.strategies(this.badStrategyStakeToken.address)).lostTokens

                    expect(balanceAfter.sub(balanceBefore)).to.equal(lostTokens)
                    expect(lostTokensBefore.sub(lostTokensAfter)).to.equal(lostTokens)
                  })
                  it("should reject transferLostTokens if called by the non-admin", async function(){
                    await expect(this.defiController.connect(other).transferLostTokens(this.badStrategyStakeToken.address,other.address,100)).to.be.revertedWith('onlyAdmin: bad role')
                  })
                  it("should reject transferLostTokens if amount greater lost tokens", async function(){
                    const lostTokens=badRewardAmount-rewardAmount
                    await expect(this.defiController.transferLostTokens(this.badStrategyStakeToken.address,other.address,lostTokens*2)).to.be.revertedWith('amount is greater than lostTokens')
                  })
                });

                describe("after withdraw from bad strategy", function () {
                  beforeEach(async function () {
                    await this.defiController
                      .connect(worker)
                      .withdrawFromStrategy(amount, this.badStrategyStakeToken.address);
                  });

                  it("tokens transferred from strategy back to deBridgeGate", async function () {
                    expect(await this.stakeToken.balanceOf(this.debridge.address)).to.be.equal(
                      totalSupplyAmount
                    );  
                  });
                  it("lost tokens remain on DefiController", async function () {
                    expect(await this.stakeToken.balanceOf(this.defiController.address)).to.be.equal(
                      badRewardAmount
                    );  
                    expect((await this.defiController.strategies(this.badStrategyStakeToken.address)).lostTokens).to.be.equal(
                      badRewardAmount-rewardAmount
                    );  
                  });
                  it("admin can transferLostTokens", async function(){
                    const lostTokens=badRewardAmount-rewardAmount
                    const balanceBefore=await this.stakeToken.balanceOf(other.address)
                    const lostTokensBefore=(await this.defiController.strategies(this.badStrategyStakeToken.address)).lostTokens

                    await this.defiController.transferLostTokens(this.badStrategyStakeToken.address,other.address,lostTokens);

                    const balanceAfter=await this.stakeToken.balanceOf(other.address)
                    const lostTokensAfter=(await this.defiController.strategies(this.badStrategyStakeToken.address)).lostTokens

                    expect(balanceAfter.sub(balanceBefore)).to.equal(lostTokens)
                    expect(lostTokensBefore.sub(lostTokensAfter)).to.equal(lostTokens)
                  })
                  it("should reject transferLostTokens if called by the non-admin", async function(){
                    await expect(this.defiController.connect(other).transferLostTokens(this.badStrategyStakeToken.address,other.address,100)).to.be.revertedWith('onlyAdmin: bad role')
                  })
                  it("should reject transferLostTokens if amount greater lost tokens", async function(){
                    const lostTokens=badRewardAmount-rewardAmount
                    await expect(this.defiController.transferLostTokens(this.badStrategyStakeToken.address,other.address,lostTokens*2)).to.be.revertedWith('amount is greater than lostTokens')
                  })
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
