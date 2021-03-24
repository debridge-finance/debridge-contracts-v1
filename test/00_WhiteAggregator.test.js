const { expectRevert } = require("@openzeppelin/test-helpers");
const WhiteAggregator = artifacts.require("WhiteAggregator");
const MockLinkToken = artifacts.require("MockLinkToken");
const { toWei, fromWei, toBN } = web3.utils;

contract("WhiteAggregator", function ([alice, bob, carol, eve, devid]) {
  before(async function () {
    this.linkToken = await MockLinkToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.oraclePayment = toWei("0.001");
    this.minConfirmations = 2;
    this.whiteAggregator = await WhiteAggregator.new(
      this.minConfirmations,
      this.oraclePayment,
      this.linkToken.address,
      {
        from: alice,
      }
    );
    this.initialOracles = [
      {
        address: alice,
        admin: alice,
      },
      {
        address: bob,
        admin: carol,
      },
      {
        address: eve,
        admin: carol,
      },
    ];
    for (let oracle of this.initialOracles) {
      await this.whiteAggregator.addOracle(oracle.address, oracle.admin, {
        from: alice,
      });
    }
  });

  it("should have correct initial values", async function () {
    const minConfirmations = await this.whiteAggregator.minConfirmations();
    const allocatedFunds = await this.whiteAggregator.allocatedFunds();
    const availableFunds = await this.whiteAggregator.availableFunds();
    const payment = await this.whiteAggregator.payment();
    const link = await this.whiteAggregator.link();
    assert.equal(minConfirmations, this.minConfirmations);
    assert.equal(allocatedFunds, 0);
    assert.equal(availableFunds, 0);
    assert.equal(payment, this.oraclePayment);
    assert.equal(link, this.linkToken.address);
  });

  context("Test setting configurations by different users", () => {
    it("should set min confirmations if called by the admin", async function () {
      const newConfirmations = 2;
      await this.whiteAggregator.setMinConfirmations(newConfirmations, {
        from: alice,
      });
      const minConfirmations = await this.whiteAggregator.minConfirmations();
      assert.equal(minConfirmations, newConfirmations);
    });

    it("should set oracle payment if called by the admin", async function () {
      const newPayment = toWei("0.1");
      await this.whiteAggregator.setPayment(newPayment, {
        from: alice,
      });
      const payment = await this.whiteAggregator.payment();
      assert.equal(newPayment, payment);
    });

    it("should add new oracle if called by the admin", async function () {
      await this.whiteAggregator.addOracle(devid, eve, {
        from: alice,
      });
      const oracleInfo = await this.whiteAggregator.getOracleInfo(devid);
      assert.ok(oracleInfo.withdrawable, 0);
      assert.ok(oracleInfo.admin, eve);
    });

    it("should remove existed oracle if called by the admin", async function () {
      await this.whiteAggregator.removeOracle(devid, {
        from: alice,
      });
      const oracleInfo = await this.whiteAggregator.getOracleInfo(devid);
      assert.ok(oracleInfo.withdrawable, 0);
      assert.ok(oracleInfo.admin, eve);
    });

    it("should reject setting min confirmations if called by the non-admin", async function () {
      const newConfirmations = 2;
      await expectRevert(
        this.whiteAggregator.setMinConfirmations(newConfirmations, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject setting oracle payment if called by the non-admin", async function () {
      const newPayment = toWei("0.0001");
      await expectRevert(
        this.whiteAggregator.setPayment(newPayment, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject adding the new oracle if called by the non-admin", async function () {
      await expectRevert(
        this.whiteAggregator.addOracle(devid, eve, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject removing the new oracle if called by the non-admin", async function () {
      await expectRevert(
        this.whiteAggregator.removeOracle(devid, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });
  });

  context("Test funding the contract", () => {
    before(async function () {
      const amount = toWei("100");
      await this.linkToken.mint(alice, amount, {
        from: alice,
      });
    });

    it("should update virtual balances once the tokens are transfered with callback", async function () {
      const amount = toWei("10");
      const prevAvailableFunds = await this.whiteAggregator.availableFunds();
      await this.linkToken.transferAndCall(
        this.whiteAggregator.address.toString(),
        amount,
        "0x",
        {
          from: alice,
        }
      );
      const newAvailableFunds = await this.whiteAggregator.availableFunds();
      assert.equal(
        prevAvailableFunds.add(toBN(amount)).toString(),
        newAvailableFunds.toString()
      );
    });

    it("should update virtual balances once the tokens are transfered and the update method is called", async function () {
      const amount = toWei("10");
      const prevAvailableFunds = await this.whiteAggregator.availableFunds();
      await this.linkToken.transfer(
        this.whiteAggregator.address.toString(),
        amount,
        {
          from: alice,
        }
      );
      await this.whiteAggregator.updateAvailableFunds({
        from: alice,
      });
      const newAvailableFunds = await this.whiteAggregator.availableFunds();
      assert.equal(
        prevAvailableFunds.add(toBN(amount)).toString(),
        newAvailableFunds.toString()
      );
    });
  });

  context("Test withdrawing unallocated funds from the contract", () => {
    it("should withdraw unallocated funds by the admin", async function () {
      const amount = toWei("5");
      const prevAvailableFunds = await this.whiteAggregator.availableFunds();
      await this.whiteAggregator.withdrawFunds(bob, amount, {
        from: alice,
      });
      const newAvailableFunds = await this.whiteAggregator.availableFunds();
      assert.equal(
        prevAvailableFunds.sub(toBN(amount)).toString(),
        newAvailableFunds.toString()
      );
    });

    it("should reject withdrawing unallocated funds if called by the non-admin", async function () {
      const amount = toWei("5");
      await expectRevert(
        this.whiteAggregator.withdrawFunds(devid, amount, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject withdrawing more than available", async function () {
      const amount = toWei("50");
      await expectRevert(
        this.whiteAggregator.withdrawFunds(devid, amount, {
          from: alice,
        }),
        "insufficient reserve funds"
      );
    });
  });

  context("Test data submission", () => {
    it("should submit mint identifier by the oracle", async function () {
      const submission =
        "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      const prevAvailableFunds = await this.whiteAggregator.availableFunds();
      const prevAllocatedFunds = await this.whiteAggregator.allocatedFunds();
      const payment = await this.whiteAggregator.payment();
      await this.whiteAggregator.submitMint(submission, {
        from: bob,
      });
      const mintInfo = await this.whiteAggregator.getMintInfo(submission);
      const newAvailableFunds = await this.whiteAggregator.availableFunds();
      const newAllocatedFunds = await this.whiteAggregator.allocatedFunds();
      assert.equal(mintInfo.confirmations, 1);
      assert.ok(!mintInfo.confirmed);
      assert.equal(
        prevAvailableFunds.sub(toBN(payment)).toString(),
        newAvailableFunds.toString()
      );
      assert.equal(
        prevAllocatedFunds.add(toBN(payment)).toString(),
        newAllocatedFunds.toString()
      );
    });

    it("should submit burnt identifier by the oracle", async function () {
      const submission =
        "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      const prevAvailableFunds = await this.whiteAggregator.availableFunds();
      const prevAllocatedFunds = await this.whiteAggregator.allocatedFunds();
      const payment = await this.whiteAggregator.payment();
      await this.whiteAggregator.submitBurn(submission, {
        from: bob,
      });
      const burntInfo = await this.whiteAggregator.getBurntInfo(submission);
      const newAvailableFunds = await this.whiteAggregator.availableFunds();
      const newAllocatedFunds = await this.whiteAggregator.allocatedFunds();
      assert.equal(burntInfo.confirmations, 1);
      assert.ok(!burntInfo.confirmed);
      assert.equal(
        prevAvailableFunds.sub(toBN(payment)).toString(),
        newAvailableFunds.toString()
      );
      assert.equal(
        prevAllocatedFunds.add(toBN(payment)).toString(),
        newAllocatedFunds.toString()
      );
    });

    it("should submit mint identifier by the second oracle", async function () {
      const submission =
        "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      const prevAvailableFunds = await this.whiteAggregator.availableFunds();
      const prevAllocatedFunds = await this.whiteAggregator.allocatedFunds();
      const payment = await this.whiteAggregator.payment();
      await this.whiteAggregator.submitMint(submission, {
        from: alice,
      });
      const mintInfo = await this.whiteAggregator.getMintInfo(submission);
      const newAvailableFunds = await this.whiteAggregator.availableFunds();
      const newAllocatedFunds = await this.whiteAggregator.allocatedFunds();
      assert.equal(mintInfo.confirmations, 2);
      assert.ok(mintInfo.confirmed);
      assert.equal(
        prevAvailableFunds.sub(toBN(payment)).toString(),
        newAvailableFunds.toString()
      );
      assert.equal(
        prevAllocatedFunds.add(toBN(payment)).toString(),
        newAllocatedFunds.toString()
      );
    });

    it("should submit burnt identifier by the second oracle", async function () {
      const submission =
        "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      const prevAvailableFunds = await this.whiteAggregator.availableFunds();
      const prevAllocatedFunds = await this.whiteAggregator.allocatedFunds();
      const payment = await this.whiteAggregator.payment();
      await this.whiteAggregator.submitBurn(submission, {
        from: alice,
      });
      const burntInfo = await this.whiteAggregator.getBurntInfo(submission);
      const newAvailableFunds = await this.whiteAggregator.availableFunds();
      const newAllocatedFunds = await this.whiteAggregator.allocatedFunds();
      assert.equal(burntInfo.confirmations, 2);
      assert.ok(burntInfo.confirmed);
      assert.equal(
        prevAvailableFunds.sub(toBN(payment)).toString(),
        newAvailableFunds.toString()
      );
      assert.equal(
        prevAllocatedFunds.add(toBN(payment)).toString(),
        newAllocatedFunds.toString()
      );
    });

    it("should submit mint identifier by the extra oracle", async function () {
      const submission =
        "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      const prevAvailableFunds = await this.whiteAggregator.availableFunds();
      const prevAllocatedFunds = await this.whiteAggregator.allocatedFunds();
      const payment = await this.whiteAggregator.payment();
      await this.whiteAggregator.submitMint(submission, {
        from: eve,
      });
      const mintInfo = await this.whiteAggregator.getMintInfo(submission);
      const newAvailableFunds = await this.whiteAggregator.availableFunds();
      const newAllocatedFunds = await this.whiteAggregator.allocatedFunds();
      assert.equal(mintInfo.confirmations, 3);
      assert.ok(mintInfo.confirmed);
      assert.equal(
        prevAvailableFunds.sub(toBN(payment)).toString(),
        newAvailableFunds.toString()
      );
      assert.equal(
        prevAllocatedFunds.add(toBN(payment)).toString(),
        newAllocatedFunds.toString()
      );
    });

    it("should submit burnt identifier by the extra oracle", async function () {
      const submission =
        "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      const prevAvailableFunds = await this.whiteAggregator.availableFunds();
      const prevAllocatedFunds = await this.whiteAggregator.allocatedFunds();
      const payment = await this.whiteAggregator.payment();
      await this.whiteAggregator.submitBurn(submission, {
        from: eve,
      });
      const burntInfo = await this.whiteAggregator.getBurntInfo(submission);
      const newAvailableFunds = await this.whiteAggregator.availableFunds();
      const newAllocatedFunds = await this.whiteAggregator.allocatedFunds();
      assert.equal(burntInfo.confirmations, 3);
      assert.ok(burntInfo.confirmed);
      assert.equal(
        prevAvailableFunds.sub(toBN(payment)).toString(),
        newAvailableFunds.toString()
      );
      assert.equal(
        prevAllocatedFunds.add(toBN(payment)).toString(),
        newAllocatedFunds.toString()
      );
    });

    it("should reject submition of mint identifier if called by the non-admin", async function () {
      const submission =
        "0x2a16bc164de069184383a55bbddb893f418fd72781f5b2db1b68de1dc697ea44";
      await expectRevert(
        this.whiteAggregator.submitMint(submission, {
          from: devid,
        }),
        "onlyOracle: bad role"
      );
    });

    it("should reject submition of burnt identifier if called by the non-admin", async function () {
      const submission =
        "0x2a16bc164de069184383a55bbddb893f418fd72781f5b2db1b68de1dc697ea44";
      await expectRevert(
        this.whiteAggregator.submitBurn(submission, {
          from: devid,
        }),
        "onlyOracle: bad role"
      );
    });

    it("should reject submition of dublicated mint identifiers with the same id by the same oracle", async function () {
      const submission =
        "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      await expectRevert(
        this.whiteAggregator.submitMint(submission, {
          from: bob,
        }),
        "submit: submitted already"
      );
    });

    it("should reject submition of dublicated burnt identifiers with the same id by the same oracle", async function () {
      const submission =
        "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      await expectRevert(
        this.whiteAggregator.submitBurn(submission, {
          from: bob,
        }),
        "submit: submitted already"
      );
    });
  });

  context("Test withdrawal oracle reward", () => {
    it("should withdraw the reward by the oracle admin", async function () {
      const prevAvailableFunds = await this.whiteAggregator.availableFunds();
      const prevAllocatedFunds = await this.whiteAggregator.allocatedFunds();
      const amount = toWei("0.1");
      const prevOracleInfo = await this.whiteAggregator.getOracleInfo(bob);
      await this.whiteAggregator.withdrawPayment(bob, carol, amount, {
        from: carol,
      });
      const newOracleInfo = await this.whiteAggregator.getOracleInfo(bob);
      const newAvailableFunds = await this.whiteAggregator.availableFunds();
      const newAllocatedFunds = await this.whiteAggregator.allocatedFunds();
      assert.equal(
        prevOracleInfo.withdrawable.sub(toBN(amount)).toString(),
        newOracleInfo.withdrawable.toString()
      );
      assert.equal(prevAvailableFunds.toString(), newAvailableFunds.toString());
      assert.equal(
        prevAllocatedFunds.sub(toBN(amount)).toString(),
        newAllocatedFunds.toString()
      );
    });

    it("should reject withdrawing by non-admint", async function () {
      const amount = toWei("50");
      await expectRevert(
        this.whiteAggregator.withdrawPayment(bob, carol, amount, {
          from: bob,
        }),
        "withdrawPayment: only callable by admin"
      );
    });

    it("should reject withdrawing more than available", async function () {
      const amount = toWei("50");
      await expectRevert(
        this.whiteAggregator.withdrawPayment(bob, carol, amount, {
          from: carol,
        }),
        "withdrawPayment: insufficient withdrawable funds"
      );
    });
  });
});
