const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const PERMIT_TYPEHASH =
  "0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9";
module.exports.ZERO_ADDRESS = ZERO_ADDRESS;
const { ecsign } = require("ethereumjs-util");
const {
  keccak256,
  defaultAbiCoder,
  toUtf8Bytes,
  solidityPack,
} = require("ethers/utils");

module.exports.permit = async (
  token,
  owner,
  spender,
  value,
  deadline,
  privKey
) => {
  let nonce = await token.nonces(owner);
  const DOMAIN_SEPARATOR = await token.DOMAIN_SEPARATOR();
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
              owner,
              spender,
              value.toString(),
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
    Buffer.from(privKey.slice(2), "hex")
  );
  return (
    "0x" +
    ("00" + signature.r.toString("hex")).slice(-64) +
    ("00" + signature.s.toString("hex")).slice(-64) +
    signature.v.toString(16)
  );
};
