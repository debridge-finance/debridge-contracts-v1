const GovToken = artifacts.require("WrappedAsset");
const { toWei } = web3.utils;

module.exports = async function(deployer, network, accounts) {
  if (network == "test") return;
  const supply = toWei("3200000");

//   constructor(
//     string memory _name,
//     string memory _symbol,
//     uint8 _tokenDecimals,
//     address _admin,
//     address[] memory _minters
// )
  await deployer.deploy(GovToken, "Debridge token", "DBR", 18, accounts[0], accounts[0]);
  console.log("GovToken: " + GovToken.address);
};
