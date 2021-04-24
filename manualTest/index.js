require("dotenv-flow").config();
const Tx = require("ethereumjs-tx");
const Web3 = require("web3");
const { toBN, toWei, toChecksumAddress, fromWei } = require("web3-utils");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const wrappedAssetAbi = require("../build/contracts/WrappedAsset.json").abi;
const whiteFullAggregatorAbi = require("../build/contracts/WhiteFullAggregator.json")
  .abi;
const whiteFullDebridgeAbi = require("../build/contracts/WhiteFullDebridge.json")
  .abi;
const whiteLightAggregatorAbi = require("../build/contracts/WhiteLightAggregator.json")
  .abi;
const whiteLightDebridgeAbi = require("../build/contracts/WhiteLightDebridge.json")
  .abi;

const hecoWeb3 = new Web3(process.env.HECO_PROVIDER);
const bscWeb3 = new Web3(process.env.BSC_PROVIDER);
const ethWeb3 = new Web3(process.env.ETH_PROVIDER);

const bscInfo = {
  whiteAggregatorInstance: new bscWeb3.eth.Contract(
    whiteFullAggregatorAbi,
    process.env.BSC_WHITE_AGGREGATOR
  ),
  whiteDebridgeInstance: new bscWeb3.eth.Contract(
    whiteFullDebridgeAbi,
    process.env.BSC_WHITE_DEBRIDGE
  ),
};
const hecoInfo = {
  whiteAggregatorInstance: new hecoWeb3.eth.Contract(
    whiteFullAggregatorAbi,
    process.env.HECO_WHITE_AGGREGATOR
  ),
  whiteDebridgeInstance: new hecoWeb3.eth.Contract(
    whiteFullDebridgeAbi,
    process.env.HECO_WHITE_DEBRIDGE
  ),
};
const ethInfo = {
  whiteAggregatorInstance: new ethWeb3.eth.Contract(
    whiteLightAggregatorAbi,
    process.env.ETH_WHITE_AGGREGATOR
  ),
  whiteDebridgeInstance: new ethWeb3.eth.Contract(
    whiteLightDebridgeAbi,
    process.env.ETH_WHITE_DEBRIDGE
  ),
};
const senderAddress = process.env.SENDER_ADDRESS;
const privKey = process.env.PRIVATE_KEY;
const oracleAddress = process.env.ORACLE_SENDER_ADDRESS;
const oraclePrivKey = process.env.ORACLE_PRIVATE_KEY;

async function sendBscToEth() {
  const tokenAddress = ZERO_ADDRESS;
  const chainId = await bscInfo.whiteDebridgeInstance.methods.chainId().call();
  const receiver = senderAddress;
  const amount = toBN(toWei("0.1"));
  const chainIdTo = await ethInfo.whiteDebridgeInstance.methods
    .chainId()
    .call();
  const debridgeId = await bscInfo.whiteDebridgeInstance.methods
    .getDebridgeId(chainId, tokenAddress)
    .call();
  const tx = {
    from: senderAddress,
    to: bscInfo.whiteDebridgeInstance.options.address,
    value: amount,
    gasPrice: toWei("5", "gwei"),
    gas: 300000,
    data: bscInfo.whiteDebridgeInstance.methods
      .send(debridgeId, receiver, amount, chainIdTo)
      .encodeABI(),
  };
  const signedTx = await bscWeb3.eth.accounts.signTransaction(tx, privKey);
  console.log(signedTx);
  await bscWeb3.eth.sendSignedTransaction(
    signedTx.raw || signedTx.rawTransaction
  );
}

