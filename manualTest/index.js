require("dotenv-flow").config();

const Web3 = require("web3");
const { toBN, toWei, toChecksumAddress, fromWei } = require("web3-utils");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
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

async function sendBscToEth() {
  const tokenAddress = ZERO_ADDRESS;
  const chainId = await bscInfo.whiteDebridgeInstance.methods.chainId().call();
  const receiver = senderAddress;
  const amount = toBN(toWei("0.1"));
  const chainIdTo = 42;
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
async function mintOnEth() {}
async function burnEthToHeco() {}
async function mintOnHeco() {}
async function burnHecoToBsc() {}
async function claimOnBsc() {}

sendBscToEth().catch(console.log);
