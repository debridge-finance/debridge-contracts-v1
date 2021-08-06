const DelegatedStaking = artifacts.require("DelegatedStaking");
const { getLinkAddress } = require("./utils");

module.exports = async (deployer, network) => {
  if (network == "test") return;
  const link = await getLinkAddress(deployer, network);
  const DelegatedStakingInitParams = require("../assets/delegatedStakingInitParams")[network];
  const delegatedStaking = await upgrades.deployProxy(this.DelegatedStaking, [
        DelegatedStakingInitParams.timelock,
        link
    ]);
  await this.delegatedStaking.deployed();
//   const delegatedStaking = await new(
//     DelegatedStaking, 
//     [
//       DelegatedStakingInitParams.timelock,
//       link
//     ]);
//   DelegatedStaking.setAsDeployed(delegatedStaking);
  console.log("DelegatedStaking: ", delegatedStaking.address);
};
