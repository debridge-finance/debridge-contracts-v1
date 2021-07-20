const { expectRevert } = require("@openzeppelin/test-helpers");
const FullAggregator = artifacts.require("FullAggregator");
const { toWei, fromWei, toBN } = web3.utils;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

contract("FullAggregator", function([alice, bob, carol, eve, devid]) {
  //TODO: add tests confirmNewAsset
  before(async function() {
    this.minConfirmations = 2;
    this.confirmationThreshold = 5; //Confirmations per block before extra check enabled.
    this.excessConfirmations = 3; //Confirmations count in case of excess activity.

    // constructor(
    //   uint256 _minConfirmations,
    //   uint256 _confirmationThreshold,
    //   uint256 _excessConfirmations,
    //   address _wrappedAssetAdmin,
    //   address _debridgeAddress
    // )

    this.aggregator = await FullAggregator.new(
      this.minConfirmations,
      this.confirmationThreshold,
      this.excessConfirmations,
      alice,
      ZERO_ADDRESS,
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
    const confirmationThreshold = await this.aggregator.confirmationThreshold();
    const excessConfirmations = await this.aggregator.excessConfirmations();
    assert.equal(minConfirmations, this.minConfirmations);
    assert.equal(confirmationThreshold, this.confirmationThreshold);
    assert.equal(excessConfirmations, this.excessConfirmations);
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

    it("should set excessConfirmations if called by the admin", async function() {
      const newExcessConfirmations = 5;
      await this.aggregator.setExcessConfirmations(newExcessConfirmations, {
        from: alice,
      });
      const excessConfirmations = await this.aggregator.excessConfirmations();
      assert.equal(excessConfirmations, newExcessConfirmations);
    });

    it("should set confirmationThreshold if called by the admin", async function() {
      const newThreshold = 5;
      await this.aggregator.setThreshold(newThreshold, {
        from: alice,
      });
      const confirmationThreshold = await this.aggregator.confirmationThreshold();
      assert.equal(confirmationThreshold, newThreshold);
    });

    it("should add new oracle if called by the admin", async function() {
      await this.aggregator.addOracle(devid, eve, {
        from: alice,
      });
      const oracleInfo = await this.aggregator.getOracleInfo(devid);
      //oracleInfo is admin address of oracle
      assert.equal(oracleInfo, eve);
    });

    it("should remove existed oracle if called by the admin", async function() {
      //TODO: fix test need to check role
      await this.aggregator.removeOracle(devid, {
        from: alice,
      });
      const oracleInfo = await this.aggregator.getOracleInfo(devid);
      assert.equal(oracleInfo, eve);
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

    it("should reject setting excessConfirmations if called by the non-admin", async function() {
      const newConfirmations = 2;
      await expectRevert(
        this.aggregator.setExcessConfirmations(newConfirmations, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject setting confirmationThreshold if called by the non-admin", async function() {
      const newConfirmations = 2;
      await expectRevert(
        this.aggregator.setThreshold(newConfirmations, {
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
      await this.dbrToken.mint(alice, amount, {
        from: alice,
      });
    });
  });

  context("Test data submission", () => {
    it("should submit mint identifier by the oracle", async function() {
      const submission =
        "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";

      await this.aggregator.submit(submission, {
        from: bob,
      });
      const mintInfo = await this.aggregator.getSubmissionInfo(submission);
      assert.equal(mintInfo.confirmations, 1);
    });

    it("should submit burnt identifier by the oracle", async function() {
      const submission =
        "0x80584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
     
      await this.aggregator.submit(submission, {
        from: bob,
      });
      const burntInfo = await this.aggregator.getSubmissionInfo(submission);
      assert.equal(burntInfo.confirmations, 1);
    });

    it("should submit mint identifier by the second oracle", async function() {
      const submission =
        "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
     
      await this.aggregator.submit(submission, {
        from: alice,
      });
      const mintInfo = await this.aggregator.getSubmissionInfo(submission);     
      assert.equal(mintInfo.confirmations, 2);
    });

    it("should submit burnt identifier by the second oracle", async function() {
      const submission =
        "0x80584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      await this.aggregator.submit(submission, {
        from: alice,
      });
      const burntInfo = await this.aggregator.getSubmissionInfo(submission);
      assert.equal(burntInfo.confirmations, 2);
    });

    it("should submit mint identifier by the extra oracle", async function() {
      const submission =
        "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
        
      await this.aggregator.submit(submission, {
        from: eve,
      });
      const mintInfo = await this.aggregator.getSubmissionInfo(submission);
      assert.equal(mintInfo.confirmations, 3);
    });

    it("should submit burnt identifier by the extra oracle", async function() {
      const submission =
        "0x80584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      await this.aggregator.submit(submission, {
        from: eve,
      });
      const burntInfo = await this.aggregator.getSubmissionInfo(submission);
      assert.equal(burntInfo.confirmations, 3);
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
});
