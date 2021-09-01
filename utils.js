const fs = require("fs");

module.exports.saveAddress = async (networkName, contractName, contractAddress) => {
    //console.log(`saveAddress ${networkName} ${contractName} ${contractAddress}`);
    //const fileName = `./deploy_${networkName}.json`;
    //await fs.promises.mkdir(fileName, { recursive: true });

    //const jsonString = await fs.promises.readFile(fileName);
    //const data = JSON.parse(jsonString);

    //console.log(data);
    //////TODO: add lock
    ////const file = path_1.default.join(path_1, `${networkName}.json`);
    ////const data = JSON.parse(await fs_1.promises.readFile(file, 'utf8'));
    ////const existing = data.contracts.findIndex(p => p.address === proxy.address);
    ////if (existing >= 0) {
    ////    data.proxies.splice(existing, 1);
    ////}
    //const contractInfo = { name: contractName, address: contractAddress };
    //data.proxies.push(contractInfo);

    //console.log(data);
    //console.log(SON.stringify(data));

    //await fs.promises.writeFile(fileName, JSON.stringify(data));
};


module.exports.getContractAddress = async (network, byteCodeImplementanionHash) => {
    let fileName =  network.name;

    if(network.name == "development") {
        fileName =  "mainnet";
    }
    else if (network.name != "kovan"){
        fileName = `unknown-${network.config.chainId}`;
    }
    const jsonString = await fs.promises.readFile(`.openzeppelin/${fileName}.json`);
    const deployConfig = JSON.parse(jsonString);
    const existing = deployConfig.proxies.findIndex(p => p.byteCodeImplementanionHash === byteCodeImplementanionHash);
    if (existing >= 0) {
        // console.log("Exist " + deployConfig.proxies[existing].address);
        return deployConfig.proxies[existing].address;
    }
    return "";
};