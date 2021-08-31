const {deployments, ethers} = require('hardhat');

// set empty function to fix migration error
module.exports = async function(){};

module.exports.ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

module.exports.getUniswapFactory = async (deployer, network) => {
  const UniswapV2Factory = await deployments.getArtifact('UniswapV2Factory');

  let uniswapFactory;
  switch (network) {
  case "development":
    try {
      await UniswapV2Factory.deployed();
    } catch (e) {
      await deployer.deploy(UniswapV2Factory, module.exports.ZERO_ADDRESS);
    }
    uniswapFactory = (await UniswapV2Factory.deployed()).address;
    break;
  case "hecotest":
    uniswapFactory = "0x4fDbE004745c62934C5170c931768Ed1Cc8ceC99";
    break;
  case "test":
    uniswapFactory = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
    break;
  case "kovan":
  case "ethereum":
  case "kovantest":
    uniswapFactory = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
    break;
  case "bsctest":
    uniswapFactory = "0x07E5b90f3761015Ee0BA6e20Ea45652C6Bf5Ce00";
    break;
  case "bsc":
    uniswapFactory = "0xBCfCcbde45cE874adCB698cC183deBcF17952812";
    break;
  default:
    break;
  }
  return uniswapFactory;
};

module.exports.getWeth = async (deployer, network) => {
  const WETH9 = await deployments.getArtifact('WETH9');
  let weth;
  switch (network) {
  case "development":
    await deployer.deploy(WETH9);
    weth = (await WETH9.deployed()).address;
    break;
  case "test":
    weth = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    break;
  case "kovan":
  case "hecotest":
  case "kovantest":
  case "bsctest":
    try {
      await WETH9.deployed();
    } catch (e) {
      await deployer.deploy(WETH9);
    }
    weth = (await WETH9.deployed()).address;
    break;
  case "ethereum":
    weth = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    break;
  case "bsc":
    weth = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
    break;
  default:
    break;
  }
  return weth;
};
