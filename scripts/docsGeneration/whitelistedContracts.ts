// TODO merge when NatSpec for all the docs in Readme are ready
import assert from "assert";
import fs from "fs";

const contractsWhitelistedForDocs = [
    'transfers/DeBridgeGate.sol',
    'interfaces/IDeBridgeGate.sol',
    'transfers/DeBridgeTokenDeployer.sol',
    'interfaces/IDeBridgeTokenDeployer.sol',
    'transfers/SignatureVerifier.sol',
    'interfaces/ISignatureVerifier.sol',
    'periphery/CallProxy.sol',
    'interfaces/ICallProxy.sol',
    'libraries/Flags.sol'
];

const contractsWhitelistedForReadme = [
    'transfers/AggregatorBase.sol',
    'transfers/DeBridgeGate.sol',
    'transfers/DeBridgeTokenDeployer.sol',
    'transfers/SignatureVerifier.sol',
    'transfers/WethGate.sol',
    'periphery/CallProxy.sol',
    'periphery/DeBridgeToken.sol',
    'periphery/DeBridgeTokenProxy.sol',
    'periphery/SimpleFeeProxy.sol',
];

const toContractPathFromProjectRoot = (path: string) => `contracts/${path}`;
const assertExists = (path: string) => assert(fs.existsSync(path), `${path} does not exist.`);

[...contractsWhitelistedForDocs, ...contractsWhitelistedForReadme]
    .map(toContractPathFromProjectRoot)
    .forEach(assertExists)

export {contractsWhitelistedForDocs, contractsWhitelistedForReadme};