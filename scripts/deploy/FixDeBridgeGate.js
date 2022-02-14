const { ethers, upgrades } = require("hardhat");
const { upgradeProxy } = require("../deploy-utils");
const { waitTx } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
  const { deployer } = await getNamedAccounts();

  console.log('*'.repeat(80));
  console.log(`\tStart upgrade deBridgeGate to fix 1.3.0.1 version`);
  console.log(`\tfrom DEPLOYER ${deployer}`);
  console.log('*'.repeat(80));

  // upgradeProxy(contractName, contractAddress, deployer)
  const { contract, receipt} = await upgradeProxy(
      "DeBridgeGate",
      "0x91C1Cf4032203D7905fE40FB573782F99D30E326",
      deployer);

  console.log(`end upgradeProxy`);
  // console.log(contract);
  // console.log(receipt);
  const newVersion = await contract.version();
  console.log(`newVersion: ${newVersion}`);


//   console.log(`Start Fix Weth`);

//   const deBridgeGateFactory = await ethers.getContractFactory("DeBridgeGate", deployer);
//   const deBridgeGateInstance = await deBridgeGateFactory.attach("0x91C1Cf4032203D7905fE40FB573782F99D30E326");

//   console.log("deBridgeGateInstance ", deBridgeGateInstance.address);
//   let tx = await deBridgeGateInstance.fixWeth();
//   await waitTx(tx);

//   console.log("End Fix Weth");
};

module.exports.tags = ["FixDeBridgeGate"];
module.exports.dependencies = [''];