async function confirmSubmit(chainInfo, web3, submissionId) {
  const tx = {
    from: oracleAddress,
    to: chainInfo.whiteAggregatorInstance.options.address,
    value: 0,
    gasPrice: toWei("5", "gwei"),
    gas: 300000,
    data: chainInfo.whiteAggregatorInstance.methods
      .submit(submissionId)
      .encodeABI(),
  };
  const signedTx = await web3.eth.accounts.signTransaction(tx, oraclePrivKey);
  console.log(signedTx);
  await web3.eth.sendSignedTransaction(signedTx.raw || signedTx.rawTransaction);
}
async function mintOnEth() {
  const aggregatorAddress = bscInfo.whiteAggregatorInstance.options.address
    .slice(2)
    .toLowerCase();
  const tokenAddress = ZERO_ADDRESS;
  const chainId = await bscInfo.whiteDebridgeInstance.methods.chainId().call();
  const receiver = senderAddress;
  const amount = toBN("99400000000000000");
  const nonce = 0;
  const debridgeId = await ethInfo.whiteDebridgeInstance.methods
    .getDebridgeId(chainId, tokenAddress)
    .call();
  const signedTxs = [
    "0xf88a028502540be4008307a12094aa848d03c5436c2fb8269e8c8b65c2521837442680a4d9caa3d226c867f2fcb90c7666dc98118a345653f5c75e69607f8d0f828fa3fa8057847381e5a0ab2bfc1521e2e3ebacbb1cd8ac3610cb33541ae4a87dade4265964dceaf02a20a0583f3ed39a4c7f9c3501693489e7bd733b0175e84339702c666e8e2269d8fffe",
    "0xf88a0185012a05f200830493e094aa848d03c5436c2fb8269e8c8b65c2521837442680a4d9caa3d226c867f2fcb90c7666dc98118a345653f5c75e69607f8d0f828fa3fa8057847381e6a04cdbdaaa7a6c0026d1936fb745a1efdad09a6f475cb2ee25b8f8a36f87eb47f2a05ffc650ed6af3b34c5f3d8a60cea2e65aa79fb6d5bc19c08c35d8916cf79e065",
  ];
  const trxsData = [];
  for (let i = 0; i < signedTxs.length; i++) {
    let signedTx = signedTxs[i];
    const tx = new Tx(signedTx);
    const rawTx = (({ nonce, from, to, value, gas, gasPrice, input }) => ({
      nonce,
      from,
      to,
      value,
      gas,
      gasPrice,
      input,
    }))(tx);
    const unsignedTx = new Tx(rawTx);
    const serializedUnsignedTx = unsignedTx.serialize().toString("hex");
    const trxData = [
      "0x" +
        serializedUnsignedTx.substr(
          0,
          serializedUnsignedTx.indexOf(aggregatorAddress)
        ),
      "0x" +
        ("00" + tx.r.toString("hex")).slice(-64) +
        ("00" + tx.s.toString("hex")).slice(-64) +
        (tx.v.toString("hex") == "e6" ? "1c" : "1b"),
    ];
    trxsData.push(trxData);
  }
  console.log(trxsData);
  const tx = {
    from: senderAddress,
    to: ethInfo.whiteDebridgeInstance.options.address,
    value: 0,
    gasPrice: toWei("5", "gwei"),
    gas: 300000,
    data: ethInfo.whiteDebridgeInstance.methods
      .mint(debridgeId, receiver, amount, nonce, trxsData)
      .encodeABI(),
  };
  const signedTx = await ethWeb3.eth.accounts.signTransaction(tx, privKey);
  console.log(signedTx);
  await ethWeb3.eth.sendSignedTransaction(
    signedTx.raw || signedTx.rawTransaction
  );
}

async function burnEthToHeco() {
  const tokenAddress = ZERO_ADDRESS;
  const chainId = await bscInfo.whiteDebridgeInstance.methods.chainId().call();
  const receiver = senderAddress;
  const amount = toBN("99400000000000000");
  const chainIdTo = await hecoInfo.whiteDebridgeInstance.methods
    .chainId()
    .call();
  const debridgeId = await ethInfo.whiteDebridgeInstance.methods
    .getDebridgeId(chainId, tokenAddress)
    .call();
  const debridge = await ethInfo.whiteDebridgeInstance.methods
    .getDebridge(debridgeId)
    .call();
  const wrappedAsset = new ethWeb3.eth.Contract(
    wrappedAssetAbi,
    debridge.tokenAddress
  );
  const approveTx = {
    from: senderAddress,
    to: wrappedAsset.options.address,
    value: 0,
    gasPrice: toWei("5", "gwei"),
    gas: 300000,
    data: wrappedAsset.methods
      .approve(ethInfo.whiteDebridgeInstance.options.address, amount)
      .encodeABI(),
  };
  const signedApproveTx = await ethWeb3.eth.accounts.signTransaction(
    approveTx,
    privKey
  );
  console.log(signedApproveTx);
  await ethWeb3.eth.sendSignedTransaction(
    signedApproveTx.raw || signedApproveTx.rawTransaction
  );
  const tx = {
    from: senderAddress,
    to: ethInfo.whiteDebridgeInstance.options.address,
    value: 0,
    gasPrice: toWei("5", "gwei"),
    gas: 300000,
    data: ethInfo.whiteDebridgeInstance.methods
      .burn(debridgeId, receiver, amount, chainIdTo)
      .encodeABI(),
  };
  const signedTx = await ethWeb3.eth.accounts.signTransaction(tx, privKey);
  console.log(signedTx);
  await ethWeb3.eth.sendSignedTransaction(
    signedTx.raw || signedTx.rawTransaction
  );
}
async function mintOnHeco() {}
async function burnHecoToBsc() {}
async function claimOnBsc() {}

// sendBscToEth().catch(console.log);
// confirmSubmit(
//   bscInfo,
//   bscWeb3,
//   "0x26c867f2fcb90c7666dc98118a345653f5c75e69607f8d0f828fa3fa80578473"
// ).catch(console.log);
// mintOnEth().catch(console.log);
// burnEthToHeco().catch(console.log);
confirmSubmit(
  hecoInfo,
  hecoWeb3,
  "0x7ffe7870ec9c1430bbf4f2fbc366971d69109e6c4a088f9e6730905351cd8f53"
).catch(console.log);
