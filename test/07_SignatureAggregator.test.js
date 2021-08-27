const { expectRevert } = require("@openzeppelin/test-helpers");
const { assert } = require("hardhat");
const { toWei } = web3.utils;


function parseHexString(str) { 
  var result = [];
  str = str.substring(2, str.length);
  while (str.length >= 2) { 
      result.push(parseInt(str.substring(0, 2), 16));

      str = str.substring(2, str.length);
  }

  return result;
}

contract("SignatureAggregator", function () {
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

    const SignatureAggregator = await ethers.getContractFactory("SignatureAggregator", alice);

    this.aggregator = await upgrades.deployProxy(SignatureAggregator, [
      this.minConfirmations
    ]);
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
    await this.aggregator.deployed();

    for (let oracle of this.initialOracles) {
      await this.aggregator
        .connect(aliceAccount)
        .addOracles([oracle.address], [oracle.admin], [false]);
    }
  });

  it("should have correct initial values", async function () {
    const minConfirmations = await this.aggregator.minConfirmations();
    assert.equal(minConfirmations, this.minConfirmations);
  });

  context("Test setting configurations by different users", () => {
    it("should set min confirmations if called by the admin", async function () {
      const newConfirmations = 2;
      await this.aggregator.connect(aliceAccount).setMinConfirmations(newConfirmations);
      const minConfirmations = await this.aggregator.minConfirmations();
      assert.equal(minConfirmations, newConfirmations);
    });

    it("should add new oracle if called by the admin", async function () {
      let isRequired = true;
      await this.aggregator.connect(aliceAccount).addOracles([devid], [eve], [isRequired]);
      const oracleInfo = await this.aggregator.getOracleInfo(devid);
      //oracleInfo is admin address of oracle
      assert.equal(oracleInfo.exist, true);
      assert.equal(oracleInfo.isValid, true);
      assert.equal(oracleInfo.required, isRequired);
      assert.equal(oracleInfo.admin, eve);

      const requiredOraclesCount = await this.aggregator.requiredOraclesCount();
      assert.equal(requiredOraclesCount, 1);
    });

    it("should updateOracle oracle (disable) if called by the admin", async function () {
      await this.aggregator.connect(aliceAccount).updateOracle(devid, false, false);
      const oracleInfo = await this.aggregator.getOracleInfo(devid);

      assert.equal(oracleInfo.exist, true);
      assert.equal(oracleInfo.isValid, false);
      assert.equal(oracleInfo.required, false);
      assert.equal(oracleInfo.admin, eve);

      const requiredOraclesCount = await this.aggregator.requiredOraclesCount();
      assert.equal(requiredOraclesCount, 0);
    });

    it("should update oracles admin if called by the admin", async function () {
      await this.aggregator.connect(aliceAccount).updateOracleAdminByOwner(devid, devid);
      const oracleInfo = await this.aggregator.getOracleInfo(devid);

      assert.equal(oracleInfo.exist, true);
      assert.equal(oracleInfo.admin, devid);

      await this.aggregator.connect(devidAccount).updateOracleAdmin(devid, alice);
      const oracleInfo1 = await this.aggregator.getOracleInfo(devid);
      assert.equal(oracleInfo1.admin, alice);
    });

    it("should reject setting min confirmations if called by the non-admin", async function () {
      const newConfirmations = 2;
      await expectRevert(
        this.aggregator.connect(bobAccount).setMinConfirmations(newConfirmations),
        "AdminBadRole()"
      );
    });

    it("should reject adding the new oracle if called by the non-admin", async function () {
      await expectRevert(
        this.aggregator.connect(bobAccount).addOracles([devid], [eve], [false]),
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
    });
  });

  context("Test submission", () => {
    it("should submit identifier by the oracle", async function () {
      const submission = "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      const signature = await bobAccount.signMessage(parseHexString(submission));

      await this.aggregator.connect(bobAccount).submit(submission, signature);
      const confirmations = await this.aggregator.getSubmissionConfirmations(submission);
      assert.equal(confirmations[0], 1);
    });

    it("should submit identifier by the second oracle", async function () {
      const submission = "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      const signature = await aliceAccount.signMessage(parseHexString(submission));

      await this.aggregator.connect(aliceAccount).submit(submission, signature);
      const confirmations = await this.aggregator.getSubmissionConfirmations(submission);
      assert.equal(confirmations[0], 2);
    });

    it("should submit identifier by the extra oracle", async function () {
      const submission = "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      const signature = await eveAccount.signMessage(parseHexString(submission));

      await this.aggregator.connect(eveAccount).submit(submission, signature);
      const confirmations = await this.aggregator.getSubmissionConfirmations(submission);
      assert.equal(confirmations[0], 3);
    });

    it("should reject submition of identifier if called by the non-admin", async function () {
      const submission = "0x2a16bc164de069184383a55bbddb893f418fd72781f5b2db1b68de1dc697ea44";
      const signature = await devidAccount.signMessage(parseHexString(submission));
      await expectRevert(
        this.aggregator.connect(devidAccount).submit(submission, signature),
        "OracleBadRole()"
      );
    });

    it("should reject submition of duplicated identifiers with the same id by the same oracle", async function () {
      const submission = "0x89584038ebea621ff70560fbaf39157324a6628536a6ba30650b3bf4fcb73aed";
      const signature = await bobAccount.signMessage(parseHexString(submission));
      await expectRevert(
        this.aggregator.connect(bobAccount).submit(submission, signature),
        "SubmittedAlready()"
      );
    });
  });

  context("Test managing assets", () => {
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    const name = "MUSD";
    const symbol = "Magic Dollar";
    const decimals = 18;
  
    it("should add new asset if called by the oracle", async function () {
      const debridgeId = await this.aggregator.getDebridgeId(chainId, tokenAddress);
      const deployId = await this.aggregator.getDeployId(debridgeId, name, symbol, decimals);

      const signature = await aliceAccount.signMessage(parseHexString(deployId));
      await this.aggregator
        .connect(aliceAccount)
        .confirmNewAsset(tokenAddress, chainId, name, symbol, decimals, signature);
      
      const deployInfo = await this.aggregator.getDeployInfo(deployId);
      assert.equal(deployInfo.confirmations, 1);
      assert.equal(deployInfo.chainId, chainId);
      assert.equal(deployInfo.decimals, decimals);
      assert.equal(deployInfo.name, name);
      assert.equal(deployInfo.symbol, symbol);
      assert.equal(deployInfo.nativeAddress, tokenAddress);
    });

    it("should reject if called by the non-oracle", async function () {
      const debridgeId = await this.aggregator.getDebridgeId(chainId, tokenAddress);
      const deployId = await this.aggregator.getDeployId(debridgeId, name, symbol, decimals);

      const signature = await devidAccount.signMessage(parseHexString(deployId));
      await expectRevert(
        this.aggregator.connect(devidAccount).confirmNewAsset(tokenAddress, chainId, name, symbol, decimals, signature),
        "OracleBadRole()"
      );
    });

    it("should reject if called by the same oracle again", async function () {
      const debridgeId = await this.aggregator.getDebridgeId(chainId, tokenAddress);
      const deployId = await this.aggregator.getDeployId(debridgeId, name, symbol, decimals);

      const signature = await aliceAccount.signMessage(parseHexString(deployId));
      await expectRevert(
        this.aggregator.connect(aliceAccount).confirmNewAsset(tokenAddress, chainId, name, symbol, decimals, signature),
        "SubmittedAlready()"
      );
    });

  });
});
