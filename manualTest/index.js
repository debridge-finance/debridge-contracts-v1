require("dotenv-flow").config();
const Tx = require("ethereumjs-tx");
const Web3 = require("web3");
const { toBN, toWei, toChecksumAddress, fromWei } = require("web3-utils");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const wrappedAssetAbi = require("../build/contracts/WrappedAsset.json").abi;
const confirmationAggregatorAbi = require("../build/contracts/ConfirmationAggregator.json").abi;
const fullDebridgeAbi = require("../build/contracts/FullDebridge.json").abi;
const signatureVerifierAbi = require("../build/contracts/SignatureVerifier.json").abi;
const lightDebridgeAbi = require("../build/contracts/LightDebridge.json").abi;

const hecoWeb3 = new Web3(process.env.HECO_PROVIDER);
const bscWeb3 = new Web3(process.env.BSC_PROVIDER);
const ethWeb3 = new Web3(process.env.ETH_PROVIDER);

const bscInfo = {
  aggregatorInstance: new bscWeb3.eth.Contract(
    confirmationAggregatorAbi,
    process.env.BSC_AGGREGATOR
  ),
  debridgeInstance: new bscWeb3.eth.Contract(
    fullDebridgeAbi,
    process.env.BSC_DEBRIDGE
  ),
};
const hecoInfo = {
  aggregatorInstance: new hecoWeb3.eth.Contract(
    confirmationAggregatorAbi,
    process.env.HECO_AGGREGATOR
  ),
  debridgeInstance: new hecoWeb3.eth.Contract(
    fullDebridgeAbi,
    process.env.HECO_DEBRIDGE
  ),
};
const ethInfo = {
  aggregatorInstance: new ethWeb3.eth.Contract(
    signatureVerifierAbi,
    process.env.ETH_AGGREGATOR
  ),
  debridgeInstance: new ethWeb3.eth.Contract(
    lightDebridgeAbi,
    process.env.ETH_DEBRIDGE
  ),
};
const senderAddress = process.env.SENDER_ADDRESS;
const privKey = process.env.PRIVATE_KEY;
const oracleAddress = process.env.ORACLE_SENDER_ADDRESS;
const oraclePrivKey = process.env.ORACLE_PRIVATE_KEY;

async function sendBscToHeco() {
  const tokenAddress = ZERO_ADDRESS;
  const chainId = await bscInfo.debridgeInstance.methods.chainId().call();
  const receiver = senderAddress;
  const amount = toBN(toWei("0.1"));
  const chainIdTo = await hecoInfo.debridgeInstance.methods.chainId().call();
  const debridgeId = await bscInfo.debridgeInstance.methods
    .getDebridgeId(chainId, tokenAddress)
    .call();
  const tx = {
    from: senderAddress,
    to: bscInfo.debridgeInstance.options.address,
    value: amount,
    gasPrice: toWei("5", "gwei"),
    gas: 300000,
    data: bscInfo.debridgeInstance.methods
      .send(debridgeId, receiver, amount, chainIdTo)
      .encodeABI(),
  };
  const signedTx = await bscWeb3.eth.accounts.signTransaction(tx, privKey);
  console.log(signedTx);
  await bscWeb3.eth.sendSignedTransaction(
    signedTx.raw || signedTx.rawTransaction
  );
}

async function autosendBscToHeco() {
  const tokenAddress = ZERO_ADDRESS;
  const chainId = await bscInfo.debridgeInstance.methods.chainId().call();
  const receiver = senderAddress;
  const amount = toBN(toWei("0.1"));
  const executionFee = toBN(toWei("0.0001"));
  const chainIdTo = await hecoInfo.debridgeInstance.methods.chainId().call();
  const debridgeId = await bscInfo.debridgeInstance.methods
    .getDebridgeId(chainId, tokenAddress)
    .call();
  const tx = {
    from: senderAddress,
    to: bscInfo.debridgeInstance.options.address,
    value: amount,
    gasPrice: toWei("5", "gwei"),
    gas: 300000,
    data: bscInfo.debridgeInstance.methods
      .autoSend(
        debridgeId,
        receiver,
        amount,
        chainIdTo,
        receiver,
        executionFee,
        "0x"
      )
      .encodeABI(),
  };
  const signedTx = await bscWeb3.eth.accounts.signTransaction(tx, privKey);
  console.log(signedTx);
  await bscWeb3.eth.sendSignedTransaction(
    signedTx.raw || signedTx.rawTransaction
  );
}

