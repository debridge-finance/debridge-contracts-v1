const { expectRevert } = require("@openzeppelin/test-helpers");
const Aggregator = artifacts.require("FullAggregator");
const MockLinkToken = artifacts.require("MockLinkToken");
const { toWei, fromWei, toBN } = web3.utils;

contract("FullAggregator", function([alice, bob, carol, eve, devid]) {
  before(async function() {
    this.linkToken = await MockLinkToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.oraclePayment = toWei("0.001");
    this.minConfirmations = 2;
    this.aggregator = await Aggregator.new(
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
      await this.aggregator.addOracle(oracle.address, oracle.admin, {
        from: alice,
      });
    }
  });

  it("should have correct initial values", async function() {
    const minConfirmations = await this.aggregator.minConfirmations();
    const allocatedFunds = await this.aggregator.allocatedFunds();
    const availableFunds = await this.aggregator.availableFunds();
    const payment = await this.aggregator.payment();
    const link = await this.aggregator.link();
    assert.equal(minConfirmations, this.minConfirmations);
    assert.equal(allocatedFunds, 0);
    assert.equal(availableFunds, 0);
    assert.equal(payment, this.oraclePayment);
    assert.equal(link, this.linkToken.address);
  });

  context("Test setting configurations by different users", () => {
    it("should set min confirmations if called by the admin", async function() {
      const newConfirmations = 2;
      await this.aggregator.setMinConfirmations(newConfirmations, {
        from: alice,
      });
      const minConfirmations = await this.aggregator.minConfirmations();
      assert.equal(minConfirmations, newConfirmations);
    });

    it("should set oracle payment if called by the admin", async function() {
      const newPayment = toWei("0.1");
      await this.aggregator.setPayment(newPayment, {
        from: alice,
      });
      const payment = await this.aggregator.payment();
      assert.equal(newPayment, payment);
    });

    it("should add new oracle if called by the admin", async function() {
      await this.aggregator.addOracle(devid, eve, {
        from: alice,
      });
      const oracleInfo = await this.aggregator.getOracleInfo(devid);
      assert.ok(oracleInfo.withdrawable, 0);
      assert.ok(oracleInfo.admin, eve);
    });

    it("should remove existed oracle if called by the admin", async function() {
      await this.aggregator.removeOracle(devid, {
        from: alice,
      });
      const oracleInfo = await this.aggregator.getOracleInfo(devid);
      assert.ok(oracleInfo.withdrawable, 0);
      assert.ok(oracleInfo.admin, eve);
    });

    it("should reject setting min confirmations if called by the non-admin", async function() {
      const newConfirmations = 2;
      await expectRevert(
        this.aggregator.setMinConfirmations(newConfirmations, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject setting oracle payment if called by the non-admin", async function() {
      const newPayment = toWei("0.0001");
      await expectRevert(
        this.aggregator.setPayment(newPayment, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject adding the new oracle if called by the non-admin", async function() {
      await expectRevert(
        this.aggregator.addOracle(devid, eve, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject removing the new oracle if called by the non-admin", async function() {
      await expectRevert(
        this.aggregator.removeOracle(devid, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });
  });

  context("Test funding the contract", () => {
    before(async function() {
      const amount = toWei("100");
      await this.linkToken.mint(alice, amount, {
        from: alice,
      });
    });

    it("should update virtual balances once the tokens are transfered with callback", async function() {
      const amount = toWei("10");
      const prevAvailableFunds = await this.aggregator.availableFunds();
      await this.linkToken.transferAndCall(
        this.aggregator.address.toString(),
        amount,
        "0x",
        {
          from: alice,
        }
      );
      const newAvailableFunds = await this.aggregator.availableFunds();
      assert.equal(
        prevAvailableFunds.add(toBN(amount)).toString(),
        newAvailableFunds.toString()
      );
    });

    it("should update virtual balances once the tokens are transfered and the update method is called", async function() {
      const amount = toWei("10");
      const prevAvailableFunds = await this.aggregator.availableFunds();
      await this.linkToken.transfer(
        this.aggregator.address.toString(),
        amount,
        {
          from: alice,
        }
      );
      await this.aggregator.updateAvailableFunds({
        from: alice,
      });
      const newAvailableFunds = await this.aggregator.availableFunds();
      assert.equal(
        prevAvailableFunds.add(toBN(amount)).toString(),
        newAvailableFunds.toString()
      );
    });
  });

  context("Test withdrawing unallocated funds from the contract", () => {
    it("should withdraw unallocated funds by the admin", async function() {
      const amount = toWei("5");
      const prevAvailableFunds = await this.aggregator.availableFunds();
      await this.aggregator.withdrawFunds(bob, amount, {
        from: alice,
      });
      const newAvailableFunds = await this.aggregator.availableFunds();
      assert.equal(
        prevAvailableFunds.sub(toBN(amount)).toString(),
        newAvailableFunds.toString()
      );
    });

    it("should reject withdrawing unallocated funds if called by the non-admin", async function() {
      const amount = toWei("5");
      await expectRevert(
        this.aggregator.withdrawFunds(devid, amount, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject withdrawing more than available", async function() {
      const amount = toWei("50");
      await expectRevert(
        this.aggregator.withdrawFunds(devid, amount, {
          from: alice,
        }),
        "insufficient reserve funds"
      );
    });
  });

  context("Test data submission", () => {
    it("should submit mint identifier by the oracle", async function() {
      const submission =
        "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      const prevAvailableFunds = await this.aggregator.availableFunds();
      const prevAllocatedFunds = await this.aggregator.allocatedFunds();
      const payment = await this.aggregator.payment();
      await this.aggregator.submit(submission, {
        from: bob,
      });
      const mintInfo = await this.aggregator.getSubmissionInfo(submission);
      const newAvailableFunds = await this.aggregator.availableFunds();
      const newAllocatedFunds = await this.aggregator.allocatedFunds();
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

    it("should submit burnt identifier by the oracle", async function() {
      const submission =
        "0x80584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      const prevAvailableFunds = await this.aggregator.availableFunds();
      const prevAllocatedFunds = await this.aggregator.allocatedFunds();
      const payment = await this.aggregator.payment();
      await this.aggregator.submit(submission, {
        from: bob,
      });
      const burntInfo = await this.aggregator.getSubmissionInfo(submission);
      const newAvailableFunds = await this.aggregator.availableFunds();
      const newAllocatedFunds = await this.aggregator.allocatedFunds();
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

    it("should submit mint identifier by the second oracle", async function() {
      const submission =
        "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      const prevAvailableFunds = await this.aggregator.availableFunds();
      const prevAllocatedFunds = await this.aggregator.allocatedFunds();
      const payment = await this.aggregator.payment();
      await this.aggregator.submit(submission, {
        from: alice,
      });
      const mintInfo = await this.aggregator.getSubmissionInfo(submission);
      const newAvailableFunds = await this.aggregator.availableFunds();
      const newAllocatedFunds = await this.aggregator.allocatedFunds();
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

    it("should submit burnt identifier by the second oracle", async function() {
      const submission =
        "0x80584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      const prevAvailableFunds = await this.aggregator.availableFunds();
      const prevAllocatedFunds = await this.aggregator.allocatedFunds();
      const payment = await this.aggregator.payment();
      await this.aggregator.submit(submission, {
        from: alice,
      });
      const burntInfo = await this.aggregator.getSubmissionInfo(submission);
      const newAvailableFunds = await this.aggregator.availableFunds();
      const newAllocatedFunds = await this.aggregator.allocatedFunds();
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

    it("should submit mint identifier by the extra oracle", async function() {
      const submission =
        "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      const prevAvailableFunds = await this.aggregator.availableFunds();
      const prevAllocatedFunds = await this.aggregator.allocatedFunds();
      const payment = await this.aggregator.payment();
      await this.aggregator.submit(submission, {
        from: eve,
      });
      const mintInfo = await this.aggregator.getSubmissionInfo(submission);
      const newAvailableFunds = await this.aggregator.availableFunds();
      const newAllocatedFunds = await this.aggregator.allocatedFunds();
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

    it("should submit burnt identifier by the extra oracle", async function() {
      const submission =
        "0x80584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      const prevAvailableFunds = await this.aggregator.availableFunds();
      const prevAllocatedFunds = await this.aggregator.allocatedFunds();
      const payment = await this.aggregator.payment();
      await this.aggregator.submit(submission, {
        from: eve,
      });
      const burntInfo = await this.aggregator.getSubmissionInfo(submission);
      const newAvailableFunds = await this.aggregator.availableFunds();
      const newAllocatedFunds = await this.aggregator.allocatedFunds();
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

    it("should reject submition of mint identifier if called by the non-admin", async function() {
      const submission =
        "0x2a16bc164de069184383a55bbddb893f418fd72781f5b2db1b68de1dc697ea44";
      await expectRevert(
        this.aggregator.submit(submission, {
          from: devid,
        }),
        "onlyOracle: bad role"
      );
    });

    it("should reject submition of burnt identifier if called by the non-admin", async function() {
      const submission =
        "0x2a16bc164de069184383a55bbddb893f418fd72781f5b2db1b68de1dc697ea44";
      await expectRevert(
        this.aggregator.submit(submission, {
          from: devid,
        }),
        "onlyOracle: bad role"
      );
    });

    it("should reject submition of dublicated mint identifiers with the same id by the same oracle", async function() {
      const submission =
        "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      await expectRevert(
        this.aggregator.submit(submission, {
          from: bob,
        }),
        "submit: submitted already"
      );
    });

    it("should reject submition of dublicated burnt identifiers with the same id by the same oracle", async function() {
      const submission =
        "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      await expectRevert(
        this.aggregator.submit(submission, {
          from: bob,
        }),
        "submit: submitted already"
      );
    });
  });

  context("Test withdrawal oracle reward", () => {
    it("should withdraw the reward by the oracle admin", async function() {
      const prevAvailableFunds = await this.aggregator.availableFunds();
      const prevAllocatedFunds = await this.aggregator.allocatedFunds();
      const amount = toWei("0.1");
      const prevOracleInfo = await this.aggregator.getOracleInfo(bob);
      await this.aggregator.withdrawPayment(bob, carol, amount, {
        from: carol,
      });
      const newOracleInfo = await this.aggregator.getOracleInfo(bob);
      const newAvailableFunds = await this.aggregator.availableFunds();
      const newAllocatedFunds = await this.aggregator.allocatedFunds();
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

    it("should reject withdrawing by non-admint", async function() {
      const amount = toWei("50");
      await expectRevert(
        this.aggregator.withdrawPayment(bob, carol, amount, {
          from: bob,
        }),
        "withdrawPayment: only callable by admin"
      );
    });

    it("should reject withdrawing more than available", async function() {
      const amount = toWei("50");
      await expectRevert(
        this.aggregator.withdrawPayment(bob, carol, amount, {
          from: carol,
        }),
        "withdrawPayment: insufficient withdrawable funds"
      );
    });
  });
});
