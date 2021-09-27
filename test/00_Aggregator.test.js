const { expectRevert } = require("@openzeppelin/test-helpers");
const { toWei, fromWei, toBN } = web3.utils;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

contract("ConfirmationAggregator", function () {
  //TODO: add tests confirmNewAsset
  before(async function () {
    this.signers = await ethers.getSigners();
    aliceAccount = this.signers[0];
    bobAccount = this.signers[1];
    carolAccount = this.signers[2];
    eveAccount = this.signers[3];
    feiAccount = this.signers[4];
    devidAccount = this.signers[5];
    alice = aliceAccount.address;
    bob = bobAccount.address;
    carol = carolAccount.address;
    eve = eveAccount.address;
    fei = feiAccount.address;
    devid = devidAccount.address;

    this.minConfirmations = 2;
    this.confirmationThreshold = 5; //Confirmations per block before extra check enabled.
    this.excessConfirmations = 3; //Confirmations count in case of excess activity.

    const ConfirmationAggregator = await ethers.getContractFactory("ConfirmationAggregator", alice);

    //   function initialize(
    //     uint256 _minConfirmations,
    //     uint256 _confirmationThreshold,
    //     uint256 _excessConfirmations,
    //     address _wrappedAssetAdmin,
    //     address _debridgeAddress
    // )

    this.aggregator = await upgrades.deployProxy(ConfirmationAggregator, [
      this.minConfirmations,
      this.confirmationThreshold,
      this.excessConfirmations,
    ]);
    this.initialOracles = [alice, bob, eve];
    await this.aggregator.deployed();
    await this.aggregator
      .connect(aliceAccount)
      .addOracles(this.initialOracles, this.initialOracles.map(o => false));
  });

  it("should have correct initial values", async function () {
    const minConfirmations = await this.aggregator.minConfirmations();
    const confirmationThreshold = await this.aggregator.confirmationThreshold();
    const excessConfirmations = await this.aggregator.excessConfirmations();
    assert.equal(minConfirmations, this.minConfirmations);
    assert.equal(confirmationThreshold, this.confirmationThreshold);
    assert.equal(excessConfirmations, this.excessConfirmations);
  });

  context("Test setting configurations by different users", () => {
    it("should set min confirmations if called by the admin", async function () {
      const newConfirmations = 2;
      await this.aggregator.connect(aliceAccount).setMinConfirmations(newConfirmations);
      const minConfirmations = await this.aggregator.minConfirmations();
      assert.equal(minConfirmations, newConfirmations);
    });

    it("should set excessConfirmations if called by the admin", async function () {
      const newExcessConfirmations = 5;
      await this.aggregator.connect(aliceAccount).setExcessConfirmations(newExcessConfirmations);
      const excessConfirmations = await this.aggregator.excessConfirmations();
      assert.equal(excessConfirmations, newExcessConfirmations);
    });

    it("should set confirmationThreshold if called by the admin", async function () {
      const newThreshold = 5;
      await this.aggregator.connect(aliceAccount).setThreshold(newThreshold);
      const confirmationThreshold = await this.aggregator.confirmationThreshold();
      assert.equal(confirmationThreshold, newThreshold);
    });

    it("should revert adding new oracle if minConfirmations will be too low", async function () {
      await expectRevert(
        this.aggregator.connect(aliceAccount).addOracles([devid], [true]),
        "LowMinConfirmations()"
      );
    });

    it("should increase minConfirmations before adding new oracle", async function () {
      const newConfirmations = 3;
      await this.aggregator.connect(aliceAccount).setMinConfirmations(newConfirmations);
      const minConfirmations = await this.aggregator.minConfirmations();
      assert.equal(minConfirmations, newConfirmations);
    });

    it("should add new oracle if called by the admin", async function () {
      let isRequired = true;
      await this.aggregator.connect(aliceAccount).addOracles([devid], [isRequired]);
      const oracleInfo = await this.aggregator.getOracleInfo(devid);
      //oracleInfo is admin address of oracle
      assert.equal(oracleInfo.exist, true);
      assert.equal(oracleInfo.isValid, true);
      assert.equal(oracleInfo.required, isRequired);

      const requiredOraclesCount = await this.aggregator.requiredOraclesCount();
      assert.equal(requiredOraclesCount, 1);

      const oracleAddressesExpected = [...this.initialOracles, devid];
      // fetch all oracleAddresses array items one by - array getter works only for certain index
      let oracleAddresses = [];
      for(let i = 0; true; i++) {
        try {
          const val = await this.aggregator.oracleAddresses(i);
          oracleAddresses.push(val);
        } catch (e) {
          break;
        }
      }
      // compare 2 arrays
      assert.equal(
        JSON.stringify(oracleAddressesExpected.sort()),
        JSON.stringify(oracleAddresses.sort())
      );
    });

    it("should revert decreasing minConfirmations if value is too low", async function () {
      await expectRevert(
        this.aggregator.connect(aliceAccount).setMinConfirmations(2),
        "LowMinConfirmations()"
      );
    });

    it("should updateOracle oracle (disable) if called by the admin", async function () {
      await this.aggregator.connect(aliceAccount).updateOracle(devid, false, false);
      const oracleInfo = await this.aggregator.getOracleInfo(devid);

      assert.equal(oracleInfo.exist, true);
      assert.equal(oracleInfo.isValid, false);
      assert.equal(oracleInfo.required, false);

      const requiredOraclesCount = await this.aggregator.requiredOraclesCount();
      assert.equal(requiredOraclesCount, 0);

      const oracleAddressesExpected = [...this.initialOracles];
      // fetch all oracleAddresses array items one by - array getter works only for certain index
      let oracleAddresses = [];
      for(let i = 0; true; i++) {
        try {
          const val = await this.aggregator.oracleAddresses(i);
          oracleAddresses.push(val);
        } catch (e) {
          break;
        }
      }
      // compare 2 arrays
      assert.equal(
        JSON.stringify(oracleAddressesExpected.sort()),
        JSON.stringify(oracleAddresses.sort())
      );
    });

    it("should decrease minConfirmations after disabling oracle", async function () {
      const newConfirmations = 2;
      await this.aggregator.connect(aliceAccount).setMinConfirmations(newConfirmations);
      const minConfirmations = await this.aggregator.minConfirmations();
      assert.equal(minConfirmations, newConfirmations);
    });

    it("should revert enabling oracle if minConfirmations will be too low", async function () {
      await expectRevert(
        this.aggregator.connect(aliceAccount).updateOracle(devid, true, false),
        "LowMinConfirmations()"
      );
    });

    it("should reject setting min confirmations if called by the non-admin", async function () {
      const newConfirmations = 2;
      await expectRevert(
        this.aggregator.connect(bobAccount).setMinConfirmations(newConfirmations),
        "AdminBadRole()"
      );
    });

    it("should reject setting excessConfirmations if called by the non-admin", async function () {
      const newConfirmations = 2;
      await expectRevert(
        this.aggregator.connect(bobAccount).setExcessConfirmations(newConfirmations),
        "AdminBadRole()"
      );
    });

    it("should reject setting confirmationThreshold if called by the non-admin", async function () {
      const newConfirmations = 2;
      await expectRevert(
        this.aggregator.connect(bobAccount).setThreshold(newConfirmations),
        "AdminBadRole()"
      );
    });

    it("should reject adding the new oracle if called by the non-admin", async function () {
      await expectRevert(
        this.aggregator.connect(bobAccount).addOracles([devid], [false]),
        "AdminBadRole()"
      );
    });

    it("should reject removing the new oracle if called by the non-admin", async function () {
      await expectRevert(
        this.aggregator.connect(bobAccount).updateOracle(devid, false, false),
        "AdminBadRole()"
      );
    });
  });

  context("Test funding the contract", () => {
    before(async function () {
      const amount = toWei("100");
      await this.linkToken.connect(aliceAccount).mint(alice, amount);
      await this.dbrToken.connect(aliceAccount).mint(alice, amount);
    });
  });

  context("Test data submission", () => {
    it("should submit mint identifier by the oracle", async function () {
      const submission = "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";

      await this.aggregator.connect(bobAccount).submit(submission);
      const mintInfo = await this.aggregator.getSubmissionInfo(submission);
      assert.equal(mintInfo.confirmations, 1);
    });

    it("should submit burnt identifier by the oracle", async function () {
      const submission = "0x80584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";

      await this.aggregator.connect(bobAccount).submit(submission);
      const burntInfo = await this.aggregator.getSubmissionInfo(submission);
      assert.equal(burntInfo.confirmations, 1);
    });

    it("should submit mint identifier by the second oracle", async function () {
      const submission = "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";

      await this.aggregator.connect(aliceAccount).submit(submission);
      const mintInfo = await this.aggregator.getSubmissionInfo(submission);
      assert.equal(mintInfo.confirmations, 2);
    });

    it("should submit burnt identifier by the second oracle", async function () {
      const submission = "0x80584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      await this.aggregator.connect(aliceAccount).submit(submission);
      const burntInfo = await this.aggregator.getSubmissionInfo(submission);
      assert.equal(burntInfo.confirmations, 2);
    });

    it("should submit mint identifier by the extra oracle", async function () {
      const submission = "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";

      await this.aggregator.connect(eveAccount).submit(submission);
      const mintInfo = await this.aggregator.getSubmissionInfo(submission);
      assert.equal(mintInfo.confirmations, 3);
    });

    it("should submit burnt identifier by the extra oracle", async function () {
      const submission = "0x80584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      await this.aggregator.connect(eveAccount).submit(submission);
      const burntInfo = await this.aggregator.getSubmissionInfo(submission);
      assert.equal(burntInfo.confirmations, 3);
    });

    it("should reject submition of mint identifier if called by the non-admin", async function () {
      const submission = "0x2a16bc164de069184383a55bbddb893f418fd72781f5b2db1b68de1dc697ea44";
      await expectRevert(
        this.aggregator.connect(devidAccount).submit(submission),
        "OracleBadRole()"
      );
    });

    it("should reject submition of burnt identifier if called by the non-admin", async function () {
      const submission = "0x2a16bc164de069184383a55bbddb893f418fd72781f5b2db1b68de1dc697ea44";
      await expectRevert(
        this.aggregator.connect(devidAccount).submit(submission),
        "OracleBadRole()"
      );
    });

    it("should reject submition of dublicated mint identifiers with the same id by the same oracle", async function () {
      const submission = "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      await expectRevert(
        this.aggregator.connect(bobAccount).submit(submission),
        "SubmittedAlready()"
      );
    });

    it("should reject submition of dublicated burnt identifiers with the same id by the same oracle", async function () {
      const submission = "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      await expectRevert(
        this.aggregator.connect(bobAccount).submit(submission),
        "SubmittedAlready()"
      );
    });
  });
});
