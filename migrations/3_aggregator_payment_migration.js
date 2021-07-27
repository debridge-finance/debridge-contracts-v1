const ConfirmationAggregator = artifacts.require("ConfirmationAggregator");
const SignatureAggregator = artifacts.require("SignatureAggregator");
const ILinkToken = artifacts.require("ILinkToken");
const { getLinkAddress } = require("./utils");

module.exports = async function(deployer, network) {
  // if (network == "test") return;
  // const debridgeInitParams = require("../assets/debridgeInitParams")[network];
  // if (debridgeInitParams.type == "light") return;

  // let amount = web3.utils.toWei("1");
  // const link = await getLinkAddress(deployer, network);

  // const linkTokenInstance = await ILinkToken.at(link);
  // await linkTokenInstance.transferAndCall(
  //   ConfirmationAggregator.address.toString(),
  //   amount,
  //   "0x"
  // );
  // await linkTokenInstance.transferAndCall(
  //   SignatureAggregator.address.toString(),
  //   amount,
  //   "0x"
  // );
};
