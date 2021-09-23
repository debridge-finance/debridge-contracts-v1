const { expectRevert } = require("@openzeppelin/test-helpers");
const { permitWithDeadline } = require("./utils.spec");
const MockLinkToken = artifacts.require("MockLinkToken");
const MockToken = artifacts.require("MockToken");
const WrappedAsset = artifacts.require("WrappedAsset");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const { toWei } = web3.utils;
const { BigNumber } = require("ethers");
const { expect } = require("chai");

function toBN(number) {
  return BigNumber.from(number.toString());
}

const ZERO_ADDRESS = ethers.constants.AddressZero;
const bobPrivKey = "0x79b2a2a43a1e9f325920f99a720605c9c563c61fb5ae3ebe483f83f1230512d3";

const transferFeeBps = 50;
const minReservesBps = 3000;
const BPS = toBN(10000);
const fixedNativeFee = toWei("0.00001");
const isSupported = true;
const supportedChainIds = [42, 56];
const excessConfirmations = 7; //Confirmations count in case of excess activity.
const referralCode = 555;

contract("DeBridgeGate full mode", function () {
  before(async function () {
    this.signers = await ethers.getSigners();
    alice = this.signers[0];
    bob = this.signers[1];
    carol = this.signers[2];
    eve = this.signers[3];
    fei = this.signers[4];
    devid = this.signers[5];
    other = this.signers[6];
    treasury = this.signers[7];

    const WETH9 = await deployments.getArtifact("WETH9");
    this.WETH9Factory = await ethers.getContractFactory(WETH9.abi, WETH9.bytecode, alice);
    this.DeBridgeGate = await ethers.getContractFactory("MockDeBridgeGate", alice);
    this.CallProxyFactory = await ethers.getContractFactory("CallProxy", alice);
  });

  beforeEach(async function () {
    this.callProxy = await upgrades.deployProxy(this.CallProxyFactory, []);

    //-------Deploy weth contracts
    this.weth = await this.WETH9Factory.deploy();

    this.debridge = await upgrades.deployProxy(
      this.DeBridgeGate,
      [
        excessConfirmations,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        this.callProxy.address,
        this.weth.address,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        1, //overrideChainId
      ],
      {
        initializer: "initializeMock",
        kind: "transparent",
      }
    );
    await this.debridge.deployed();

    await this.debridge.updateChainSupport(
      supportedChainIds,
      [
        {
          transferFeeBps,
          fixedNativeFee,
          isSupported,
        },
        {
          transferFeeBps,
          fixedNativeFee,
          isSupported,
        },
      ]
    );

    this.wethDebridgeId = await this.debridge.getDebridgeId(1, this.weth.address);
    this.nativeDebridgeId = await this.debridge.getDebridgeId(1, ZERO_ADDRESS);
    await this.debridge.updateAssetFixedFees(this.wethDebridgeId, supportedChainIds, [
      fixedNativeFee,
      fixedNativeFee,
    ]);

    const GOVMONITORING_ROLE = await this.debridge.GOVMONITORING_ROLE();
    await this.debridge.grantRole(GOVMONITORING_ROLE, alice.address);

    const DEBRIDGE_GATE_ROLE = await this.callProxy.DEBRIDGE_GATE_ROLE();
    await this.callProxy.grantRole(DEBRIDGE_GATE_ROLE, this.debridge.address);
  });

  it("Check init params", async function () {
    expect(this.weth.address).to.equal(await this.debridge.weth());
    // expect(devid.address).to.equal(await this.debridge.treasury());
    expect(excessConfirmations.toString()).to.equal(
      (await this.debridge.excessConfirmations()).toString()
    );
  });

  it("should update excessConfirmations if called by the admin", async function () {
    let newExcessConfirmations = 9;
    await this.debridge.updateExcessConfirmations(newExcessConfirmations, {
      from: alice.address,
    });
    expect(await this.debridge.excessConfirmations()).to.equal(newExcessConfirmations);
  });

  context("Role-based security checks for setters", () => {
    it("should set aggregator if called by the admin", async function () {
      // const aggregator = this.confirmationAggregator.address;
      const aggregator = other.address;
      await this.debridge.setAggregator(aggregator, {
        from: alice.address,
      });
      const newAggregator = await this.debridge.confirmationAggregator();
      expect(aggregator).to.equal(newAggregator);
    });

    it("should set fee proxy if called by the admin", async function () {
      const feeProxy = other.address;
      await this.debridge.setFeeProxy(feeProxy, {
        from: alice.address,
      });
      const newFeeProxy = await this.debridge.feeProxy();
      expect(feeProxy).to.equal(newFeeProxy);
    });

    it("should set defi controller if called by the admin", async function () {
      // const defiController = this.defiController.address;
      const defiController = other.address;
      await this.debridge.setDefiController(defiController, {
        from: alice.address,
      });
      const newDefiController = await this.debridge.defiController();
      expect(defiController).to.equal(newDefiController);
    });

    it("should update Chain Support if called by the admin and emits ChainsSupportUpdated event", async function () {
      const newChainInfo = {
        isSupported: false,
        fixedNativeFee: 99,
        transferFeeBps: 100,
      };

      const updChainTx = await this.debridge.updateChainSupport([42], [newChainInfo], {
        from: alice.address,
      });

      const { isSupported, fixedNativeFee, transferFeeBps } = await this.debridge.getChainSupport([
        42,
      ]);
      expect(newChainInfo.isSupported).to.equal(isSupported);
      expect(newChainInfo.fixedNativeFee).to.equal(fixedNativeFee);
      expect(newChainInfo.transferFeeBps).to.equal(transferFeeBps);

      await expect(updChainTx).to.emit(this.debridge, "ChainsSupportUpdated").withArgs([42]);
    });

    it("should set Chain Supporting if called by the admin and emits ChainSupportUpdated event", async function () {
      let support = false;
      const chainId = 42;
      const { isSupported: isSupportedBefore } = await this.debridge.getChainSupport([42]);

      // switch to false
      const setChainFalseTx = await this.debridge.setChainSupport(chainId, support, {
        from: alice.address,
      });

      const { isSupported: isSupportedMiddle } = await this.debridge.getChainSupport([42]);
      expect(isSupportedBefore).not.equal(isSupportedMiddle);
      expect(support).to.equal(isSupportedMiddle);
      await expect(setChainFalseTx)
        .to.emit(this.debridge, "ChainSupportUpdated")
        .withArgs(chainId, support);

      // switch backway (to true)
      support = true;
      const setChainTrueTx = await this.debridge.setChainSupport(chainId, support, {
        from: alice.address,
      });
      const { isSupported: isSupportedAfter } = await this.debridge.getChainSupport([42]);
      expect(isSupportedAfter).not.equal(isSupportedMiddle);
      expect(support).to.equal(isSupportedAfter);
      await expect(setChainTrueTx)
        .to.emit(this.debridge, "ChainSupportUpdated")
        .withArgs(chainId, support);
    });

    it("should set CallProxy if called by the admin and emits CallProxyUpdated", async function () {
      const callProxyBefore = await this.debridge.callProxyAddresses(0);

      const setCallProxyTx = await this.debridge.setCallProxy(0, devid.address, {
        from: alice.address,
      });

      const callProxyAfter = await this.debridge.callProxyAddresses(0);

      expect(callProxyBefore).not.equal(callProxyAfter);
      expect(devid.address).to.equal(callProxyAfter);

      await expect(setCallProxyTx)
        .to.emit(this.debridge, "CallProxyUpdated")
        .withArgs(0, devid.address);
    });

    it("should update flash fee if called by the admin", async function () {
      const newFlashFee = 300;

      await this.debridge.updateFlashFee(newFlashFee);

      expect(await this.debridge.flashFeeBps()).to.equal(newFlashFee);
    });

    // it("should update address treasury if called by the admin", async function () {
    //   const treasuryAddressBefore = await this.debridge.treasury();

    //   await this.debridge.updateTreasury(ZERO_ADDRESS);
    //   const treasuryAddressAfter = await this.debridge.treasury();

    //   assert.notEqual(treasuryAddressAfter, treasuryAddressBefore);
    //   assert.equal(ZERO_ADDRESS, treasuryAddressAfter);
    // });

    it("should reject setting aggregator if called by the non-admin", async function () {
      await expectRevert(this.debridge.connect(bob).setAggregator(ZERO_ADDRESS), "AdminBadRole()");
    });

    it("should reject setting fee proxy if called by the non-admin", async function () {
      await expectRevert(this.debridge.connect(bob).setFeeProxy(ZERO_ADDRESS), "AdminBadRole()");
    });

    it("should reject setting defi controller if called by the non-admin", async function () {
      await expectRevert(
        this.debridge.connect(bob).setDefiController(ZERO_ADDRESS),
        "AdminBadRole()"
      );
    });

    // it("should reject setting weth if called by the non-admin", async function () {
    //   await expectRevert(this.debridge.connect(bob).setWeth(ZERO_ADDRESS), "AdminBadRole()");
    // });

    it("should reject setting flash fee if called by the non-admin", async function () {
      await expectRevert(this.debridge.connect(bob).updateFlashFee(300), "AdminBadRole()");
    });

    it("should reject updating Chain Support if called by the non-admin", async function () {
      const newChainInfo = {
        isSupported: false,
        fixedNativeFee: 99,
        transferFeeBps: 100,
      };

      await expectRevert(
        this.debridge.connect(bob).updateChainSupport([42], [newChainInfo]),
        "AdminBadRole()"
      );
    });

    it("should reject updating Asset Sixed Fees if called by the non-admin", async function () {
      const newChainFee = 200;
      const chainId = 56;
      const debridgeId = await this.debridge.getDebridgeId(chainId, ZERO_ADDRESS);

      await expectRevert(
        this.debridge.connect(bob).updateAssetFixedFees(debridgeId, [chainId], [newChainFee]),
        "AdminBadRole()"
      );
    });

    it("should reject setting Chain Id Support if called by the non-admin", async function () {
      const support = true;
      const chainId = 42;

      await expectRevert(
        this.debridge.connect(bob).setChainSupport(chainId, support),
        "AdminBadRole()"
      );
    });

    it("should reject setting CallProxy if called by the non-admin", async function () {
      await expectRevert(
        this.debridge.connect(bob).setCallProxy(0, ZERO_ADDRESS),
        "AdminBadRole()"
      );
    });

    it("should reject stopping (pausing) all transfers if called buy the non-gov-monitoring", async function () {
      await expectRevert(this.debridge.connect(bob).pause(), "GovMonitoringBadRole");
    });

    it("should reject allowing (uppausing) all transfers if called buy the non-admin", async function () {
      await expectRevert(this.debridge.connect(bob).unpause(), "AdminBadRole");
    });

    it("should reject setting amount flashFeeBps if called by the non-admin", async function () {
      await expectRevert(this.debridge.connect(bob).updateFlashFee(20), "AdminBadRole");
    });

    // it("should reject setting address treasury if called by the non-admin", async function () {
    //   await expectRevert(this.debridge.connect(bob).updateTreasury(ZERO_ADDRESS), "AdminBadRole()");
    // });
  });

  context("with LINK and DBR assets", async function () {
    beforeEach(async function () {
      this.mockToken = await MockToken.new("Link Token", "dLINK", 18, {
        from: alice.address,
      });
      this.linkToken = await MockLinkToken.new("Link Token", "dLINK", 18, {
        from: alice.address,
      });
      this.dbrToken = await MockLinkToken.new("DBR", "DBR", 18, {
        from: alice.address,
      });
      const newSupply = toWei("100");
      await this.linkToken.mint(alice.address, newSupply, {
        from: alice.address,
      });
      await this.dbrToken.mint(alice.address, newSupply, {
        from: alice.address,
      });
    });

    it("getBalance returns a zero balance eth", async function () {
      expect(await web3.eth.getBalance(this.debridge.address)).to.equal("0");
    });

    it("getBalance returns a zero balance token", async function () {
      expect((await this.mockToken.balanceOf(this.debridge.address)).toString()).to.equal("0");
    });

    describe("with flash contract", function () {
      let flash;
      let flashFactory;
      before(async function () {
        flashFactory = await ethers.getContractFactory("MockFlashCallback", alice);
      });
      beforeEach(async function () {
        flash = await flashFactory.deploy();
        const amount = toBN(toWei("1000"));
        await this.mockToken.mint(alice.address, amount);

        //flashFeeBps 0.1%
        await this.mockToken.mint(flash.address, toBN(toWei("10")));
        const chainIdTo = 42;
        const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);

        await this.mockToken.approve(this.debridge.address, amount, {
          from: alice.address,
        });
        //We need to create debridge
        await this.debridge.send(
          this.mockToken.address,
          alice.address,
          amount,
          chainIdTo,
          [],
          false,
          0,
          [],
          {
            value: supportedChainInfo.fixedNativeFee,
            from: alice.address,
          }
        );
      });

      it("flash increases balances and counters of received funds", async function () {
        const amount = toBN(1000);
        await this.debridge.updateFlashFee(10); //set 0.1%
        const flashFeeBps = await this.debridge.flashFeeBps();
        const fee = amount.mul(flashFeeBps).div(BPS);
        const chainId = await this.debridge.getChainId();
        const debridgeId = await this.debridge.getDebridgeId(chainId, this.mockToken.address);
        const debridge = await this.debridge.getDebridge(debridgeId);
        const debridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(debridgeId);
        const paidBefore = debridgeFeeInfo.collectedFees;
        const balanceReceiverBefore = await this.mockToken.balanceOf(alice.address);

        await flash.flash(
          this.debridge.address,
          this.mockToken.address,
          alice.address,
          amount,
          false
        );

        const newDebridge = await this.debridge.getDebridge(debridgeId);
        const newDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(debridgeId);
        const paidAfter = newDebridgeFeeInfo.collectedFees;
        const balanceReceiverAfter = await this.mockToken.balanceOf(alice.address);

        expect("10").to.equal(flashFeeBps.toString());
        expect(toBN(paidBefore).add(fee)).to.equal(toBN(newDebridgeFeeInfo.collectedFees));
        expect(toBN(balanceReceiverBefore).add(amount)).to.equal(toBN(balanceReceiverAfter));
      });

      it("flash reverts if not profitable", async function () {
        await expect(
          flash.flash(this.debridge.address, this.mockToken.address, alice.address, 1000, true)
        ).to.be.revertedWith("FeeNotPaid()");
      });
    });

    context("with uniswap periphery", async function () {
      before(async function () {
        this.UniswapV2 = await deployments.getArtifact("UniswapV2Factory");
        this.UniswapV2Factory = await ethers.getContractFactory(
          this.UniswapV2.abi,
          this.UniswapV2.bytecode,
          alice.address
        );
      });

      beforeEach(async function () {
        this.uniswapFactory = await this.UniswapV2Factory.deploy(carol.address);
      });

      context("with feeProxy", async function () {
        beforeEach(async function () {
          const FeeProxyFactory = await ethers.getContractFactory("FeeProxy");

          this.feeProxy = await upgrades.deployProxy(FeeProxyFactory, [
            this.uniswapFactory.address,
            this.weth.address,
          ]);
          await this.debridge.setFeeProxy(this.feeProxy.address);
        });

        context("with confirmation aggregator", async function () {
          beforeEach(async function () {
            this.amountThreshols = toWei("1000");
            this.minConfirmations = 4;
            this.confirmationThreshold = 5; //Confirmations per block before extra check enabled.
            const ConfirmationAggregator = await ethers.getContractFactory(
              "ConfirmationAggregator",
              alice.address
            );

            this.confirmationAggregator = await upgrades.deployProxy(ConfirmationAggregator, [
              this.minConfirmations,
              this.confirmationThreshold,
              excessConfirmations,
              alice.address,
              ZERO_ADDRESS,
            ]);

            await this.confirmationAggregator.deployed();

            await this.confirmationAggregator.setDebridgeAddress(this.debridge.address);
            await this.debridge.setAggregator(this.confirmationAggregator.address);
          });

          it("debridge and aggregator are linked together", async function () {
            expect(this.debridge.address).to.equal(
              await this.confirmationAggregator.debridgeAddress()
            );
            expect(await this.debridge.confirmationAggregator()).to.equal(
              this.confirmationAggregator.address
            );
          });

          context("with oracles", async function () {
            let tokenAddress;
            beforeEach(async function () {
              tokenAddress = this.mockToken.address;
              this.initialOracles = [
                {
                  account: bob,
                  address: bob.address,
                },
                {
                  account: carol,
                  address: carol.address,
                },
                {
                  account: eve,
                  address: eve.address,
                },
                {
                  account: fei,
                  address: fei.address,
                },
                {
                  account: devid,
                  address: devid.address,
                },
              ];
              await this.confirmationAggregator.addOracles(
                this.initialOracles.map(o => o.address),
                this.initialOracles.map(o => false),
                {
                  from: alice.address,
                }
              );

              // Alice is required oracle
              await this.confirmationAggregator.addOracles(
                [alice.address],
                [true],
                {
                  from: alice.address,
                }
              );
            });

            it("should confirm new asset if called by the oracles", async function () {
              currentChainId = await this.debridge.getChainId();
              // todo: what's address? Should be taken from fixture.
              const chainId = 56;
              const maxAmount = toWei("1000000");
              const amountThreshold = toWei("10");
              const name = "MUSD";
              const symbol = "Magic Dollar";
              const decimals = 18;
              const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);

              for (let oracle of this.initialOracles) {
                await this.confirmationAggregator
                  .connect(oracle.account)
                  .confirmNewAsset(tokenAddress, chainId, name, symbol, decimals);
              }

              await this.debridge.updateAsset(
                debridgeId,
                maxAmount,
                minReservesBps,
                amountThreshold,
                {
                  from: alice.address,
                }
              );
              //Deploy token
              await this.debridge.deployNewAsset(tokenAddress, chainId, name, symbol, decimals, []);

              const debridge = await this.debridge.getDebridge(debridgeId);
              const debridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(debridgeId);
              expect(debridge.exist).to.equal(true);
              expect(debridge.chainId).to.equal(chainId);
              expect(debridge.maxAmount).to.equal(maxAmount);
              expect(debridgeFeeInfo.collectedFees).to.equal("0");
              expect(debridge.balance).to.equal("0");
              expect(debridge.minReservesBps).to.equal(minReservesBps);
              expect(await this.debridge.getAmountThreshold(debridgeId)).to.equal(amountThreshold);
            });

            context("Test mint method", () => {
              // todo: what's address? Should be taken from fixture.
              let tokenAddress;
              const chainId = 56;
              let receiver;
              const amount = toBN(toWei("100"));
              const nonce = 2;
              let currentChainId;
              let submissionId;
              let debridgeId;
              beforeEach(async function () {
                tokenAddress = this.mockToken.address;
                const name = "MUSD";
                const symbol = "Magic Dollar";
                const decimals = 18;
                const maxAmount = toWei("1000000");
                const amountThreshold = toWei("10");

                receiver = bob.address;
                currentChainId = await this.debridge.getChainId();
                const newSupply = toWei("100");
                await this.linkToken.mint(alice.address, newSupply, {
                  from: alice.address,
                });
                await this.dbrToken.mint(alice.address, newSupply, {
                  from: alice.address,
                });

                debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);

                submissionId = await this.debridge.getSubmissionId(
                  debridgeId,
                  chainId,
                  currentChainId,
                  amount,
                  receiver,
                  nonce
                );

                for (let oracle of this.initialOracles) {
                  await this.confirmationAggregator
                    .connect(oracle.account)
                    .confirmNewAsset(tokenAddress, chainId, name, symbol, decimals);
                }
                await this.debridge.updateAsset(
                  debridgeId,
                  maxAmount,
                  minReservesBps,
                  amountThreshold,
                  {
                    from: alice.address,
                  }
                );

                //Deploy token
                await this.debridge.deployNewAsset(tokenAddress, chainId, name, symbol, decimals, []);
                for (let oracle of this.initialOracles) {
                  await this.confirmationAggregator.connect(oracle.account).submit(submissionId);
                }
              });
              it("check confirmation without DSRM confirmation", async function () {
                let submissionInfo = await this.confirmationAggregator.getSubmissionInfo(
                  submissionId
                );
                let submissionConfirmations =
                  await this.confirmationAggregator.getSubmissionConfirmations(submissionId);

                expect(submissionInfo.confirmations).to.equal(this.initialOracles.length);
                expect(submissionInfo.requiredConfirmations).to.equal(0);
                expect(submissionInfo.isConfirmed).to.equal(false);
                expect(this.initialOracles.length).to.equal(submissionConfirmations[0]);
                expect(false).to.equal(submissionConfirmations[1]);
              });

              it("should reject native token without DSRM confirmation", async function () {
                await expectRevert(
                  this.debridge.mint(
                    debridgeId,
                    chainId,
                    receiver,
                    amount,
                    nonce,
                    [],
                    [],
                    {
                      from: alice.address,
                    }),
                  "SubmissionNotConfirmed()"
                );
              });
              describe("confirm by required oracle", function () {
                beforeEach(async function () {
                  await this.confirmationAggregator.submit(submissionId, {
                    from: alice.address,
                  });
                });

                it("check confirmation with DSRM confirmation", async function () {
                  const submissionInfo = await this.confirmationAggregator.getSubmissionInfo(
                    submissionId
                  );
                  expect(submissionInfo.confirmations).to.be.equal(this.initialOracles.length + 1);
                  expect(submissionInfo.requiredConfirmations).to.be.equal(1);
                  expect(submissionInfo.isConfirmed).to.be.equal(true);
                });

                it("should reject exceed amount", async function () {
                  const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);

                  await expectRevert(
                    this.debridge.mint(
                      debridgeId,
                      chainId,
                      receiver,
                      amount,
                      nonce,
                      [],
                      [],
                      {
                        from: alice.address,
                      }),
                    "SubmissionAmountNotConfirmed()"
                  );
                });
                describe("update reduce ExcessConfirmations", function () {
                  beforeEach(async function () {
                    let newExcessConfirmations = 3;
                    await this.debridge.updateExcessConfirmations(newExcessConfirmations, {
                      from: alice.address,
                    });
                    expect(await this.debridge.excessConfirmations()).to.equal(
                      newExcessConfirmations
                    );
                  });

                  it("should reject when the submission is blocked", async function () {
                    await this.debridge.blockSubmission([submissionId], true, {
                      from: alice.address,
                    });

                    expect(await this.debridge.isBlockedSubmission(submissionId)).to.equal(true);

                    await expectRevert(
                      this.debridge.mint(
                        debridgeId,
                        chainId,
                        receiver,
                        amount,
                        nonce,
                        [],
                        [],
                        {
                          from: alice.address,
                        }),
                      "SubmissionBlocked()"
                    );
                  });

                  it("should unblock the submission by admin", async function () {
                    await this.debridge.blockSubmission([submissionId], false, {
                      from: alice.address,
                    });

                    expect(await this.debridge.isBlockedSubmission(submissionId)).to.equal(false);
                  });

                  it("should reject minting with unconfirmed submission", async function () {
                    const nonce = 4;
                    const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
                    await expectRevert(
                      this.debridge.mint(
                        debridgeId,
                        chainId,
                        receiver,
                        amount,
                        nonce,
                        [],
                        [],
                        {
                          from: alice.address,
                        }),
                      "SubmissionNotConfirmed()"
                    );
                  });
                  describe("should mint when the submission is approved", function () {
                    beforeEach(async function () {
                      const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
                      const balance = toBN("0");
                      await this.debridge.mint(
                        debridgeId,
                        chainId,
                        receiver,
                        amount,
                        nonce,
                        [],
                        [],
                        {
                          from: alice.address,
                        });
                      const debridge = await this.debridge.getDebridge(debridgeId);
                      const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);
                      const newBalance = toBN(await wrappedAsset.balanceOf(receiver));
                      const submissionId = await this.debridge.getSubmissionId(
                        debridgeId,
                        chainId,
                        currentChainId,
                        amount,
                        receiver,
                        nonce
                      );
                      const isSubmissionUsed = await this.debridge.isSubmissionUsed(submissionId);
                      expect(balance.add(amount)).to.equal(newBalance);
                      expect(isSubmissionUsed).ok;
                    });

                    it("should reject minting twice", async function () {
                      const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
                      await expectRevert(
                        this.debridge.mint(
                          debridgeId,
                          chainId,
                          receiver,
                          amount,
                          nonce,
                          [],
                          [],
                          {
                            from: alice.address,
                          }),
                        "SubmissionUsed()"
                      );
                    });
                    for (let i = 0; i <= 2; i++) {
                      let discount = 0;
                      switch (i) {
                        case 0:
                          discount = 0;
                          break;
                        case 1:
                          discount = 5000; //50%
                          break;
                        case 2:
                          discount = 10000; //100%
                          break;
                        default:
                          discount = 0;
                      }
                      context(`Test burn method  discount: ${(discount * 100) / BPS}%`, () => {
                        let tokenAddress;
                        beforeEach(async function () {
                          tokenAddress = this.mockToken.address;
                          await this.debridge.updateFeeDiscount(bob.address, discount, discount);
                          const discountFromContract = await this.debridge.feeDiscount(bob.address);
                          expect(discount).to.equal(discountFromContract.discountTransferBps);
                          expect(discount).to.equal(discountFromContract.discountFixBps);
                        });

                        it("should burning with permit when the amount is suficient", async function () {
                          const chainIdTo = 56;
                          const receiver = alice.address;
                          const amount = toBN(toWei("1"));
                          const debridgeId = await this.debridge.getDebridgeId(
                            chainIdTo,
                            tokenAddress
                          );
                          const debridge = await this.debridge.getDebridge(debridgeId);
                          const debridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                            debridgeId
                          );
                          const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);
                          const balance = toBN(await wrappedAsset.balanceOf(bob.address));
                          const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);
                          const permitParameter = await permitWithDeadline(
                            wrappedAsset,
                            bob.address,
                            this.debridge.address,
                            amount,
                            toBN(MAX_UINT256),
                            bobPrivKey
                          );
                          const nativeDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                            this.nativeDebridgeId
                          );
                          let fixedNativeFeeWithDiscount = supportedChainInfo.fixedNativeFee;
                          fixedNativeFeeWithDiscount = toBN(fixedNativeFeeWithDiscount).sub(
                            toBN(fixedNativeFeeWithDiscount).mul(discount).div(BPS)
                          );
                          await this.debridge.connect(bob).burn(
                            debridgeId,
                            alice.address,
                            amount,
                            chainIdTo,
                            permitParameter,
                            false,
                            referralCode,
                            [],
                            {
                              value: fixedNativeFeeWithDiscount,
                            }
                          );
                          const newNativeDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                            this.nativeDebridgeId
                          );
                          const newBalance = toBN(await wrappedAsset.balanceOf(bob.address));
                          expect(balance.sub(amount)).to.equal(newBalance);
                          const newDebridge = await this.debridge.getDebridge(debridgeId);
                          const newDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                            debridgeId
                          );
                          let fees = toBN(supportedChainInfo.transferFeeBps).mul(amount).div(BPS);
                          fees = toBN(fees).sub(toBN(fees).mul(discount).div(BPS));
                          expect(debridgeFeeInfo.collectedFees.add(fees)).to.equal(
                            newDebridgeFeeInfo.collectedFees
                          );
                          expect(
                            nativeDebridgeFeeInfo.collectedFees.add(fixedNativeFeeWithDiscount)
                          ).to.equal(newNativeDebridgeFeeInfo.collectedFees);
                        });

                        it("should burning when the amount is suficient(_useAssetFee=true)", async function () {
                          const chainIdTo = 56;
                          const receiver = alice.address;
                          const amount = toBN(toWei("1"));
                          const debridgeId = await this.debridge.getDebridgeId(
                            chainIdTo,
                            tokenAddress
                          );
                          const debridge = await this.debridge.getDebridge(debridgeId);
                          const debridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                            debridgeId
                          );

                          const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);
                          const balance = toBN(await wrappedAsset.balanceOf(bob.address));
                          const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);
                          const permitParameter = await permitWithDeadline(
                            wrappedAsset,
                            bob.address,
                            this.debridge.address,
                            amount,
                            toBN(MAX_UINT256),
                            bobPrivKey
                          );
                          const nativeDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                            this.nativeDebridgeId
                          );
                          // let fixedNativeFeeWithDiscount = supportedChainInfo.fixedNativeFee;
                          // fixedNativeFeeWithDiscount = toBN(fixedNativeFeeWithDiscount).sub(
                          //   toBN(fixedNativeFeeWithDiscount).mul(discount).div(BPS)
                          // );
                          await this.debridge.updateAssetFixedFees(
                            debridgeId,
                            [chainIdTo],
                            [supportedChainInfo.fixedNativeFee]
                          );
                          await this.debridge.connect(bob).burn(
                            debridgeId,
                            alice.address,
                            amount,
                            chainIdTo,
                            permitParameter,
                            true,
                            referralCode,
                            [],
                          );
                          const newNativeDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                            this.nativeDebridgeId
                          );
                          const newBalance = toBN(await wrappedAsset.balanceOf(bob.address));
                          expect(balance.sub(amount)).to.equal(newBalance);
                          const newDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                            debridgeId
                          );
                          let fees = toBN(supportedChainInfo.transferFeeBps)
                            .mul(amount)
                            .div(BPS)
                            .add(supportedChainInfo.fixedNativeFee);
                          fees = toBN(fees).sub(toBN(fees).mul(discount).div(BPS));
                          expect(debridgeFeeInfo.collectedFees.add(fees)).to.equal(
                            newDebridgeFeeInfo.collectedFees
                          );
                          expect(nativeDebridgeFeeInfo.collectedFees).to.equal(
                            newNativeDebridgeFeeInfo.collectedFees
                          );
                        });

                        it("should reject burning from current chain", async function () {
                          const tokenAddress = this.weth.address;
                          const chainId = await this.debridge.getChainId();
                          const receiver = bob.address;
                          const amount = toBN(toWei("1"));
                          const debridgeId = await this.debridge.getDebridgeId(
                            chainId,
                            tokenAddress
                          );
                          await expectRevert(
                            this.debridge.burn(
                              debridgeId,
                              receiver,
                              amount,
                              42,
                              [],
                              false,
                              referralCode,
                              [],
                              {
                                from: alice.address,
                              }
                            ),
                            "WrongChain()"
                          );
                        });
                      });
                    }
                  });
                });
              });
            });

            context("After oracle submitted", () => {
              const tokenAddress = ZERO_ADDRESS;
              let receiver;
              const amount = toBN(toWei("0.9"));
              const nonce = 4;
              let chainIdFrom = 50;
              let chainId;
              // let debridgeId;
              let outsideDebridgeId;
              let erc20DebridgeId;
              let curentChainSubmissionId;
              let outsideChainSubmissionId;
              let erc20SubmissionId;
              beforeEach(async function () {
                receiver = bob.address;
                chainId = await this.debridge.getChainId();
                // debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
                outsideDebridgeId = await this.debridge.getDebridgeId(56, this.mockToken.address);
                erc20DebridgeId = await this.debridge.getDebridgeId(
                  chainId,
                  this.mockToken.address
                );
                curentChainSubmissionId = await this.debridge.getSubmissionId(
                  this.wethDebridgeId,
                  chainIdFrom,
                  chainId,
                  amount,
                  receiver,
                  nonce
                );
                outsideChainSubmissionId = await this.debridge.getSubmissionId(
                  outsideDebridgeId,
                  chainIdFrom,
                  56,
                  amount,
                  receiver,
                  nonce
                );
                erc20SubmissionId = await this.debridge.getSubmissionId(
                  erc20DebridgeId,
                  chainIdFrom,
                  chainId,
                  amount,
                  receiver,
                  nonce
                );
                for (let oracle of this.initialOracles) {
                  await this.confirmationAggregator
                    .connect(oracle.account)
                    .submit(curentChainSubmissionId);
                  await this.confirmationAggregator
                    .connect(oracle.account)
                    .submit(outsideChainSubmissionId);
                  await this.confirmationAggregator
                    .connect(oracle.account)
                    .submit(erc20SubmissionId);
                }
              });
              it("check confirmation without DSRM confirmation", async function () {
                const curentChainSubmissionInfo =
                  await this.confirmationAggregator.getSubmissionInfo(curentChainSubmissionId);
                const outsideChainSubmissionInfo =
                  await this.confirmationAggregator.getSubmissionInfo(outsideChainSubmissionId);
                const erc20SubmissionInfo = await this.confirmationAggregator.getSubmissionInfo(
                  erc20SubmissionId
                );
                expect(curentChainSubmissionInfo.confirmations).to.be.equal(
                  this.initialOracles.length
                );
                expect(curentChainSubmissionInfo.requiredConfirmations).to.be.equal(0);
                expect(curentChainSubmissionInfo.isConfirmed).to.be.equal(false);

                expect(outsideChainSubmissionInfo.confirmations).to.be.equal(
                  this.initialOracles.length
                );
                expect(outsideChainSubmissionInfo.requiredConfirmations).to.be.equal(0);
                expect(outsideChainSubmissionInfo.isConfirmed).to.be.equal(false);

                expect(erc20SubmissionInfo.confirmations).to.be.equal(this.initialOracles.length);
                expect(erc20SubmissionInfo.requiredConfirmations).to.be.equal(0);
                expect(erc20SubmissionInfo.isConfirmed).to.be.equal(false);
              });

              it("should reject native token without DSRM confirmation", async function () {
                await expectRevert(
                  this.debridge.claim(
                    this.wethDebridgeId,
                    chainIdFrom,
                    receiver,
                    amount,
                    nonce,
                    [],
                    [],
                    {
                      from: alice.address,
                    }
                  ),
                  "SubmissionNotConfirmed()"
                );
              });
              describe("after confirmation by required oracle", function () {
                beforeEach(async function () {
                  await this.confirmationAggregator.submit(curentChainSubmissionId, {
                    from: alice.address,
                  });
                  await this.confirmationAggregator.submit(outsideChainSubmissionId, {
                    from: alice.address,
                  });
                  await this.confirmationAggregator.submit(erc20SubmissionId, {
                    from: alice.address,
                  });
                });

                it("should reject when the submission is blocked", async function () {
                  const cuurentChainSubmission = await this.debridge.getSubmissionId(
                    this.wethDebridgeId,
                    chainIdFrom,
                    chainId,
                    amount,
                    receiver,
                    nonce
                  );
                  await this.debridge.blockSubmission([cuurentChainSubmission], true, {
                    from: alice.address,
                  });

                  expect(await this.debridge.isBlockedSubmission(cuurentChainSubmission)).to.equal(
                    true
                  );

                  await expectRevert(
                    this.debridge.claim(
                      this.wethDebridgeId,
                      chainIdFrom,
                      receiver,
                      amount,
                      nonce,
                      [],
                      [],
                      {
                        from: alice.address,
                      }
                    ),
                    "SubmissionBlocked()"
                  );
                });

                it("check confirmation with DSRM confirmation", async function () {
                  const curentChainSubmissionInfo =
                    await this.confirmationAggregator.getSubmissionInfo(curentChainSubmissionId);
                  const outsideChainSubmissionInfo =
                    await this.confirmationAggregator.getSubmissionInfo(outsideChainSubmissionId);
                  const erc20SubmissionInfo = await this.confirmationAggregator.getSubmissionInfo(
                    erc20SubmissionId
                  );

                  expect(curentChainSubmissionInfo.confirmations).to.be.equal(
                    this.initialOracles.length + 1
                  );
                  expect(curentChainSubmissionInfo.requiredConfirmations).to.be.equal(1);
                  expect(curentChainSubmissionInfo.isConfirmed).to.be.equal(true);

                  expect(outsideChainSubmissionInfo.confirmations).to.be.equal(
                    this.initialOracles.length + 1
                  );
                  expect(outsideChainSubmissionInfo.requiredConfirmations).to.be.equal(1);
                  expect(outsideChainSubmissionInfo.isConfirmed).to.be.equal(true);

                  expect(erc20SubmissionInfo.confirmations).to.be.equal(
                    this.initialOracles.length + 1
                  );
                  expect(erc20SubmissionInfo.requiredConfirmations).to.be.equal(1);
                  expect(erc20SubmissionInfo.isConfirmed).to.be.equal(true);
                });
                describe("should unblock the submission by admin", function () {
                  beforeEach(async function () {
                    const cuurentChainSubmission = await this.debridge.getSubmissionId(
                      this.wethDebridgeId,
                      chainIdFrom,
                      chainId,
                      amount,
                      receiver,
                      nonce
                    );
                    await this.debridge.blockSubmission([cuurentChainSubmission], false, {
                      from: alice.address,
                    });

                    expect(
                      await this.debridge.isBlockedSubmission(cuurentChainSubmission)
                    ).to.equal(false);

                    let newExcessConfirmations = 3;
                    await this.debridge.updateExcessConfirmations(newExcessConfirmations, {
                      from: alice.address,
                    });
                    expect(await this.debridge.excessConfirmations()).to.equal(
                      newExcessConfirmations
                    );
                  });

                  beforeEach(async function () {
                    let discount = 0;
                    await this.debridge.updateFeeDiscount(alice.address, discount, discount);
                    const discountFromContract = await this.debridge.feeDiscount(alice.address);
                    expect(discount).to.equal(discountFromContract.discountTransferBps);
                    expect(discount).to.equal(discountFromContract.discountFixBps);

                    const tokenAddress = ZERO_ADDRESS;
                    const chainId = await this.debridge.getChainId();
                    const receiver = bob.address;
                    const amount = toBN(toWei("1"));
                    const chainIdTo = 42;
                    const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
                    const balance = toBN(await this.weth.balanceOf(this.debridge.address));
                    const debridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                      this.wethDebridgeId
                    );
                    const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);
                    let feesWithFix = toBN(supportedChainInfo.transferFeeBps)
                      .mul(amount)
                      .div(BPS)
                      .add(toBN(supportedChainInfo.fixedNativeFee));
                    feesWithFix = toBN(feesWithFix).sub(toBN(feesWithFix).mul(discount).div(BPS));
                    await this.debridge.send(
                      tokenAddress,
                      receiver,
                      amount,
                      chainIdTo,
                      [],
                      false,
                      referralCode,
                      [],
                      {
                        value: amount,
                        from: alice.address,
                      }
                    );
                    const newBalance = toBN(await this.weth.balanceOf(this.debridge.address));
                    const newDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                      this.wethDebridgeId
                    );
                    expect(balance.add(amount)).to.equal(newBalance);
                    expect(debridgeFeeInfo.collectedFees.add(feesWithFix)).to.equal(
                      newDebridgeFeeInfo.collectedFees
                    );
                  });

                  beforeEach(async function () {
                    let discount = 0;
                    const tokenAddress = this.mockToken.address;
                    const chainId = await this.debridge.getChainId();
                    const receiver = bob.address;
                    const amount = toBN(toWei("100"));
                    const chainIdTo = 42;
                    await this.mockToken.mint(alice.address, amount, {
                      from: alice.address,
                    });
                    await this.mockToken.approve(this.debridge.address, amount, {
                      from: alice.address,
                    });
                    const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
                    const balance = toBN(await this.mockToken.balanceOf(this.debridge.address));
                    const debridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(debridgeId);
                    const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);
                    const nativeDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                      this.nativeDebridgeId
                    );
                    let fees = toBN(supportedChainInfo.transferFeeBps).mul(amount).div(BPS);
                    fees = toBN(fees).sub(toBN(fees).mul(discount).div(BPS));

                    await this.debridge.send(
                      tokenAddress,
                      receiver,
                      amount,
                      chainIdTo,
                      [],
                      false,
                      referralCode,
                      [],
                      {
                        value: supportedChainInfo.fixedNativeFee,
                        from: alice.address,
                      }
                    );
                    const newNativeDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                      this.nativeDebridgeId
                    );
                    const newBalance = toBN(await this.mockToken.balanceOf(this.debridge.address));
                    const newDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(debridgeId);

                    // console.log("newDebridgeFeeInfo.collectedFees: "+ newDebridgeFeeInfo.collectedFees.toString());
                    // console.log("newNativeDebridgeFeeInfo.collectedFees: "+ newNativeDebridgeFeeInfo.collectedFees.toString());
                    // console.log("balance: "+ balance.toString());
                    // console.log("amount: "+ amount.toString());
                    // console.log("newBalance: "+ newBalance.toString());
                    expect(balance.add(amount)).to.equal(newBalance);
                    expect(debridgeFeeInfo.collectedFees.add(fees)).to.equal(
                      newDebridgeFeeInfo.collectedFees
                    );
                    expect(
                      nativeDebridgeFeeInfo.collectedFees.add(
                        toBN(supportedChainInfo.fixedNativeFee)
                      )
                    ).to.equal(newNativeDebridgeFeeInfo.collectedFees);
                  });

                  it("getBalance returns balance eth that went into functions send + fee", async function () {
                    const chainIdTo = 42;
                    const fixedNativeFee = (await this.debridge.getChainSupport(chainIdTo))
                      .fixedNativeFee;
                    const amount = toBN(toWei("1"));
                    expect(await web3.eth.getBalance(this.debridge.address)).to.equal(
                      fixedNativeFee
                    );

                    expect(await this.weth.balanceOf(this.debridge.address)).to.equal(amount);
                  });

                  it("getBalance returns token that went into functions send", async function () {
                    const amount = toBN(toWei("100"));
                    expect(
                      (await this.mockToken.balanceOf(this.debridge.address)).toString()
                    ).to.equal(amount.toString());
                  });

                  it("should claim ERC20 when the submission is approved", async function () {
                    const debridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(erc20DebridgeId);
                    const balance = toBN(await this.mockToken.balanceOf(receiver));
                    await this.debridge.claim(
                      erc20DebridgeId,
                      chainIdFrom,
                      receiver,
                      amount,
                      nonce,
                      [],
                      [],
                      {
                        from: alice.address,
                      }
                    );
                    const newBalance = toBN(await this.mockToken.balanceOf(receiver));
                    const submissionId = await this.debridge.getSubmissionId(
                      erc20DebridgeId,
                      chainIdFrom,
                      await this.debridge.getChainId(),
                      amount,
                      receiver,
                      nonce
                    );
                    const isSubmissionUsed = await this.debridge.isSubmissionUsed(submissionId);
                    const newDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                      erc20DebridgeId
                    );
                    expect(balance.add(amount)).to.equal(newBalance);
                    expect(debridgeFeeInfo.collectedFees).to.equal(
                      newDebridgeFeeInfo.collectedFees
                    );
                    expect(isSubmissionUsed).ok;
                  });

                  it("should reject claiming with unconfirmed submission", async function () {
                    const nonce = 1;
                    await expectRevert(
                      this.debridge.claim(
                        this.wethDebridgeId,
                        chainIdFrom,
                        receiver,
                        amount,
                        nonce,
                        [],
                        [],
                        {
                          from: alice.address,
                        }
                      ),
                      "SubmissionNotConfirmed()"
                    );
                  });

                  it("should reject claiming the token from outside chain", async function () {
                    // todo: Should revert with "claim: wrong target chain"
                    await expectRevert(
                      this.debridge.claim(
                        outsideDebridgeId,
                        chainIdFrom,
                        receiver,
                        amount,
                        nonce,
                        [],
                        [],
                        {
                          from: alice.address,
                        }
                      ),
                      "SubmissionNotConfirmed()"
                    );
                  });

                  describe("After claim native token", function () {
                    beforeEach(async function () {
                      const debridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                        this.wethDebridgeId
                      );
                      const receivebalance = toBN(await this.weth.balanceOf(receiver));
                      await this.debridge.claim(
                        this.wethDebridgeId,
                        chainIdFrom,
                        receiver,
                        amount,
                        nonce,
                        [],
                        [],
                        {
                          from: alice.address,
                        }
                      );
                      const newReceivebalance = toBN(await this.weth.balanceOf(receiver));
                      const submissionId = await this.debridge.getSubmissionId(
                        this.wethDebridgeId,
                        chainIdFrom,
                        await this.debridge.getChainId(),
                        amount,
                        receiver,
                        nonce
                      );
                      const isSubmissionUsed = await this.debridge.isSubmissionUsed(submissionId);
                      const newDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                        this.wethDebridgeId
                      );
                      expect(receivebalance.add(amount)).to.equal(newReceivebalance);
                      expect(debridgeFeeInfo.collectedFees).to.equal(
                        newDebridgeFeeInfo.collectedFees
                      );
                      expect(isSubmissionUsed).ok;
                    });

                    it("should reject claiming twice", async function () {
                      await expectRevert(
                        this.debridge.claim(
                          this.wethDebridgeId,
                          chainIdFrom,
                          receiver,
                          amount,
                          nonce,
                          [],
                          [],
                          {
                            from: alice.address,
                          }
                        ),
                        "SubmissionUsed()"
                      );
                    });
                  });
                });
              });
            });

            for (let i = 0; i <= 2; i++) {
              let discount = 0;
              switch (i) {
                case 0:
                  discount = 0;
                  break;
                case 1:
                  discount = 5000; //50%
                  break;
                case 2:
                  discount = 10000; //100%
                  break;
                default:
                  discount = 0;
              }
              context(`Test send method. discount: discount ${(discount * 100) / BPS}%`, () => {
                beforeEach(async function () {
                  await this.debridge.updateFeeDiscount(alice.address, discount, discount);
                  const discountFromContract = await this.debridge.feeDiscount(alice.address);
                  expect(discount).to.equal(discountFromContract.discountTransferBps);
                  expect(discount).to.equal(discountFromContract.discountFixBps);
                });

                it("should send native tokens from the current chain", async function () {
                  const tokenAddress = ZERO_ADDRESS;
                  const chainId = await this.debridge.getChainId();
                  const receiver = bob.address;
                  const amount = toBN(toWei("1"));
                  const chainIdTo = 42;
                  const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
                  const wethDebridgeId = await this.debridge.getDebridgeId(
                    chainId,
                    this.weth.address
                  );
                  const balance = toBN(await this.weth.balanceOf(this.debridge.address));
                  const debridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(wethDebridgeId);
                  const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);
                  let feesWithFix = toBN(supportedChainInfo.transferFeeBps)
                    .mul(amount)
                    .div(BPS)
                    .add(toBN(supportedChainInfo.fixedNativeFee));
                  feesWithFix = toBN(feesWithFix).sub(toBN(feesWithFix).mul(discount).div(BPS));
                  await this.debridge.send(
                    tokenAddress,
                    receiver,
                    amount,
                    chainIdTo,
                    [],
                    false,
                    referralCode,
                    [],
                    {
                      value: amount,
                      from: alice.address,
                    }
                  );
                  const newBalance = toBN(await this.weth.balanceOf(this.debridge.address));
                  const newDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(wethDebridgeId);
                  expect(balance.add(amount)).to.equal(newBalance);
                  expect(debridgeFeeInfo.collectedFees.add(feesWithFix)).to.equal(
                    newDebridgeFeeInfo.collectedFees
                  );
                });

                it("should send ERC20 tokens from the current chain", async function () {
                  const tokenAddress = this.mockToken.address;
                  const chainId = await this.debridge.getChainId();
                  const receiver = bob.address;
                  const amount = toBN(toWei("100"));
                  const chainIdTo = 42;
                  await this.mockToken.mint(alice.address, amount, {
                    from: alice.address,
                  });
                  await this.mockToken.approve(this.debridge.address, amount, {
                    from: alice.address,
                  });
                  const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
                  const balance = toBN(await this.mockToken.balanceOf(this.debridge.address));
                  const debridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(debridgeId);
                  const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);
                  const nativeDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                    this.nativeDebridgeId
                  );
                  let fees = toBN(supportedChainInfo.transferFeeBps).mul(amount).div(BPS);
                  fees = toBN(fees).sub(toBN(fees).mul(discount).div(BPS));
                  await this.debridge.send(
                    tokenAddress,
                    receiver,
                    amount,
                    chainIdTo,
                    [],
                    false,
                    referralCode,
                    [],
                    {
                      value: supportedChainInfo.fixedNativeFee,
                      from: alice.address,
                    }
                  );
                  const newNativeDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                    this.nativeDebridgeId
                  );
                  const newBalance = toBN(await this.mockToken.balanceOf(this.debridge.address));
                  const newDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(debridgeId);
                  expect(balance.add(amount)).to.equal(newBalance);
                  expect(debridgeFeeInfo.collectedFees.add(fees)).to.equal(
                    newDebridgeFeeInfo.collectedFees
                  );
                  expect(
                    nativeDebridgeFeeInfo.collectedFees.add(toBN(supportedChainInfo.fixedNativeFee))
                  ).to.equal(newNativeDebridgeFeeInfo.collectedFees);
                });
                it("should send ERC20 tokens from the current chain (_useAssetFee=true)", async function () {
                  const tokenAddress = this.mockToken.address;
                  const chainId = await this.debridge.getChainId();
                  const receiver = bob.address;
                  const amount = toBN(toWei("100"));
                  const chainIdTo = 42;
                  await this.mockToken.mint(alice.address, amount, {
                    from: alice.address,
                  });
                  await this.mockToken.approve(this.debridge.address, amount, {
                    from: alice.address,
                  });
                  const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
                  const balance = toBN(await this.mockToken.balanceOf(this.debridge.address));
                  const debridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(debridgeId);
                  const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);
                  const nativeDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                    this.nativeDebridgeId
                  );

                  const collectedNativeFees = nativeDebridgeFeeInfo.collectedFees;
                  let fees = toBN(supportedChainInfo.transferFeeBps)
                    .mul(amount)
                    .div(BPS)
                    .add(supportedChainInfo.fixedNativeFee);
                  fees = toBN(fees).sub(toBN(fees).mul(discount).div(BPS));
                  //console.log(debridge)
                  //console.log(supportedChainInfo.fixedNativeFee)
                  await this.debridge.updateAssetFixedFees(
                    debridgeId,
                    [chainIdTo],
                    [supportedChainInfo.fixedNativeFee]
                  );
                  await this.debridge.send(
                    tokenAddress,
                    receiver,
                    amount,
                    chainIdTo,
                    [],
                    true,
                    referralCode,
                    [],
                    {
                      value: supportedChainInfo.fixedNativeFee,
                      from: alice.address,
                    }
                  );

                  const newNativeDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(
                    this.nativeDebridgeId
                  );

                  const newCollectedNativeFees = newNativeDebridgeFeeInfo.collectedFees;
                  const newBalance = toBN(await this.mockToken.balanceOf(this.debridge.address));
                  const newDebridgeFeeInfo = await this.debridge.getDebridgeFeeInfo(debridgeId);
                  //console.log(newDebridge)
                  expect(balance.add(amount)).to.equal(newBalance);
                  expect(debridgeFeeInfo.collectedFees.add(fees)).to.equal(
                    newDebridgeFeeInfo.collectedFees
                  );
                  expect(collectedNativeFees).to.equal(newCollectedNativeFees);
                });

                it("should reverts if amount more than maxAmount", async function () {
                  const tokenAddress = ZERO_ADDRESS;
                  const receiver = bob.address;
                  const chainId = await this.debridge.getChainId();
                  const amount = toWei("20");
                  const chainIdTo = 42;

                  const newMinReservesBps = 0;
                  const newMaxAmount = toWei("1");
                  const newAmountThreshold = toWei("10");
                  const debridgeId = await this.debridge.getDebridgeId(chainId, this.weth.address);
                  await this.debridge.updateAsset(
                    debridgeId,
                    newMaxAmount,
                    newMinReservesBps,
                    newAmountThreshold
                  );

                  await expectRevert(
                    this.debridge.send(
                      tokenAddress,
                      receiver,
                      amount,
                      chainIdTo,
                      [],
                      false,
                      referralCode,
                      [],
                      {
                        value: amount,
                        from: alice.address,
                      }
                    ),
                    "TransferAmountTooHigh()"
                  );
                });

                it("should reject sending too mismatched amount of native tokens", async function () {
                  const tokenAddress = ZERO_ADDRESS;
                  const receiver = bob.address;
                  const chainId = await this.debridge.getChainId();
                  const amount = toBN(toWei("1"));
                  const chainIdTo = 42;
                  const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
                  await expectRevert(
                    this.debridge.send(
                      tokenAddress,
                      receiver,
                      amount,
                      chainIdTo,
                      [],
                      false,
                      0,
                      [],
                      {
                        value: toWei("0.1"),
                        from: alice.address,
                      }),
                    "AmountMismatch()"
                  );
                });

                it("should reject sending tokens to unsupported chain", async function () {
                  const tokenAddress = ZERO_ADDRESS;
                  const receiver = bob.address;
                  const chainId = await this.debridge.getChainId();
                  const amount = toBN(toWei("1"));
                  const chainIdTo = chainId;
                  const debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
                  await expectRevert(
                    this.debridge.send(
                      tokenAddress,
                      receiver,
                      amount,
                      chainIdTo,
                      [],
                      false,
                      referralCode,
                      [],
                      {
                        value: amount,
                        from: alice.address,
                      }
                    ),
                    "WrongTargedChain()"
                  );
                });

                context("When transfers are stoped (pause)", () => {
                  beforeEach(async function () {
                    await this.debridge.pause({ from: alice.address });
                  });
                  it("should rejects if transfers were stopped by admin", async function () {
                    const tokenAddress = ZERO_ADDRESS;
                    const receiver = bob.address;
                    const amount = toWei("1");
                    const chainIdTo = 42;

                    await expectRevert(
                      this.debridge.send(
                        tokenAddress,
                        receiver,
                        amount,
                        chainIdTo,
                        [],
                        false,
                        referralCode,
                        [],
                        {
                          value: amount,
                          from: alice.address,
                        }
                      ),
                      "Pausable: paused"
                    );
                  });
                });
              });
            }
          });
        });
      });
    });
  });
});
