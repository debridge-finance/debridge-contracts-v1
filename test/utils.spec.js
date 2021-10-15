const { ecsign } = require("ethereumjs-util");
const { keccak256, defaultAbiCoder, toUtf8Bytes, solidityPack } = require("ethers/lib/utils");

module.exports.DEFAULT_ADMIN_ROLE = ethers.utils.hexZeroPad(0, 32);
module.exports.WORKER_ROLE = ethers.utils.keccak256(toUtf8Bytes("WORKER_ROLE"));

module.exports.permit = async (token, owner, spender, value, deadline, privKey) => {
  let nonce = await token.nonces(owner);
  const DOMAIN_SEPARATOR = await token.DOMAIN_SEPARATOR();
  const PERMIT_TYPEHASH = keccak256(toUtf8Bytes("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"));
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


module.exports.permitWithDeadline = async (token, owner, spender, value, deadline, privKey) => {
  // return combined deadline + signature for passing to burn methods;
  const permitSignature = await module.exports.permit(token, owner, spender, value, deadline, privKey);
  const deadlineHex = web3.utils.padLeft(web3.utils.toHex(deadline.toString()), 64);
  //                                    remove first 0x
  return deadlineHex + permitSignature.substring(2, permitSignature.length);
}


module.exports.packSubmissionAutoParamsTo = async (executionFee, flags, fallbackAddress, data) => {
  const autoParams = {executionFee, flags, fallbackAddress, data};
  const packed = ethers.utils.defaultAbiCoder.encode([{
    type: "tuple",
    name: "SubmissionAutoParamsTo",
    components: [
      { name: "executionFee", type: 'uint256' },
      { name: "flags", type: 'uint256' },
      { name: "fallbackAddress", type:'bytes' },
      { name: "data", type:'bytes' },
    ]}],
  [ autoParams ]);
  return packed;
}

module.exports.packSubmissionAutoParamsFrom = async (executionFee, flags, fallbackAddress, data, nativeSender) => {
  const autoParams = {executionFee, flags, fallbackAddress, data, nativeSender};
  const packed = ethers.utils.defaultAbiCoder.encode([{
    type: "tuple",
    name: "SubmissionAutoParamsFrom",
    components: [
      { name: "executionFee", type: 'uint256' },
      { name: "flags", type: 'uint256' },
      { name: "fallbackAddress", type:'address' },
      { name: "data", type:'bytes' },
      { name: "nativeSender", type:'bytes' },
    ]}],
  [ autoParams ]);
  return packed;
}

module.exports.submissionSignatures = async function (_web3, oracleKeys, submissionId) {
  let signatures = "0x";
  for (let oracleKey of oracleKeys) {
    let currentSignature = (await _web3.eth.accounts.sign(submissionId, oracleKey)).signature;
    // HACK remove first 0x
    signatures += currentSignature.substring(2, currentSignature.length);
  }
  return signatures;
}
