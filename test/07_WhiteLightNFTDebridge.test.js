const Web3 = require("web3");
const { expectRevert } = require("@openzeppelin/test-helpers");
const { ZERO_ADDRESS, permitNFT } = require("./utils.spec");
const { deployProxy } = require("@openzeppelin/truffle-upgrades");
const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants");
const WhiteFullAggregator = artifacts.require("WhiteFullAggregator");
const WhiteLightVerifier = artifacts.require("WhiteLightVerifier");
const MockLinkToken = artifacts.require("MockLinkToken");
const MockNFTToken = artifacts.require("MockNFTToken");
const WhiteLightNFTDebridge = artifacts.require("WhiteLightNFTDebridge");
const WrappedNFT = artifacts.require("WrappedNFT");
const CallProxy = artifacts.require("CallProxy");
const WETH9 = artifacts.require("WETH9");
const { toWei, fromWei, toBN } = web3.utils;
const MAX = web3.utils.toTwosComplement(-1);
const Tx = require("ethereumjs-tx");
const bscWeb3 = new Web3(process.env.TEST_BSC_PROVIDER);
const oracleKeys = JSON.parse(process.env.TEST_ORACLE_KEYS);
const bobPrivKey =
  "0x79b2a2a43a1e9f325920f99a720605c9c563c61fb5ae3ebe483f83f1230512d3";

web3.extend({
  property: "eth",
  methods: [
    {
      name: "getTransaction",
      call: "eth_getTransactionByHash",
      params: 1,
    },
    {
      name: "getRawTransaction",
      call: "eth_getRawTransactionByHash",
      params: 1,
    },
  ],
});

