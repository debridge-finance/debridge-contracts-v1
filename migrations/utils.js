const zeroAddress = "0x0000000000000000000000000000000000000000";

const MockLinkToken = artifacts.require("MockLinkToken");
const WETH9 = artifacts.require("WETH9");
const UniswapV2Factory = artifacts.require("UniswapV2Factory");

module.exports.getLinkAddress = async (deployer, network, accounts) => {
  let link;
  switch (network) {
    case "development":
      try {
        await MockLinkToken.deployed();
      } catch (e) {
        await deployer.deploy(MockLinkToken, "Link Token", "dLINK", 18);
        const linkToken = await MockLinkToken.deployed();
        await linkToken.mint(accounts[0], "100000000000000000000");
      }
      link = (await MockLinkToken.deployed()).address;
      break;
    case "hecotest":
      link = "0xdc338BB3E05D51148822f263907228a1897D4df6";
      break;
    case "kovantest":
    case "kovan":
      link = "0xa36085F69e2889c224210F603D836748e7dC0088";
      break;
    case "bsctest":
      link = "0xdc338BB3E05D51148822f263907228a1897D4df6";
      break;
    case "bsc":
      link = "0x89F3A11E8d3B7a9F29bDB3CdC1f04c7e6095B357";
      break;
    default:
      link = "0x514910771af9ca656af840dff83e8264ecf986ca";
      break;
  }
  return link;
};

module.exports.getUniswapFactory = async (deployer, network) => {
  let uniswapFactory;
  switch (network) {
    case "development":
      try {
        await UniswapV2Factory.deployed();
      } catch (e) {
        await deployer.deploy(UniswapV2Factory, zeroAddress);
      }
      uniswapFactory = (await UniswapV2Factory.deployed()).address;
      break;
    case "hecotest":
      uniswapFactory = "0x4fDbE004745c62934C5170c931768Ed1Cc8ceC99";
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
    case "bsc":
      uniswapFactory = "0xBCfCcbde45cE874adCB698cC183deBcF17952812";
      break;
    default:
      break;
  }
  return uniswapFactory;
};

module.exports.getWeth = async (deployer, network) => {
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
