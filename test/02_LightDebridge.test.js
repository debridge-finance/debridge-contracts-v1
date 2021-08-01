const Web3 = require("web3");
const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS, permit } = require("./utils.spec");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const MockLinkToken = artifacts.require("MockLinkToken");
const MockToken = artifacts.require("MockToken");
const WrappedAsset = artifacts.require("WrappedAsset");
const CallProxy = artifacts.require("CallProxy");
const DefiController = artifacts.require("DefiController");
const { toWei } = web3.utils;
const { BigNumber } = require("ethers")
const MAX = web3.utils.toTwosComplement(-1);
const Tx = require("ethereumjs-tx");
const bscWeb3 = new Web3(process.env.TEST_BSC_PROVIDER);
const oracleKeys = JSON.parse(process.env.TEST_ORACLE_KEYS);
const bobPrivKey =
  "0x79b2a2a43a1e9f325920f99a720605c9c563c61fb5ae3ebe483f83f1230512d3";

function toBN(number){
    return BigNumber.from(number.toString())
  }

const transferFeeBps = 50;
const minReservesBps = 3000;
const BPS = toBN(10000);

contract("DeBridgeGate light mode", function() {
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

    const Debridge = await ethers.getContractFactory("DeBridgeGate", alice);
    const ConfirmationAggregator = await ethers.getContractFactory("ConfirmationAggregator",alice);
    const SignatureVerifier = await ethers.getContractFactory("SignatureVerifier",alice);
    
    const WETH9 = await deployments.getArtifact("WETH9");
    const WETH9Factory = await ethers.getContractFactory(WETH9.abi,WETH9.bytecode, alice );
    this.mockToken = await MockToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.linkToken = await MockLinkToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.dbrToken = await MockLinkToken.new("DBR", "DBR", 18, {
      from: alice,
    });
    this.amountThreshold = toWei("1000");
    this.minConfirmations = 3;
    //this.confirmationAggregatorAddress = "0x72736f8c88bd1e438b05acc28c58ac21c5dc76ce";
    //this.aggregatorInstance = new web3.eth.Contract(
    //  ConfirmationAggregator.abi,
    //  this.confirmationAggregatorAddress
    //);
    this.confirmationThreshold = 5; //Confirmations per block before extra check enabled.
    this.excessConfirmations = 4; //Confirmations count in case of excess activity.

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
    //   function initialize(
    //     uint256 _minConfirmations,
    //     uint256 _confirmationThreshold,
    //     uint256 _excessConfirmations,
    //     address _wrappedAssetAdmin,
    //     address _debridgeAddress
    // )
    this.signatureVerifier = await upgrades.deployProxy(SignatureVerifier, [
      this.minConfirmations,
      this.confirmationThreshold,
      this.excessConfirmations,
      alice,
      ZERO_ADDRESS
    ]);
    await this.signatureVerifier.deployed();
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
      await this.signatureVerifier.addOracle(oracle.address, oracle.address, false, {
        from: alice,
      });
    }

    //Alice is required oracle
    await this.signatureVerifier.addOracle(alice, alice, true, {
      from: alice,
    });

    this.defiController = await DefiController.new({
      from: alice,
    });
    this.callProxy = await CallProxy.new({
      from: alice,
    });
    const maxAmount = toWei("100000000000");
    const fixedNativeFee = toWei("0.00001");
    const isSupported = true;
    const supportedChainIds =[42, 56];
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
      this.signatureVerifier.address.toString(),
      this.confirmationAggregator.address.toString(),
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

    await this.signatureVerifier.setDebridgeAddress(this.debridge.address.toString());
  });

  context("Test setting configurations by different users", () => {
    it("should set Verifier if called by the admin", async function() {
      await this.debridge.setSignatureVerifier(this.signatureVerifier.address, {
        from: alice,
      });
      const newAggregator = await this.debridge.signatureVerifier();
      assert.equal(this.signatureVerifier.address, newAggregator);
    });

    it("should set defi controller if called by the admin", async function() {
      const defiController = this.defiController.address;
      await this.debridge.setDefiController(defiController, {
        from: alice,
      });
      const newDefiController = await this.debridge.defiController();
      assert.equal(defiController, newDefiController);
    });

    it("should reject setting Verifier if called by the non-admin", async function() {
      await expectRevert(
        this.debridge.connect(bobAccount).setSignatureVerifier(ZERO_ADDRESS),
        "onlyAdmin: bad role"
      );
    });

    it("should reject setting defi controller if called by the non-admin", async function() {
      await expectRevert(
        this.debridge.connect(bobAccount).setDefiController(ZERO_ADDRESS),
        "onlyAdmin: bad role"
      );
    });
  });

  context("Test managing assets", () => {
    const isSupported = true;
    it("should add external asset if called by the admin", async function() {
      const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      const chainId = 56;
      const maxAmount = toWei("100000000000");
      const amountThreshold = toWei("10000000000000");
      const fixedFee = toWei("0.00001");
      const supportedChainIds = [42, 3];
      const name = "MUSD";
      const symbol = "Magic Dollar";
      const decimals = 18;

      //   function confirmNewAsset(
      //     address _tokenAddress,
      //     uint256 _chainId,
      //     string memory _name,
      //     string memory _symbol,
      //     uint8 _decimals,
      //     bytes[] memory _signatures
      // ) 
      const debridgeId = await this.signatureVerifier.getDebridgeId(chainId, tokenAddress);
      //console.log('debridgeId '+debridgeId);
      const deployId = await this.signatureVerifier.getDeployId(debridgeId, name, symbol, decimals);

      let signatures = [];
      for (let i = 0; i < oracleKeys.length; i++) {
        const oracleKey = oracleKeys[i];
        signatures.push(
          (await bscWeb3.eth.accounts.sign(deployId, oracleKey)).signature
        );
      }
      await this.signatureVerifier.connect(this.initialOracles[0].account)
          .confirmNewAsset(tokenAddress, chainId, name, symbol, decimals, signatures);
      
      ////   function getDeployId(
      ////     bytes32 _debridgeId,
      ////     string memory _name,
      ////     string memory _symbol,
      ////     uint8 _decimals
      //// )
      ////function deployAsset(bytes32 _deployId)
      //await this.signatureVerifier.deployAsset(deployId, {
      //  from: this.initialOracles[0].address,
      //});

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

     it("should reject add external asset without DSRM confirmation", async function() {
      const tokenAddress = "0x5A0b54D5dc17e0AadC383d2db43B0a0D3E029c4c";
      const chainId = 56;
      const name = "SPARK";
      const symbol = "SPARK Dollar";
      const decimals = 18;

      const debridgeId = await this.signatureVerifier.getDebridgeId(chainId, tokenAddress);
      //console.log('debridgeId '+debridgeId);
      const deployId = await this.signatureVerifier.getDeployId(debridgeId, name, symbol, decimals);

      let signatures = [];
      //start from 1 (skipped alice)
      for (let i = 1; i < oracleKeys.length; i++) {
        const oracleKey = oracleKeys[i];
        signatures.push(
          (await bscWeb3.eth.accounts.sign(deployId, oracleKey)).signature
        );
      }

      await expectRevert(
          this.signatureVerifier.confirmNewAsset(tokenAddress, chainId, name, symbol, decimals, signatures, {
          from: alice,
        }),
        "Not confirmed by required oracles"
      );
    });

    it("should reject add external asset without -1 confirmation", async function() {
      const tokenAddress = "0x5A0b54D5dc17e0AadC383d2db43B0a0D3E029c4c";
      const chainId = 56;
      const name = "MUSD";
      const symbol = "Magic Dollar";
      const decimals = 18;

      const debridgeId = await this.signatureVerifier.getDebridgeId(chainId, tokenAddress);
      //console.log('debridgeId '+debridgeId);
      const deployId = await this.signatureVerifier.getDeployId(debridgeId, name, symbol, decimals);

      let signatures = [];
      // count of oracles = this.minConfirmations - 1
      for (let i = 0; i < this.minConfirmations - 1; i++) {
        const oracleKey = oracleKeys[i];
        signatures.push(
          (await bscWeb3.eth.accounts.sign(deployId, oracleKey)).signature
        );
      }

      await expectRevert(
          this.signatureVerifier.confirmNewAsset(tokenAddress, chainId, name, symbol, decimals, signatures, {
          from: alice,
        }),
        "not confirmed"
      );
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
      const fees = toBN(supportedChainInfo.transferFeeBps)
        .mul(amount)
        .div(BPS);
      const collectedNativeFees = await this.debridge.collectedFees();
      await this.debridge.send(
        tokenAddress,
        receiver,
        amount,
        chainIdTo,
        false,
        {
          value: amount,
          from: alice,
        }
      );
      const newBalance = toBN(await web3.eth.getBalance(this.debridge.address));
      const newCollectedNativeFees = await this.debridge.collectedFees();
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.equal(
        debridge.collectedFees
          .add(toBN(supportedChainInfo.fixedNativeFee))
          .add(fees)
          .toString(),
        newDebridge.collectedFees.toString()
      );
      assert.equal(
        collectedNativeFees.toString(),
        newCollectedNativeFees.toString()
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
      const collectedNativeFees = await this.debridge.collectedFees();
      const fees = toBN(supportedChainInfo.transferFeeBps)
        .mul(amount)
        .div(BPS);
      await this.debridge.send(
        tokenAddress,
        receiver,
        amount,
        chainIdTo,
        false,
        {
          value: supportedChainInfo.fixedNativeFee,
          from: alice,
        }
      );
      const newCollectedNativeFees = await this.debridge.collectedFees();
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
        collectedNativeFees
          .add(toBN(supportedChainInfo.fixedNativeFee))
          .toString(),
        newCollectedNativeFees.toString()
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
        this.debridge.send(tokenAddress, receiver, amount, chainIdTo, false, {
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
        this.debridge.send(tokenAddress, receiver, amount, chainIdTo, false, {
          value: amount,
          from: alice,
        }),
        "send: wrong targed chain"
      );
    });
  });

  context("Test mint method", () => {
    let debridgeId;
    let receiver;
    const amount = toBN(toWei("100"));
    const nonce = 1;
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    let currentChainId;

    before(async function() {
      receiver = bob;
      debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
      //console.log('debridgeId '+debridgeId);
      currentChainId = await this.debridge.chainId();
      const submission = await this.debridge.getSubmisionId(
        debridgeId,
        chainId,
        currentChainId,
        amount,
        receiver,
        nonce
      );
      this.signatures = [];
      for (let i = 0; i < oracleKeys.length; i++) {
        const oracleKey = oracleKeys[i];
        this.signatures.push(
          (await bscWeb3.eth.accounts.sign(submission, oracleKey)).signature
        );
      }
    });

    it("should mint when the submission is approved", async function() {
      const balance  = toBN("0");

    //   function mint(
    //     address _tokenAddress,
    //     uint256 _chainId,
    //     uint256 _chainIdFrom,
    //     address _receiver,
    //     uint256 _amount,
    //     uint256 _nonce,
    //     bytes[] calldata _signatures
    // )
      await this.debridge.mint(
        debridgeId,
        chainId,
        receiver,
        amount,
        nonce,
        this.signatures,
        {
          from: alice,
        }
      );
      const debridge = await this.debridge.getDebridge(debridgeId);
      const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);

      const newBalance = toBN(await wrappedAsset.balanceOf(receiver));
      const submissionId = await this.debridge.getSubmisionId(
        debridgeId,
        chainId,
        currentChainId,
        amount,
        receiver,
        nonce
      );
      const isSubmissionUsed = await this.debridge.isSubmissionUsed(
        submissionId
      );
      assert.equal(balance.add(amount).toString(), newBalance.toString());
      assert.ok(isSubmissionUsed);
    });


      // it("should update asset if called by the admin after deploy assets by mint", async function () {
      //     const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      //     const chainId = 56;
      //     const maxAmount = toWei("100000000000");
      //     const amountThreshold = toWei("10000000000000");
      //     const fixedFee = toWei("0.00001");
      //     const transferFee = toWei("0.01");
      //     const minReserves = toWei("0.2");
      //     const supportedChainIds = [42, 3];
      //     const name = "MUSD";
      //     const symbol = "Magic Dollar";
      //     const decimals = 18;

      //     await this.debridge.updateAsset(
      //       debridgeId,
      //       maxAmount,
      //       minReserves,
      //       amountThreshold,
      //       {
      //         from: alice,
      //       }
      //     );
      //     const debridge = await this.debridge.getDebridge(debridgeId);
      //     assert.equal(debridge.maxAmount.toString(), maxAmount);
      //     assert.equal(debridge.collectedFees.toString(), "0");
      //     assert.equal(debridge.balance.toString(), "0");
      //     assert.equal(debridge.minReserves.toString(), minReserves);
      // });

    it("should reject minting with unconfirmed submission", async function() {
      const wrongnonce = 4;
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.debridge.mint(debridgeId, chainId, receiver, amount, wrongnonce, [], {//will call IConfirmationAggregator
          from: alice,
        }),
         "not confirmed"
      );
    });

    it("should reject minting with error signature", async function() {
      const wrongnonce = 4;
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.debridge.mint(debridgeId, chainId, receiver, amount, wrongnonce, this.signatures, {
          from: alice,
        }),
        // "not confirmed"
        "Not confirmed by required oracles"
      );
    });

    it("should reject minting twice", async function() {
      const debridgeId = await this.debridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.debridge.mint(debridgeId, chainId, receiver, amount, nonce, this.signatures, {
          from: alice,
        }),
        "submit: submitted already"
        //"mint: already used"
      );
    });
  });

  context("Test burn method", () => {
    it("should burning when the amount is suficient", async function() {
      const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      const chainIdTo = 56;
      const receiver = alice;
      const amount = toBN(toWei("5"));
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
      const collectedNativeFees = await this.debridge.collectedFees();
      await this.debridge.connect(bobAccount).burn(
        debridgeId,
        receiver,
        amount,
        chainIdTo,
        deadline,
        signature,
        false,
        {
          value: supportedChainInfo.fixedNativeFee,
        }
      );
      const newCollectedNativeFees = await this.debridge.collectedFees();
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
        collectedNativeFees
        //TODO: check wrong native + token fee
          .add(toBN(supportedChainInfo.fixedNativeFee))
          .toString(),
        newCollectedNativeFees.toString()
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
        this.debridge.burn(
          debridgeId,
          receiver,
          amount,
          42,
          deadline,
          signature,
          {
            from: alice,
          }
        ),
        "burn: native asset"
      );
    });

  //TODO: check 'send: amount does not cover fees' when pay by token
  //   it("should reject burning too few tokens", async function() {
  //     const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
  //     const chainIdTo = 56;
  //     const receiver = bob;
  //     const amount = toBN("10");
  //     const debridgeId = await this.debridge.getDebridgeId(
  //       chainIdTo,
  //       tokenAddress
  //       );
  //     const debridge = await this.debridge.getDebridge(debridgeId);
  //     const wrappedAsset = await WrappedAsset.at(debridge.tokenAddress);
  //     //const balance = toBN(await wrappedAsset.balanceOf(bob));
  //     const deadline = 0;
  //     const supportedChainInfo = await this.debridge.getChainSupport(chainIdTo);
  //     //const signature = "0x";
  //     const signature = await permit(
  //           wrappedAsset,
  //           bob,
  //           this.debridge.address,
  //           amount,
  //           deadline,
  //           bobPrivKey
  //       );
  //     await expectRevert(
  //       this.debridge.burn(
  //         debridgeId,
  //         receiver,
  //         amount,
  //         chainIdTo,
  //         deadline,
  //         signature,
  //         false,
  //         {
  //           from: bob,
  //           value: supportedChainInfo.fixedNativeFee,
  //         }
  //       ),
  //       "burn: amount too low"
  //     );
  //   });
  });

  context("Test claim method", () => {
    const tokenAddress = ZERO_ADDRESS;
    let receiver;
    const amount = toBN(toWei("0.9"));
    const nonce = 4;
    let chainId;
    let chainIdFrom = 87;
    let debridgeId;
    let erc20DebridgeId;
    let curentChainSubmission;

    before(async function() {
      receiver = bob;
      chainId = await this.debridge.chainId();
      debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
      erc20DebridgeId = await this.debridge.getDebridgeId(
        chainId,
        this.mockToken.address
      );
      curentChainSubmission = await this.debridge.getSubmisionId(
        debridgeId,
        chainIdFrom,
        chainId,
        amount,
        receiver,
        nonce
      );
      this.ethSignatures = [];
      for (let i = 0; i < oracleKeys.length; i++) {
        const oracleKey = oracleKeys[i];
        this.ethSignatures.push(
          (await bscWeb3.eth.accounts.sign(curentChainSubmission, oracleKey))
            .signature
        );
      }
      const erc20Submission = await this.debridge.getSubmisionId(
        erc20DebridgeId,
        chainIdFrom,
        chainId,
        amount,
        receiver,
        nonce
      );
      this.erc20Signatures = [];
      for (let i = 0; i < oracleKeys.length; i++) {
        const oracleKey = oracleKeys[i];
        this.erc20Signatures.push(
          (await bscWeb3.eth.accounts.sign(erc20Submission, oracleKey))
            .signature
        );
      }
    });

    it("should reject native token without DSRM confirmation", async function() {
      let currentSignatures = [];
      for (let i = 1; i < oracleKeys.length; i++) {
        const oracleKey = oracleKeys[i];
        currentSignatures.push(
          (await bscWeb3.eth.accounts.sign(curentChainSubmission, oracleKey))
            .signature
        );
      }
      await expectRevert(
        this.debridge.claim(
          debridgeId,
          chainIdFrom,
          receiver,
          amount,
          nonce,
          currentSignatures,
          {
            from: alice,
          }
        ),
        "Not confirmed by required oracles"
      );
    });

    it("should claim native token when the submission is approved", async function() {
      const debridge = await this.debridge.getDebridge(debridgeId);
      const balance = toBN(await web3.eth.getBalance(receiver));
      await this.debridge.claim(
        debridgeId,
        chainIdFrom,
        receiver,
        amount,
        nonce,
        this.ethSignatures,
        {
          from: alice,
        }
      );
      const newBalance = toBN(await web3.eth.getBalance(receiver));
      const submissionId = await this.debridge.getSubmisionId(
        debridgeId,
        chainIdFrom,
        chainId,
        amount,
        receiver,
        nonce
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
      await this.debridge.claim(
        erc20DebridgeId,
        chainIdFrom,
        receiver,
        amount,
        nonce,
        this.erc20Signatures,
        {
          from: alice,
        }
      );
      const newBalance = toBN(await this.mockToken.balanceOf(receiver));
      const submissionId = await this.debridge.getSubmisionId(
        erc20DebridgeId,
        chainIdFrom,
        chainId,
        amount,
        receiver,
        nonce
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
      const wrongnonce = 122;
      await expectRevert(
        this.debridge.claim(
          debridgeId,
          chainIdFrom,
          receiver,
          amount,
          wrongnonce,
          this.ethSignatures,
          {
            from: alice,
          }
        ),
        "Not confirmed by required oracles"
        // "not confirmed"
      );
    });

    it("should reject claiming twice", async function() {
      await expectRevert(
        this.debridge.claim(
          debridgeId,
          chainIdFrom,
          receiver,
          amount,
          nonce,
          this.ethSignatures,
          {
            from: alice,
          }
        ),
        //"claim: already used"
        "submit: submitted already"
      );
    });
  });

  context("Test fee maangement", () => {
    const tokenAddress = ZERO_ADDRESS;
    let receiver;
    const amount = toBN(toWei("0.00001"));
    let chainId;
    let debridgeId;
    let outsideDebridgeId;
    let erc20DebridgeId;

    before(async function() {
      receiver = bob
      chainId = await this.debridge.chainId();
      debridgeId = await this.debridge.getDebridgeId(chainId, tokenAddress);
      outsideDebridgeId = await this.debridge.getDebridgeId(42, tokenAddress);
      erc20DebridgeId = await this.debridge.getDebridgeId(
        chainId,
        this.mockToken.address
      );
    });

    it("should withdraw fee of native token if it is called by the admin", async function() {
      const debridge = await this.debridge.getDebridge(debridgeId);
      const balance = toBN(await web3.eth.getBalance(receiver));
      await this.debridge.withdrawFee(debridgeId, receiver, amount, {
        from: alice,
      });
      const newBalance = toBN(await web3.eth.getBalance(receiver));
      const newDebridge = await this.debridge.getDebridge(debridgeId);
      assert.equal(
        debridge.collectedFees.sub(amount).toString(),
        newDebridge.collectedFees.toString()
      );
      assert.equal(balance.add(amount).toString(), newBalance.toString());
    });

    it("should withdraw fee of ERC20 token if it is called by the admin", async function() {
      const debridge = await this.debridge.getDebridge(erc20DebridgeId);
      const balance = toBN(await this.mockToken.balanceOf(receiver));
      await this.debridge.withdrawFee(erc20DebridgeId, receiver, amount, {
        from: alice,
      });
      const newBalance = toBN(await this.mockToken.balanceOf(receiver));
      const newDebridge = await this.debridge.getDebridge(erc20DebridgeId);
      assert.equal(
        debridge.collectedFees.sub(amount).toString(),
        newDebridge.collectedFees.toString()
      );
      assert.equal(balance.add(amount).toString(), newBalance.toString());
    });

    it("should reject withdrawing fee by non-admin", async function() {
      await expectRevert(
        this.debridge.connect(bobAccount).withdrawFee(debridgeId, receiver, amount),
        "onlyAdmin: bad role"
      );
    });

    it("should reject withdrawing too many fees", async function() {
      const amount = toBN(toWei("100"));
      await expectRevert(
        this.debridge.withdrawFee(debridgeId, receiver, amount, {
          from: alice,
        }),
        "withdrawFee: not enough fee"
      );
    });

    it("should reject withdrawing fees if the token not from current chain", async function() {
      const amount = toBN(toWei("100"));
      await expectRevert(
        this.debridge.withdrawFee(outsideDebridgeId, receiver, amount, {
          from: alice,
        }),
        "withdrawFee: not enough fee"
      );
    });
  });
});
