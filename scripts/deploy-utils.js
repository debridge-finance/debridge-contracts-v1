const fs = require("fs");
const hre = require("hardhat");
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const PROXIES_STORE = 'scripts/proxies.json'

/**
store structure
{
    network_name: {
        implementation_bytecode_hash: [
            // proxy 1
            {
                address: '',
                txhash: '',
                args_hash: '',
                signer: '',
            }
        ],
    }
}
*/

async function _readStore() {
  try {
    const data = await fs.promises.readFile(PROXIES_STORE);
    if (data == "") {
      // empty store
      return {}
    } else {
      return JSON.parse(data);
    }
  } catch (err) {
    // skip no file errors
    if (err.code !== 'ENOENT') {
      console.error(err);
    }
    return {}
  }
}

async function _updateStore(store) {
  await fs.promises.writeFile(PROXIES_STORE, JSON.stringify(store, null, 2));
}

function hashJSONArgs(args) {
  const argsBytes = hre.ethers.utils.toUtf8Bytes(JSON.stringify(args));
  return hre.ethers.utils.keccak256(argsBytes);
}

async function saveProxyDeployment(Factory, instance, args) {
  let store = await _readStore();
  const bytecodeHash = hre.ethers.utils.keccak256(Factory.bytecode);
  const argsHash = hashJSONArgs(args);

  if (!(hre.network.name in store)) {
    store[hre.network.name] = {};
  }

  if (!(bytecodeHash in store[hre.network.name])) {
    store[hre.network.name][bytecodeHash] = [];
  }

  if (!store[hre.network.name][bytecodeHash].find(i => i.address === instance.address)) {
    store[hre.network.name][bytecodeHash].push({
      address: instance.address,
      txhash: instance.deployTransaction.hash,
      args_hash: argsHash,
      signer: Factory.signer.address,
    });
    await _updateStore(store);
  }
}

async function deleteProxyDeployment(Factory, proxy_address) {
  let store = await _readStore();
  const bytecodeHash = hre.ethers.utils.keccak256(Factory.bytecode);

  if (!(hre.network.name in store)) {
    return
  }

  if (!(bytecodeHash in store[hre.network.name])) {
    return
  }

  if (store[hre.network.name][bytecodeHash].find(i => i.address === proxy_address)) {
    console.log('\tRemoving stale proxy deployment: ', proxy_address);
    store[hre.network.name][bytecodeHash] = store[hre.network.name][bytecodeHash].filter(i => i.address !== proxy_address)
    await _updateStore(store);
  }
}

async function deployProxy(contractName, deployer, args, reuseProxy) {
  console.log(`\n*** Deploying proxy for ${contractName} ***`);
  console.log('\tSigner: ', deployer);
  console.log('\tArgs: ', args);
  console.log('\treuseProxy: ', reuseProxy);

  const Factory = await hre.ethers.getContractFactory(contractName, deployer);

  if (reuseProxy) {
    let deployedProxies = await getDeployedProxies(Factory, args);
    console.log('\tFound deployed proxies: ', deployedProxies.length);

    while (deployedProxies.length) {
      const deployedProxy = deployedProxies.pop();
      const proxy = await Factory.attach(deployedProxy.address);
      if (await proxy.provider.getCode(proxy.address) === "0x") {
        // no contract found
        deleteProxyDeployment(Factory, deployedProxy.address);
        continue
      }
      const implementation = await getImplementationAddress(hre.ethers.provider, proxy.address)
      console.log(`\tImplementation address: ${implementation}`);
      console.log(`\tReuse Proxy with address: ${deployedProxy.address}`);
      return {
        contract: proxy,
        isDeployed: false,
      }
    }
    console.log('\tNo deployed proxies found, deploying a new one');
  }

  // real deploy
  const proxy = await hre.upgrades.deployProxy(Factory, args);
  const receipt = await proxy.deployed();
  await saveProxyDeployment(Factory, proxy, args);

  const implementation = await getImplementationAddress(hre.ethers.provider, proxy.address)
  console.log('\tImplementation address:', implementation);
  console.log('\tNew proxy deployed: ', proxy.address);

  return {
    contract: proxy,
    receipt: receipt,
    isDeployed: true,
  }
}

async function getDeployedProxies(Factory, args) {
  const store = await _readStore();
  const bytecodeHash = hre.ethers.utils.keccak256(Factory.bytecode);

  if (hre.network.name in store) {
    if (bytecodeHash in store[hre.network.name]) {
      let proxies = store[hre.network.name][bytecodeHash];

      // filter by deployer
      proxies = proxies.filter(i => i.signer === Factory.signer.address)

      if (args) {
        // filter by args
        const argsHash = hashJSONArgs(args);
        proxies = proxies.filter(i => i.args_hash === argsHash)
      }

      return proxies;
    }
  }
  return []
}

async function getLastDeployedProxy(contractName, deployer, args) {
  const Factory = await hre.ethers.getContractFactory(contractName, deployer);
  const proxies = await getDeployedProxies(Factory, args);
  if (proxies.length) {
    const proxyAddress = proxies.pop().address;
    return await Factory.attach(proxyAddress);
  }
  throw `No deployed proxy found for "${contractName}"`;
}

module.exports = {
  deployProxy,
  getDeployedProxies,
  getLastDeployedProxy
};