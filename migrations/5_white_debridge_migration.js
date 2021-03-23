const WhiteDebridge = artifacts.require("WhiteDebridge");
const WhiteAggregator = artifacts.require("WhiteAggregator");
const FeeProxy = artifacts.require("FeeProxy");
const DefiController = artifacts.require("DefiController");
const { getWeth } = require("./utils");

module.exports = async function (deployer, network) {
  let minAmount = process.env.MIN_TRANSFER_AMOUNT;
  let transferFee = process.env.TRANSFER_FEE;
  let supportedChainIds = JSON.parse(process.env.SUPPORTED_CHAINS);
  let weth = await getWeth(deployer, network);

  await deployer.deploy(
    WhiteDebridge,
    minAmount,
    transferFee,
    WhiteAggregator.address.toString(),
    supportedChainIds,
    weth,
    FeeProxy.address.toString(),
    DefiController.address.toString()
  );
};
