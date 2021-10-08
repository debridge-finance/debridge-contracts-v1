const { waffle } = require("hardhat")
const expectRevert = require("@openzeppelin/test-helpers/src/expectRevert");
const { expect } = require("chai");
const WrappedAsset = artifacts.require("MockDeBridgeTokenOne");
const { deployMockContract } = waffle
const { ecsign } = require("ethereumjs-util");
const {
  keccak256,
  defaultAbiCoder,
  toUtf8Bytes,
  solidityPack,
} = require("ethers/lib/utils");


describe('WrappedAsset', () =>{
    beforeEach( async() => {
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

        /*
        constructor(
            string memory _name,
            string memory _symbol,
            uint8 _tokenDecimals,
            address _admin,
            address[] memory _minters
        )
        */ 
        this.wrappedAsset = await WrappedAsset.new("Token","TKN",18,alice,[alice, bob,carol,eve]);
    });

    it('should call decimals and verify', async()=>{
        const decimals = await this.wrappedAsset.decimals();
        expect(decimals.toNumber()).to.be.equal(18);
    })

    it('should call permit, fail permit expired', async()=> {
        await this.wrappedAsset.mint(bob,1, {from:bob});
        await this.wrappedAsset.mint(bob,1, {from:bob});
        await this.wrappedAsset.mint(bob,1, {from:bob});

        await expectRevert(this.wrappedAsset.permit(alice,bob,1,0,1,"0x00","0x00"),"permit: EXPIRED");
    })

    it('should mint assets, as minter, and burn them', async()=>{
        await this.wrappedAsset.mint(bob,1, {from:bob});
        await this.wrappedAsset.burn(1, {from:bob});
    })

    it('should call mint function without minter role', async()=>{
        await expectRevert(this.wrappedAsset.mint(fei, 1,{from:fei}),"MinterBadRole()")
    })

    it('should call permit with valid signature', async()=>{
        const PERMIT_TYPEHASH = '0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9'
        const amount = 1
        let deadline = 1000
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore.timestamp;
        deadline+=timestampBefore
        const DOMAIN_SEPARATOR = await this.wrappedAsset.DOMAIN_SEPARATOR();
        const nonce = await this.wrappedAsset.nonces(alice);
        const bobPrivKey = '0x185e704397d20d79ced6736ba9b303e4b200b048d88064f23f0c8b94d01309b4'
        const digest = keccak256(
            solidityPack(
              ["bytes1", "bytes1", "bytes32", "bytes32"],
              [
                "0x19",
                "0x01",
                DOMAIN_SEPARATOR,
                keccak256(
                  defaultAbiCoder.encode(
                    ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
                    [
                      PERMIT_TYPEHASH,
                      bob,
                      alice,
                      amount.toString(),
                      nonce.toString(),
                      deadline.toString(),
                    ]
                  )
                ),
              ]
            )
          );
      
        const signature = ecsign(
            Buffer.from(digest.slice(2), "hex"),
            Buffer.from(bobPrivKey.slice(2), "hex")
        );

        const r = signature.r.toString('hex').slice(-64);
        const s = signature.s.toString('hex').slice(-64);
        const v_decimal = parseInt(signature.v.toString(16),16);
        
        await this.wrappedAsset.permit(bob,alice,amount,deadline, v_decimal, '0x'+r, '0x'+s, {from:bob});
    })

    it('should call permit with invalid signature', async()=>{
      const PERMIT_TYPEHASH = '0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9'
      const amount = 1
      let deadline = 1000
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;
      deadline+=timestampBefore
      const DOMAIN_SEPARATOR = await this.wrappedAsset.DOMAIN_SEPARATOR();
      const nonce = await this.wrappedAsset.nonces(alice);
      const bobPrivKey = '0x185e704397d20d79ced6736ba9b303e4b200b048d88064f23f0c8b94d01309b4'
      const digest = keccak256(
          solidityPack(
            ["bytes1", "bytes1", "bytes32", "bytes32"],
            [
              "0x19",
              "0x01",
              DOMAIN_SEPARATOR,
              keccak256(
                defaultAbiCoder.encode(
                  ["bytes32", "address", "address", "uint256"],
                  [
                    PERMIT_TYPEHASH,
                    bob,
                    alice,
                    amount.toString(),
                  ]
                )
              ),
            ]
          )
        );

      const signature = ecsign(
          Buffer.from(digest.slice(2), "hex"),
          Buffer.from(bobPrivKey.slice(2), "hex")
      );

      const r = signature.r.toString('hex').slice(-64);
      const s = signature.s.toString('hex').slice(-64);
      const v_decimal = parseInt(signature.v.toString(16),16);
      
      await expectRevert(this.wrappedAsset.permit(bob,alice,amount,deadline, v_decimal, '0x'+r, '0x'+s, {from:bob}),"permit: invalid signature");
  })
});