contract("WhiteLightNFTDebridge", function([alice, bob, carol, eve, fei, devid]) {
  before(async function() {
    this.mockNFTToken = await MockNFTToken.new("Mock NFT Token", "NMT", {
      from: alice,
    });
    this.linkToken = await MockLinkToken.new("Link Token", "dLINK", 18, {
      from: alice,
    });
    this.oraclePayment = toWei("0.001");
    this.minConfirmations = 3;
    this.fullAggregatorAddress = "0x72736f8c88bd1e438b05acc28c58ac21c5dc76ce";
    this.aggregatorInstance = new web3.eth.Contract(
      WhiteFullAggregator.abi,
      this.fullAggregatorAddress
    );
    this.whiteLightAggregator = await WhiteLightVerifier.new(
      this.minConfirmations,
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
        address: carol,
        admin: eve,
      },
      {
        address: eve,
        admin: carol,
      },
      {
        address: fei,
        admin: eve,
      },
      {
        address: devid,
        admin: carol,
      },
    ];
    for (let oracle of this.initialOracles) {
      await this.whiteLightAggregator.addOracle(oracle.address, {
        from: alice,
      });
    }
    this.callProxy = await CallProxy.new({
      from: alice,
    });
    this.weth = await WETH9.new({
      from: alice,
    });
    this.whiteDebridge = await deployProxy(WhiteLightNFTDebridge, [
      ZERO_ADDRESS,
      this.callProxy.address.toString(),
      ZERO_ADDRESS,
    ]);
  });

  context("Test setting configurations by different users", () => {
    it("should set aggregator if called by the admin", async function() {
      const aggregator = this.whiteLightAggregator.address;
      await this.whiteDebridge.setAggregator(aggregator, {
        from: alice,
      });
      const newAggregator = await this.whiteDebridge.aggregator();
      assert.equal(aggregator, newAggregator);
    });

    it("should reject setting aggregator if called by the non-admin", async function() {
      await expectRevert(
        this.whiteDebridge.setAggregator(ZERO_ADDRESS, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should set weth if called by the admin", async function() {
      const weth = this.weth.address;
      await this.whiteDebridge.setFeeToken(weth, {
        from: alice,
      });
      const newWeth = await this.whiteDebridge.feeToken();
      assert.equal(weth, newWeth);
    });

    it("should reject setting weth if called by the non-admin", async function() {
      await expectRevert(
        this.whiteDebridge.setFeeToken(ZERO_ADDRESS, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });
  });

  context("Test managing assets", () => {
    const isSupported = true;
    it("should add external asset if called by the admin", async function() {
      const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      const chainId = 56;
      const fixedFee = toWei("0.00001");
      const supportedChainIds = [42, 3, 56];
      const name = "Japan real estate";
      const symbol = "JPR";
      const wrappedNft = await WrappedNFT.new(
        name,
        symbol,
        [this.whiteDebridge.address],
        {
          from: alice,
        }
      );
      await this.whiteDebridge.addExternalAsset(
        tokenAddress,
        wrappedNft.address,
        chainId,
        supportedChainIds,
        [
          {
            fixedFee,
            isSupported,
          },
          {
            fixedFee,
            isSupported,
          },
          {
            fixedFee,
            isSupported,
          },
        ],
        {
          from: alice,
        }
      );
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      const supportedChainInfo = await this.whiteDebridge.getChainIdSupport(
        debridgeId,
        3
      );
      assert.equal(debridge.chainId.toString(), chainId);
      assert.equal(supportedChainInfo.fixedFee.toString(), fixedFee);
      assert.equal(debridge.collectedFees.toString(), "0");
    });

    it("should add native asset if called by the admin", async function() {
      const tokenAddress = this.mockNFTToken.address;
      const chainId = await this.whiteDebridge.chainId();
      const fixedFee = toWei("0.00001");
      const supportedChainIds = [42, 3];
      await this.whiteDebridge.addNativeAsset(
        tokenAddress,
        supportedChainIds,
        [
          {
            fixedFee,
            isSupported,
          },
          {
            fixedFee,
            isSupported,
          },
        ],
        {
          from: alice,
        }
      );
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      const supportedChainInfo = await this.whiteDebridge.getChainIdSupport(
        debridgeId,
        3
      );
      assert.equal(debridge.tokenAddress, tokenAddress);
      assert.equal(debridge.chainId.toString(), chainId);
      assert.equal(supportedChainInfo.fixedFee.toString(), fixedFee);
      assert.equal(debridge.collectedFees.toString(), "0");
    });

    it("should reject adding external asset if called by the non-admin", async function() {
      await expectRevert(
        this.whiteDebridge.addExternalAsset(
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          0,
          [0],
          [
            {
              fixedFee: 0,
              isSupported: false,
            },
          ],
          {
            from: bob,
          }
        ),
        "onlyAdmin: bad role"
      );
    });

    it("should reject setting native asset if called by the non-admin", async function() {
      await expectRevert(
        this.whiteDebridge.addNativeAsset(
          ZERO_ADDRESS,
          [0],
          [
            {
              fixedFee: 0,
              isSupported: false,
            },
          ],
          {
            from: bob,
          }
        ),
        "onlyAdmin: bad role"
      );
    });
  });

  context("Test send method", () => {
    it("should send a NFT Token from the current chain", async function() {
      const tokenAddress = this.mockNFTToken.address;
      const chainId = await this.whiteDebridge.chainId();
      const receiver = bob;
      const tokenId = 1;
      const chainIdTo = 42;
      await this.mockNFTToken.mint(alice, tokenId, {
        from: alice,
      });
      await this.mockNFTToken.approve(this.whiteDebridge.address, tokenId, {
        from: alice,
      });
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      const supportedChainInfo = await this.whiteDebridge.getChainIdSupport(
        debridgeId,
        chainIdTo
      );
      const fees = toBN(supportedChainInfo.fixedFee);
      await this.weth.deposit({ value: fees, from: alice });
      await this.weth.approve(this.whiteDebridge.address, fees, { from: alice });
      const originalOwner = await this.mockNFTToken.ownerOf(tokenId);
      await this.whiteDebridge.send(debridgeId, receiver, tokenId, chainIdTo, {
        from: alice,
      });
      
      assert.equal(
        originalOwner,
        alice,
        'original owner mismatch'
      );

      const newDebridge = await this.whiteDebridge.getDebridge(debridgeId);
      const newOwner = await this.mockNFTToken.ownerOf(tokenId);

      assert.equal(
        newOwner,
        this.whiteDebridge.address
      );

      assert.equal(
        debridge.collectedFees.add(fees).toString(),
        newDebridge.collectedFees.toString(),
        "collected fees mismatch"
      );
    });

    it("should reject sending tokens to unsupported chain", async function() {
      const tokenAddress = this.mockNFTToken.address;
      const chainId = await this.whiteDebridge.chainId();
      const receiver = bob;
      const chainIdTo = chainId;
      const tokenId = 2;
      await this.mockNFTToken.mint(alice, tokenId, {
        from: alice,
      });
      await this.mockNFTToken.approve(this.whiteDebridge.address, tokenId, {
        from: alice,
      });
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const supportedChainInfo = await this.whiteDebridge.getChainIdSupport(
        debridgeId,
        chainIdTo
      );
      const fees = toBN(supportedChainInfo.fixedFee);
      await this.weth.approve(this.whiteDebridge.address, fees, { from: alice });
      await expectRevert(
        this.whiteDebridge.send(debridgeId, receiver, tokenId, chainIdTo, {
          from: alice,
        }),
        "send: wrong targed chain"
      );
    });

    it("should reject sending tokens originated on the other chain", async function() {
      const tokenAddress = this.mockNFTToken.address;
      const receiver = bob;
      const chainIdTo = 42;
      const tokenId = 2;
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        42,
        tokenAddress
      );
      
      await expectRevert(
        this.whiteDebridge.send(debridgeId, receiver, tokenId, chainIdTo, {
          from: alice,
        }),
        "send: not native chain"
      );
    });
  });

  context("Test mint method", () => {
    let debridgeId;
    const receiver = bob;
    const tokenId = 1;
    const nonce = 1;
    const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
    const chainId = 56;
    let currentChainId;

    before(async function() {
      debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      currentChainId = await this.whiteDebridge.chainId();
      const submission = await this.whiteDebridge.getSubmisionId(
        debridgeId,
        chainId,
        currentChainId,
        tokenId,
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
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      const wrappedNft = await WrappedNFT.at(debridge.tokenAddress);

      await this.whiteDebridge.mint(
        debridgeId,
        chainId,
        receiver,
        tokenId,
        nonce,
        this.signatures,
        {
          from: alice,
        }
      );
      const submissionId = await this.whiteDebridge.getSubmisionId(
        debridgeId,
        chainId,
        currentChainId,
        tokenId,
        receiver,
        nonce
      );
      const isSubmissionUsed = await this.whiteDebridge.isSubmissionUsed(
        submissionId
      );
      const newOwner = await wrappedNft.ownerOf(tokenId);
      assert.equal(newOwner, receiver, "owner of token is not receiver");
      assert.ok(isSubmissionUsed);
    });

    it("should reject minting with unconfirmed submission", async function() {
      const nonce = 4;
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.whiteDebridge.mint(
          debridgeId,
          chainId,
          receiver,
          tokenId,
          nonce,
          [],
          {
            from: alice,
          }
        ),
        "mint: not confirmed"
      );
    });

    it("should reject minting twice", async function() {
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      await expectRevert(
        this.whiteDebridge.mint(
          debridgeId,
          chainId,
          receiver,
          tokenId,
          nonce,
          [],
          {
            from: alice,
          }
        ),
        "mint: already used"
      );
    });
  });

  context("Test burn method", () => {
    it("should burning when the amount is suficient", async function() {
      const tokenAddress = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984";
      const chainIdTo = 56;
      const receiver = alice;
      const tokenId = 1;
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainIdTo,
        tokenAddress
      );
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      const wrappedNFT = await WrappedNFT.at(debridge.tokenAddress);
      const deadline = MAX_UINT256;
      const signature = await permitNFT(
        wrappedNFT,
        bob,
        this.whiteDebridge.address,
        tokenId,
        deadline,
        bobPrivKey
      );
      const supportedChainInfo = await this.whiteDebridge.getChainIdSupport(
        debridgeId,
        chainIdTo
      );
      const fees = toBN(supportedChainInfo.fixedFee);
      await this.weth.deposit({ value: fees, from: bob });
      await this.weth.approve(this.whiteDebridge.address, fees, { from: bob });
      await this.whiteDebridge.burn(
        debridgeId,
        receiver,
        tokenId,
        chainIdTo,
        deadline,
        signature,
        {
          from: bob,
        }
      );
      const newOwner = await this.whiteDebridge.getOwnerOfToken(debridgeId, tokenId);
      assert.equal(newOwner, '0x0000000000000000000000000000000000000000');
      const newDebridge = await this.whiteDebridge.getDebridge(debridgeId);
      assert.equal(
        debridge.collectedFees.add(fees).toString(),
        newDebridge.collectedFees.toString()
      );
      await expectRevert(wrappedNFT.ownerOf(tokenId), "ERC721: owner query for nonexistent token");
    });

    it("should reject burning from current chain", async function() {
      const tokenAddress = this.mockNFTToken.address;
      const chainId = await this.whiteDebridge.chainId();
      const receiver = bob;
      const tokenId = 1;
      const debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const deadline = 0;
      const signature = "0x";
      await expectRevert(
        this.whiteDebridge.burn(
          debridgeId,
          receiver,
          tokenId,
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
  });

  context("Test claim method", () => {
    const receiver = bob;
    const tokenId = 1;
    const nonce = 4;
    let chainId;
    let chainIdFrom = 87;
    let debridgeId;
    let erc20DebridgeId;

    before(async function() {
      const tokenAddress = this.mockNFTToken.address;
      chainId = await this.whiteDebridge.chainId();
      debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      const curentChainSubmission = await this.whiteDebridge.getSubmisionId(
        debridgeId,
        chainIdFrom,
        chainId,
        tokenId,
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
    });

    it("should claim native token when the submission is approved", async function() {
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      
      await this.whiteDebridge.claim(
        debridgeId,
        chainIdFrom,
        receiver,
        tokenId,
        nonce,
        this.ethSignatures,
        {
          from: alice,
        }
      );
      
      const newOwner = await this.mockNFTToken.ownerOf(tokenId);
      const newOwnerInBridge = await this.whiteDebridge.getOwnerOfToken(debridgeId, tokenId);

      const submissionId = await this.whiteDebridge.getSubmisionId(
        debridgeId,
        chainIdFrom,
        chainId,
        tokenId,
        receiver,
        nonce
      );
      const isSubmissionUsed = await this.whiteDebridge.isSubmissionUsed(
        submissionId
      );
      const newDebridge = await this.whiteDebridge.getDebridge(debridgeId);
      assert.equal(
        newOwner,
        bob
      );
      assert.equal(
        newOwnerInBridge,
        '0x0000000000000000000000000000000000000000'
      );
      assert.equal(
        debridge.collectedFees.toString(),
        newDebridge.collectedFees.toString()
      );
      assert.ok(isSubmissionUsed);
    });

    it("should reject claiming with unconfirmed submission", async function() {
      const nonce = 1;
      await expectRevert(
        this.whiteDebridge.claim(
          debridgeId,
          chainIdFrom,
          receiver,
          tokenId,
          nonce,
          [],
          {
            from: alice,
          }
        ),
        "claim: not confirmed"
      );
    });

    it("should reject claiming twice", async function() {
      await expectRevert(
        this.whiteDebridge.claim(
          debridgeId,
          chainIdFrom,
          receiver,
          tokenId,
          nonce,
          [],
          {
            from: alice,
          }
        ),
        "claim: already used"
      );
    });
  });

  context("Test fee maangement", () => {
    const receiver = bob;
    const amount = toBN(toWei("0.00001"));
    let chainId;
    let debridgeId;
    let outsideDebridgeId;

    before(async function() {
      const tokenAddress = this.mockNFTToken.address;
      chainId = await this.whiteDebridge.chainId();
      debridgeId = await this.whiteDebridge.getDebridgeId(
        chainId,
        tokenAddress
      );
      outsideDebridgeId = await this.whiteDebridge.getDebridgeId(
        42,
        tokenAddress
      );
    });

    it("should withdraw fee of ERC20 token if it is called by the admin", async function() {
      const debridge = await this.whiteDebridge.getDebridge(debridgeId);
      const balance = toBN(await this.weth.balanceOf(receiver));
      await this.whiteDebridge.withdrawFee(debridgeId, receiver, amount, {
        from: alice,
      });
      const newBalance = toBN(await this.weth.balanceOf(receiver));
      const newDebridge = await this.whiteDebridge.getDebridge(debridgeId);
      assert.equal(
        debridge.collectedFees.sub(amount).toString(),
        newDebridge.collectedFees.toString()
      );
      assert.equal(balance.add(amount).toString(), newBalance.toString());
    });

    it("should reject withdrawing fee by non-admin", async function() {
      await expectRevert(
        this.whiteDebridge.withdrawFee(debridgeId, receiver, amount, {
          from: bob,
        }),
        "onlyAdmin: bad role"
      );
    });

    it("should reject withdrawing too many fees", async function() {
      const amount = toBN(toWei("100"));
      await expectRevert(
        this.whiteDebridge.withdrawFee(debridgeId, receiver, amount, {
          from: alice,
        }),
        "withdrawFee: not enough fee"
      );
    });

    it("should reject withdrawing fees if the token not from current chain", async function() {
      const amount = toBN(toWei("100"));
      await expectRevert(
        this.whiteDebridge.withdrawFee(outsideDebridgeId, receiver, amount, {
          from: alice,
        }),
        "withdrawFee: not enough fee"
      );
    });
  });
});
