const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS, permit } = require("./utils.spec");
const MockLinkToken = artifacts.require("MockLinkToken");
const MockToken = artifacts.require("MockToken");
const WrappedAsset = artifacts.require("WrappedAsset");
const FeeProxy = artifacts.require("FeeProxy");
const CallProxy = artifacts.require("CallProxy");
const IUniswapV2Pair = artifacts.require("IUniswapV2Pair");

const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const { toWei } = web3.utils;
const MAX = web3.utils.toTwosComplement(-1);
const bobPrivKey =
  "0x79b2a2a43a1e9f325920f99a720605c9c563c61fb5ae3ebe483f83f1230512d3";

const { BigNumber } = require("ethers")

function toBN(number){
    return BigNumber.from(number.toString())
  }
const transferFeeBps = 50;
const minReservesBps = 3000;
const BPS = toBN(10000);

contract("DeBridgeGate full with auto", function () {
  let reserveAddress;
  const claimFee = toBN(toWei("0"));
  const data = "0x";

  before(async function() {
    this.signers = await ethers.getSigners()
    aliceAccount=this.signers[0]
    bobAccount=this.signers[1]
    carolAccount=this.signers[2]
    eveAccount=this.signers[3]
    feiAccount=this.signers[4]
    devidAccount=this.signers[5]
    alice=aliceAccount.address
    bob=bobAccount.address
    carol=carolAccount.address
    eve=eveAccount.address
    fei=feiAccount.address
    devid=devidAccount.address

    reserveAddress = devid
    const Debridge = await ethers.getContractFactory("DeBridgeGate",alice);
    const ConfirmationAggregator = await ethers.getContractFactory("ConfirmationAggregator",alice);
    const UniswapV2 = await deployments.getArtifact("UniswapV2Factory");
    const WETH9 = await deployments.getArtifact("WETH9");
    const UniswapV2Factory = await ethers.getContractFactory(UniswapV2.abi,UniswapV2.bytecode, alice );
    const WETH9Factory = await ethers.getContractFactory(WETH9.abi,WETH9.bytecode, alice );
    const DefiControllerFactory = await ethers.getContractFactory("DefiController", alice);

    this.mockToken = await MockToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.linkToken = await MockLinkToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.dbrToken = await MockLinkToken.new("DBR", "DBR", 18, {
      from: alice,
    });
    this.amountThreshols = toWei("1000");
    this.minConfirmations = 1;
    this.confirmationThreshold = 5; //Confirmations per block before extra check enabled.
    this.excessConfirmations = 3; //Confirmations count in case of excess activity.

    //   function initialize(
    //     uint256 _minConfirmations,
    //     uint256 _confirmationThreshold,
    //     uint256 _excessConfirmations,
    //     address _wrappedAssetAdmin,
    //     address _debridgeAddress
    // )
    this.confirmationAggregator = await upgrades.deployProxy(ConfirmationAggregator, [
      this.minConfirmations,
      this.confirmationThreshold,
      this.excessConfirmations,
      alice,
      ZERO_ADDRESS
    ]);

    await this.confirmationAggregator.deployed();

    this.initialOracles = [
      // {
      //   address: alice,
      //   admin: alice,
      // },
      {
          account: bobAccount,
          address: bob,
          admin: carol
      },
      {
          account: carolAccount,
          address: carol,
          admin: eve,
      },
      {
          account: eveAccount,
          address: eve,
          admin: carol,
      },
      {
          account: feiAccount,
          address: fei,
          admin: eve,
      },
      {
          account: devidAccount,
          address: devid,
          admin: carol,
      },
    ];
    for (let oracle of this.initialOracles) {
      await this.confirmationAggregator.addOracles([oracle.address], [oracle.admin], [false], {
        from: alice,
      });
    }
    this.uniswapFactory = await UniswapV2Factory.deploy(carol);
    this.feeProxy = await FeeProxy.new(
      this.linkToken.address,
      this.uniswapFactory.address,
      {
        from: alice,
      }
    );
    this.callProxy = await CallProxy.new({
      from: alice,
    });
    this.defiController = await upgrades.deployProxy(DefiControllerFactory, []);
    const maxAmount = toWei("1000000");
    const fixedNativeFee = toWei("0.00001");
    const isSupported = true;
    const supportedChainIds = [42, 56];
    this.weth = await WETH9Factory.deploy();

    //   function initialize(
    //     uint256 _excessConfirmations,
    //     address _signatureVerifier,
    //     address _confirmationAggregator,
    //     address _callProxy,
    //     uint256[] memory _supportedChainIds,
    //     ChainSupportInfo[] memory _chainSupportInfo,
    //     IWETH _weth,
    //     IFeeProxy _feeProxy,
    //     IDefiController _defiController,
    //     address _treasury
    // )

    this.debridge = await upgrades.deployProxy(Debridge, [
      this.excessConfirmations,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      this.callProxy.address.toString(),
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
      ],
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      devid
    ]);
    await this.debridge.deployed();
    const GOVMONITORING_ROLE = await this.debridge.GOVMONITORING_ROLE();
    await this.debridge.grantRole(GOVMONITORING_ROLE, alice);
    await this.confirmationAggregator.setDebridgeAddress(this.debridge.address.toString());
    this.nativeDebridgeId = await this.debridge.getDebridgeId(1, ZERO_ADDRESS);
  });

  context("Test setting configurations by different users", () => {
    it("should set aggregator if called by the admin", async function() {
      const aggregator = this.confirmationAggregator.address;
      await this.debridge.setAggregator(aggregator, {
        from: alice,
      });
      const newAggregator = await this.debridge.confirmationAggregator();
      assert.equal(aggregator, newAggregator);
    });

    it("should set fee proxy if called by the admin", async function() {
      const feeProxy = this.feeProxy.address;
      await this.debridge.setFeeProxy(feeProxy, {
        from: alice,
      });
      const newFeeProxy = await this.debridge.feeProxy();
      assert.equal(feeProxy, newFeeProxy);
    });

    it("should set defi controller if called by the admin", async function() {
      const defiController = this.defiController.address;
      await this.debridge.setDefiController(defiController, {
        from: alice,
      });
      const newDefiController = await this.debridge.defiController();
      assert.equal(defiController, newDefiController);
    });

    // it("should set weth if called by the admin", async function() {
    //   const weth = this.weth.address;
    //   await this.debridge.setWeth(weth, {
    //     from: alice,
    //   });
    //   const newWeth = await this.debridge.weth();
    //   assert.equal(weth, newWeth);
    // });

    it("should reject setting aggregator if called by the non-admin", async function() {
      await expectRevert(
        this.debridge.connect(bobAccount).setAggregator(ZERO_ADDRESS),
        "bad role"
      );
    });

    it("should reject setting fee proxy if called by the non-admin", async function() {
      await expectRevert(
        this.debridge.connect(bobAccount).setFeeProxy(ZERO_ADDRESS),
        "bad role"
      );
    });

    it("should reject setting defi controller if called by the non-admin", async function() {
      await expectRevert(
        this.debridge.connect(bobAccount).setDefiController(ZERO_ADDRESS),
        "bad role"
      );
    });

    // it("should reject setting weth if called by the non-admin", async function() {
    //   await expectRevert(
    //     this.debridge.connect(bobAccount).setWeth(ZERO_ADDRESS),
    //     "onlyAdmin: bad role"
    //   );
    // });
  });

  context("Test managing assets", () => {
    before(async function() {
      currentChainId = await this.debridge.chainId();
      const newSupply = toWei("100");
      await this.linkToken.mint(alice, newSupply, {
        from: alice,
      });
      await this.dbrToken.mint(alice, newSupply, {
        from: alice,
      });
      //await this.dbrToken.transferAndCall(
      //  this.confirmationAggregator.address.toString(),
      //  newSupply,
      //  "0x",
      //  {
      //    from: alice,
      //  }
      //);
      //await this.linkToken.transferAndCall(
      //  this.confirmationAggregator.address.toString(),
      //  newSupply,
      //  "0x",
      //  {
      //    from: alice,
      //  }
      //);
    });

    const isSupported = true;
    it("should add external asset if called by the admin", async function() {
      const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      const chainId = 56;
      const maxAmount = toWei("100000000000000000");
      const amountThreshold = toWei("10000000000000");
      const fixedNativeFee = toWei("0.00001");
      const supportedChainIds = [42, 3, 56];
      const name = "MUSD";
      const symbol = "Magic Dollar";
      const decimals = 18;
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
        //   function confirmNewAsset(
        //     address _tokenAddress,
        //     uint256 _chainId,
        //     string memory _name,
        //     string memory _symbol,
        //     uint8 _decimals
        // )
      await this.confirmationAggregator.connect(this.initialOracles[0].account)
              .confirmNewAsset(tokenAddress, chainId, name, symbol, decimals);

        //   function getDeployId(
        //     bytes32 _debridgeId,
        //     string memory _name,
        //     string memory _symbol,
        //     uint8 _decimals
        // )
      // let deployId = await this.confirmationAggregator.getDeployId(debridgeId, name, symbol, decimals)
      // //function deployAsset(bytes32 _deployId)
      // await this.debridge.checkAndDeployAsset(debridgeId, {
      //   from: this.initialOracles[0].address,
      // });
      await this.debridge.updateAsset(
        debridgeId,
        maxAmount,
        minReservesBps,
        amountThreshold,
        {
          from: alice,
        }
      );
      const debridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(debridge.maxAmount.toString(), maxAmount);
      assert.equal(debridge.collectedFees.toString(), "0");
      assert.equal(debridge.balance.toString(), "0");
      assert.equal(debridge.minReservesBps.toString(), minReservesBps);
    });
  });

  context("Test send method", () => {
    it("should send native tokens from the current chain", async function() {
      const tokenAddress = ZERO_ADDRESS;
      const chainId = await this.debridge.chainId();
      const receiver = bob;
      const amount = toBN(toWei("1"));
      const chainIdTo = 42;
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const balance = toBN(await web3.eth.getBalance(this.debridge.address));
      const debridge = await this.debridge.getDebridge(debridgeId);
      const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);
      const feesWithFix = toBN(supportedChainInfo.transferFeeBps)
        .mul(amount)
        .div(BPS)
        .add(toBN(supportedChainInfo.fixedNativeFee));
      await this.debridge.autoSend(
        tokenAddress,
        receiver,
        amount,
        chainIdTo,
        reserveAddress,
        claimFee,
        data,
        false,
        {
          value: amount,
          from: alice,
        }
      );
      const newBalance = toBN(await web3.eth.getBalance(this.debridge.address));
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridge.collectedFees
          .add(feesWithFix)
          .toString(),
        newDebridge.collectedFees.toString()
      );
    });

    it("should send ERC20 tokens from the current chain", async function() {
      const tokenAddress = this.mockToken.address;
      const chainId = await this.debridge.chainId();
      const receiver = bob;
      const amount = toBN(toWei("100"));
      const chainIdTo = 42;
      await this.mockToken.mint(alice, amount, {
        from: alice,
      });
      await this.mockToken.approve(this.debridge.address, amount, {
        from: alice,
      });
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const balance = toBN(
        await this.mockToken.balanceOf(this.debridge.address)
      );
      const debridge = await this.debridge.getDebridge(debridgeId);
      const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);
      const nativeDebridgeInfo = await this.debridge.getDebridge(this.nativeDebridgeId);
      const fees = toBN(supportedChainInfo.transferFeeBps)
        .mul(amount)
        .div(BPS);
      await this.debridge.autoSend(
        tokenAddress,
        receiver,
        amount,
        chainIdTo,
        reserveAddress,
        claimFee,
        data,
        false,
        {
          value: supportedChainInfo.fixedNativeFee,
          from: alice,
        }
      );
      const newNativeDebridgeInfo = await this.debridge.getDebridge(this.nativeDebridgeId);
      const newBalance = toBN(
        await this.mockToken.balanceOf(this.debridge.address)
      );
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridge.collectedFees.add(fees).toString(),
        newDebridge.collectedFees.toString()
      );
      assert.equal(
        nativeDebridgeInfo.collectedFees
          .add(toBN(supportedChainInfo.fixedNativeFee))
          .toString(),
          newNativeDebridgeInfo.collectedFees.toString()
      );
    });

    it("should reject sending too mismatched amount of native tokens", async function() {
      const tokenAddress = ZERO_ADDRESS;
      const receiver = bob;
      const chainId = await this.debridge.chainId();
      const amount = toBN(toWei("1"));
      const chainIdTo = 42;
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.debridge.autoSend(tokenAddress, receiver, amount, chainIdTo,
          reserveAddress,
          claimFee,
          data,
          false, {
          value: toWei("0.1"),
          from: alice,
        }),
        "send: amount mismatch"
      );
    });

    it("should reject sending tokens to unsupported chain", async function() {
      const tokenAddress = ZERO_ADDRESS;
      const receiver = bob;
      const chainId = await this.debridge.chainId();
      const amount = toBN(toWei("1"));
      const chainIdTo = chainId;
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.debridge.autoSend(tokenAddress, receiver, amount, chainIdTo,
          reserveAddress,
          claimFee,
          data,
          false, {
          value: amount,
          from: alice,
        }),
        "wrong targed chain"
      );
    });
  });

  context("Test mint method", () => {
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    let receiver;
    const amount = toBN(toWei("100"));
    const nonce = 2;
    let currentChainId;
    before(async function() {
      receiver = bob
      currentChainId = await this.debridge.chainId();
      const newSupply = toWei("100");
      await this.linkToken.mint(alice, newSupply, {
        from: alice,
      });
      await this.dbrToken.mint(alice, newSupply, {
        from: alice,
      });
      //await this.dbrToken.transferAndCall(
      //  this.confirmationAggregator.address.toString(),
      //  newSupply,
      //  "0x",
      //  {
      //    from: alice,
      //  }
      //);
      //await this.linkToken.transferAndCall(
      //  this.confirmationAggregator.address.toString(),
      //  newSupply,
      //  "0x",
      //  {
      //    from: alice,
      //  }
      //);
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );

    //   function getAutoSubmisionId(
    //     bytes32 _debridgeId,
    //     uint256 _chainIdFrom,
    //     uint256 _chainIdTo,
    //     uint256 _amount,
    //     address _receiver,
    //     uint256 _nonce,
    //     address _fallbackAddress,
    //     uint256 _executionFee,
    //     bytes memory _data
    // )
      const submission = await this.debridge.getAutoSubmisionId(
        debridgeId,
        chainId,
        currentChainId,
        amount,
        receiver,
        nonce,
        reserveAddress,
        claimFee,
        data,
      );
      await this.confirmationAggregator.connect(bobAccount).submit(submission);

      let submissionInfo = await this.confirmationAggregator.getSubmissionInfo(submission);
      let submissionConfirmations = await this.confirmationAggregator.getSubmissionConfirmations(submission);

      assert.equal(1, submissionInfo.confirmations);
      assert.equal(true, submissionConfirmations[0]);
      assert.equal(1, submissionConfirmations[1]);
    });

    it("should mint when the submission is approved", async function() {
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const balance = toBN("0");

      //   function mint(
      //     address _tokenAddress,
      //     uint256 _chainId,
      //     uint256 _chainIdFrom,
      //     address _receiver,
      //     uint256 _amount,
      //     uint256 _nonce,
      //     bytes[] calldata _signatures
      // )
      await this.debridge.autoMint(
        debridgeId,
        chainId,
        receiver,
        amount,
        nonce,
        [],
        reserveAddress,
        claimFee,
        data,
        {
          from: alice,
        }
      );
      const debridge = await this.debridge.getDebridge(debridgeId);
      const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);
      const newBalance = toBN(await wrappedAsset.balanceOf(receiver));
      const submissionId = await this.debridge.getAutoSubmisionId(
        debridgeId,
        chainId,
        currentChainId,
        amount,
        receiver,
        nonce,
        reserveAddress,
        claimFee,
        data,
      );
      const isSubmissionUsed = await this.debridge.isSubmissionUsed(
        submissionId
      );
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.ok(isSubmissionUsed);
    });

    it("should reject minting with unconfirmed submission", async function() {
      const nonce = 4;
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.debridge.autoMint(
          debridgeId,
          chainId,
          receiver,
          amount,
          nonce,
          [],
          reserveAddress,
          claimFee,
          data,
          {
            from: alice,
          }
        ),
        "not confirmed"
      );
    });

    it("should reject minting twice", async function() {
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.debridge.autoMint(
          debridgeId,
          chainId,
          receiver,
          amount,
          nonce,
          [],
          reserveAddress,
          claimFee,
          data,
          {
            from: alice,
          }
        ),
        "submission already used"
      );
    });
  });

  context("Test burn method", () => {
    it("should burning when the amount is suficient", async function() {
      const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      const chainIdTo = 56;
      const receiver = alice;
      const amount = toBN(toWei("100"));
      const debridgeId = await this.debridge.getDebridgeId(
        chainIdTo,
        tokenAddress
      );
      const debridge = await this.debridge.getDebridge(debridgeId);
      const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);
      const balance = toBN(await wrappedAsset.balanceOf(bob));
      const deadline = toBN(MAX_UINT256);
      const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);
      const signature = await permit(
        wrappedAsset,
        bob,
        this.debridge.address,
        amount,
        deadline,
        bobPrivKey
      );
      const nativeDebridgeInfo = await this.debridge.getDebridge(this.nativeDebridgeId);
      await this.debridge.connect(bobAccount).autoBurn(
        debridgeId,
        receiver,
        amount,
        chainIdTo,
        reserveAddress,
        claimFee,
        data,
        deadline,
        signature,
        false,
        {
          value: supportedChainInfo.fixedNativeFee,
        }
      );
      const newNativeDebridgeInfo = await this.debridge.getDebridge(this.nativeDebridgeId);
      const newBalance = toBN(await wrappedAsset.balanceOf(bob));
      assert.equal(balance.sub(amount).toString(), newBalance.toString());
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      const fees = toBN(supportedChainInfo.transferFeeBps)
        .mul(amount)
        .div(BPS);
      assert.equal(
        debridge.collectedFees.add(fees).toString(),
        newDebridge.collectedFees.toString()
      );
      assert.equal(
        nativeDebridgeInfo.collectedFees
          .add(toBN(supportedChainInfo.fixedNativeFee))
          .toString(),
          newNativeDebridgeInfo.collectedFees.toString()
      );
    });

    it("should reject burning from current chain", async function() {
      const tokenAddress = ZERO_ADDRESS;
      const chainId = await this.debridge.chainId();
      const receiver = bob;
      const amount = toBN(toWei("1"));
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const deadline = 0;
      const signature = "0x";
      await expectRevert(
        this.debridge.autoBurn(
          debridgeId,
          receiver,
          amount,
          42,
          reserveAddress,
          claimFee,
          data,
          deadline,
          signature,
          false,
          {
            from: alice,
          }
        ),
        "wrong chain"
      );
    });
  });

  context("Test claim method", () => {
    const tokenAddress = ZERO_ADDRESS;
    let receiver;
    const amount = toBN(toWei("0.9"));
    const nonce = 4;
    let chainIdFrom = 50;
    let chainId;
    let debridgeId;
    let outsideDebridgeId;
    let erc20DebridgeId;
    before(async function() {
      receiver = bob
      chainId = await this.debridge.chainId();
      debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
      outsideDebridgeId = await this.debridge.getDebridgeId(
        56,
        "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984"
      );
      erc20DebridgeId = await this.debridge.getDebridgeId(
        chainId,
        this.mockToken.address
      );
      const cuurentChainSubmission = await this.debridge.getAutoSubmisionId(
        debridgeId,
        chainIdFrom,
        chainId,
        amount,
        receiver,
        nonce,
        reserveAddress,
        claimFee,
        data,
      );
      await this.confirmationAggregator.connect(bobAccount).submit(cuurentChainSubmission);
      const outsideChainSubmission = await this.debridge.getAutoSubmisionId(
        outsideDebridgeId,
        chainIdFrom,
        56,
        amount,
        receiver,
        nonce,
        reserveAddress,
        claimFee,
        data,
      );
      await this.confirmationAggregator.connect(bobAccount).submit(outsideChainSubmission);
      const erc20Submission = await this.debridge.getAutoSubmisionId(
        erc20DebridgeId,
        chainIdFrom,
        chainId,
        amount,
        receiver,
        nonce,
        reserveAddress,
        claimFee,
        data,
      );
      await this.confirmationAggregator.connect(bobAccount).submit(erc20Submission);
    });

    it("should claim native token when the submission is approved", async function() {
      const debridge = await this.debridge.getDebridge(debridgeId);
      const balance = toBN(await web3.eth.getBalance(receiver));
      await this.debridge.autoClaim(
        debridgeId,
        chainIdFrom,
        receiver,
        amount,
        nonce,
        [],
        reserveAddress,
        claimFee,
        data,
        {
          from: alice,
        }
      );
      const newBalance = toBN(await web3.eth.getBalance(receiver));
      const submissionId = await this.debridge.getAutoSubmisionId(
        debridgeId,
        chainIdFrom,
        await this.debridge.chainId(),
        amount,
        receiver,
        nonce,
        reserveAddress,
        claimFee,
        data,
      );
      const isSubmissionUsed = await this.debridge.isSubmissionUsed(
        submissionId
      );
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridge.collectedFees.toString(),
        newDebridge.collectedFees.toString()
      );
      assert.ok(isSubmissionUsed);
    });

    it("should claim ERC20 when the submission is approved", async function() {
      const debridge = await this.debridge.getDebridge(erc20DebridgeId);
      const balance = toBN(await this.mockToken.balanceOf(receiver));
      await this.debridge.autoClaim(
        erc20DebridgeId,
        chainIdFrom,
        receiver,
        amount,
        nonce,
        [],
        reserveAddress,
        claimFee,
        data,
        {
          from: alice,
        }
      );
      const newBalance = toBN(await this.mockToken.balanceOf(receiver));
      const submissionId = await this.debridge.getAutoSubmisionId(
        erc20DebridgeId,
        chainIdFrom,
        await this.debridge.chainId(),
        amount,
        receiver,
        nonce,
        reserveAddress,
        claimFee,
        data,
      );
      const isSubmissionUsed = await this.debridge.isSubmissionUsed(
        submissionId
      );
      const newDebridge = await this.debridge.getDebridge(erc20DebridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridge.collectedFees.toString(),
        newDebridge.collectedFees.toString()
      );
      assert.ok(isSubmissionUsed);
    });

    it("should reject claiming with unconfirmed submission", async function() {
      const nonce = 1;
      await expectRevert(
        this.debridge.autoClaim(debridgeId, chainIdFrom, receiver, amount, nonce, [],
          reserveAddress,
          claimFee,
          data, {
          from: alice,
        }),
        "not confirmed"
      );
    });

    it("should reject claiming the token from outside chain", async function() {
      await expectRevert(
        this.debridge.autoClaim(
          outsideDebridgeId,
          chainIdFrom,
          receiver,
          amount,
          nonce,
          [],
          reserveAddress,
          claimFee,
          data,
          {
            from: alice,
          }
        ),
        "not confirmed"
      );
    });

    it("should reject claiming twice", async function() {
      await expectRevert(
        this.debridge.autoClaim(debridgeId, chainIdFrom, receiver, amount, nonce, [],
          reserveAddress,
          claimFee,
          data, {
          from: alice,
        }),
        "submission already used"
      );
    });
  });
});
