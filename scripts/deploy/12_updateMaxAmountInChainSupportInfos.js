const debridgeInitParams = require("../../assets/debridgeInitParams");
const { getLastDeployedProxy, waitTx } = require("../deploy-utils");

module.exports = async function({getNamedAccounts, deployments, network}) {
    const deployInitParams = debridgeInitParams[network.name];
    const wethAddress = deployInitParams.external.WETH || (await deployments.get("MockWeth")).address;

    const deBridgeGateInstance = await getLastDeployedProxy("DeBridgeGate", [
        deployInitParams.excessConfirmations,
        wethAddress,
      ]);

    console.log("setChainSupportMaxAmount");
    console.log("deployInitParams.supportedChains: ", deployInitParams.supportedChains);
    console.log("deployInitParams.chainSupportInfo before: ", deployInitParams.chainSupportInfo);
    
    
    deployInitParams.supportedChains.forEach(async (id, i) => {
        // TODO check that we need to update maxAmount
        const tx = await deBridgeGateInstance.setChainSupportMaxAmount(
            id, 
            deployInitParams.chainSupportInfo[i].maxAmount
        );
        await waitTx(tx);
    });
}

module.exports.tags = ['12_updateMaxAmountInChainSupportInfos'];
module.exports.dependencies = [
    '09_DeBridgeGateSetup'
];