const DelegatedStaking = artifacts.require("DelegatedStaking");
const { getLinkAddress } = require("./utils");
const { deployProxy } = require("@openzeppelin/truffle-upgrades");

module.exports = async function(deployer, network) {
  if (network == "test") return;
  const link = await getLinkAddress(deployer, network);
  const DelegatedStakingInitParams = require("../assets/delegatedStakingInitParams")[network];
  await deployProxy(
    DelegatedStaking, 
    [
      DelegatedStakingInitParams.timelock, 
      link
    ], 
    { deployer }
  );
  console.log("DelegatedStaking: " + (await DelegatedStaking.deployed()).address);
};