async function sendBscToEth() {
  const tokenAddress = ZERO_ADDRESS;
  const chainId = await bscInfo.debridgeInstance.methods.chainId().call();
  const receiver = senderAddress;
  const amount = toBN(toWei("0.1"));
  const chainIdTo = await ethInfo.debridgeInstance.methods.chainId().call();
  const debridgeId = await bscInfo.debridgeInstance.methods
    .getDebridgeId(chainId, tokenAddress)
    .call();
  const tx = {
    from: senderAddress,
    to: bscInfo.debridgeInstance.options.address,
    value: amount,
    gasPrice: toWei("5", "gwei"),
    gas: 300000,
    data: bscInfo.debridgeInstance.methods
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
    to: chainInfo.aggregatorInstance.options.address,
    value: 0,
    gasPrice: toWei("5", "gwei"),
    gas: 300000,
    data: chainInfo.aggregatorInstance.methods.submit(submissionId).encodeABI(),
  };
  const signedTx = await web3.eth.accounts.signTransaction(tx, oraclePrivKey);
  console.log(signedTx);
  await web3.eth.sendSignedTransaction(signedTx.raw || signedTx.rawTransaction);
}
async function mintOnEth() {
  const aggregatorAddress = bscInfo.aggregatorInstance.options.address
    .slice(2)
    .toLowerCase();
  const tokenAddress = ZERO_ADDRESS;
  const chainId = await bscInfo.debridgeInstance.methods.chainId().call();
  const receiver = senderAddress;
  const amount = toBN("99400000000000000");
  const nonce = 0;
  const debridgeId = await ethInfo.debridgeInstance.methods
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
    to: ethInfo.debridgeInstance.options.address,
    value: 0,
    gasPrice: toWei("5", "gwei"),
    gas: 300000,
    data: ethInfo.debridgeInstance.methods
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
  const chainId = await bscInfo.debridgeInstance.methods.chainId().call();
  const receiver = senderAddress;
  const amount = toBN("99400000000000000");
  const chainIdTo = await hecoInfo.debridgeInstance.methods.chainId().call();
  const debridgeId = await ethInfo.debridgeInstance.methods
    .getDebridgeId(chainId, tokenAddress)
    .call();
  const debridge = await ethInfo.debridgeInstance.methods
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
      .approve(ethInfo.debridgeInstance.options.address, amount)
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
    to: ethInfo.debridgeInstance.options.address,
    value: 0,
    gasPrice: toWei("5", "gwei"),
    gas: 300000,
    data: ethInfo.debridgeInstance.methods
      .burn(debridgeId, receiver, amount, chainIdTo)
      .encodeABI(),
  };
  const signedTx = await ethWeb3.eth.accounts.signTransaction(tx, privKey);
  console.log(signedTx);
  await ethWeb3.eth.sendSignedTransaction(
    signedTx.raw || signedTx.rawTransaction
  );
}
async function mintOnHeco() {
  const tokenAddress = ZERO_ADDRESS;
  const chainId = await bscInfo.debridgeInstance.methods.chainId().call();
  const chainIdFrom = await bscInfo.debridgeInstance.methods.chainId().call();
  const receiver = senderAddress;
  const amount = toBN("99400000000000000");
  const nonce = 0;
  const debridgeId = await hecoInfo.debridgeInstance.methods
    .getDebridgeId(chainId, tokenAddress)
    .call();
  const tx = {
    from: senderAddress,
    to: hecoInfo.debridgeInstance.options.address,
    value: 0,
    gasPrice: toWei("5", "gwei"),
    gas: 300000,
    data: hecoInfo.debridgeInstance.methods
      .mint(debridgeId, chainIdFrom, receiver, amount, nonce)
      .encodeABI(),
  };
  const signedTx = await hecoWeb3.eth.accounts.signTransaction(tx, privKey);
  console.log(signedTx);
  await hecoWeb3.eth.sendSignedTransaction(
    signedTx.raw || signedTx.rawTransaction
  );
}
async function burnHecoToBsc() {
  const tokenAddress = ZERO_ADDRESS;
  const chainId = await bscInfo.debridgeInstance.methods.chainId().call();
  const receiver = senderAddress;
  const amount = toBN("99400000000000000");
  const chainIdTo = await bscInfo.debridgeInstance.methods.chainId().call();
  const debridgeId = await hecoInfo.debridgeInstance.methods
    .getDebridgeId(chainId, tokenAddress)
    .call();
  const debridge = await hecoInfo.debridgeInstance.methods
    .getDebridge(debridgeId)
    .call();
  const wrappedAsset = new hecoWeb3.eth.Contract(
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
      .approve(hecoInfo.debridgeInstance.options.address, amount)
      .encodeABI(),
  };
  const signedApproveTx = await hecoWeb3.eth.accounts.signTransaction(
    approveTx,
    privKey
  );
  console.log(signedApproveTx);
  await hecoWeb3.eth.sendSignedTransaction(
    signedApproveTx.raw || signedApproveTx.rawTransaction
  );
  const deadline = 0;
  const signature = "0x";
  const tx = {
    from: senderAddress,
    to: hecoInfo.debridgeInstance.options.address,
    value: 0,
    gasPrice: toWei("5", "gwei"),
    gas: 300000,
    data: hecoInfo.debridgeInstance.methods
      .burn(debridgeId, receiver, amount, chainIdTo, deadline, signature)
      .encodeABI(),
  };
  const signedTx = await hecoWeb3.eth.accounts.signTransaction(tx, privKey);
  console.log(signedTx);
  await hecoWeb3.eth.sendSignedTransaction(
    signedTx.raw || signedTx.rawTransaction
  );
}
async function claimOnBsc() {
  const tokenAddress = ZERO_ADDRESS;
  const chainId = await bscInfo.debridgeInstance.methods.chainId().call();
  const chainIdFrom = await hecoInfo.debridgeInstance.methods.chainId().call();
  const receiver = senderAddress;
  const amount = toBN("98803000000000000");
  const nonce = 0;
  const debridgeId = await bscInfo.debridgeInstance.methods
    .getDebridgeId(chainId, tokenAddress)
    .call();
  const tx = {
    from: senderAddress,
    to: bscInfo.debridgeInstance.options.address,
    value: 0,
    gasPrice: toWei("5", "gwei"),
    gas: 300000,
    data: bscInfo.debridgeInstance.methods
      .claim(debridgeId, chainIdFrom, receiver, amount, nonce)
      .encodeABI(),
  };
  const signedTx = await bscWeb3.eth.accounts.signTransaction(tx, privKey);
  console.log(signedTx);
  await bscWeb3.eth.sendSignedTransaction(
    signedTx.raw || signedTx.rawTransaction
  );
}

// autosendBscToHeco().catch(console.log);
// sendBscToHeco().catch(console.log);
confirmSubmit(
  hecoInfo,
  hecoWeb3,
  "0x010b39f257c212a71cd76f46089ca7d1efc38e52633fddc3c6d043c06a55f1ec"
).catch(console.log);
// confirmSubmit(
//   bscInfo,
//   bscWeb3,
//   "0x26c867f2fcb90c7666dc98118a345653f5c75e69607f8d0f828fa3fa80578473"
// ).catch(console.log);
// mintOnEth().catch(console.log);
// burnEthToHeco().catch(console.log);
// confirmSubmit(
//   hecoInfo,
//   hecoWeb3,
//   "0x7ffe7870ec9c1430bbf4f2fbc366971d69109e6c4a088f9e6730905351cd8f53"
// ).catch(console.log);
// mintOnHeco().catch(console.log);
// burnHecoToBsc().catch(console.log);
// confirmSubmit(
//   bscInfo,
//   bscWeb3,
//   "0x795d7fa2a37461bcdb942c41f5bcd392311f60a9d25b3cd55a1eff2a78d449df"
// ).catch(console.log);
// claimOnBsc().catch(console.log);
