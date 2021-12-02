import globby from "globby";
import {CONTRACT_DOCS_PATH} from "./generateTableOfContents/parts/constants";
import * as fs from "fs";
import {sync as deleteEmptyDirsIn} from "delete-empty";
import path from "path";
import assert from "assert";

const whitelistedContracts = [
    'transfers/DeBridgeGate.sol',
    'interfaces/IDeBridgeGate.sol',
    'transfers/DeBridgeTokenDeployer.sol',
    'interfaces/IDeBridgeTokenDeployer.sol',
    'transfers/SignatureVerifier.sol',
    'interfaces/ISignatureVerifier.sol',
    'periphery/CallProxy.sol',
];

const toContractPathFromProjectRoot = (path: string) => `contracts/${path}`;
const assertExists = (path: string) => assert(fs.existsSync(path));
whitelistedContracts
    .map(toContractPathFromProjectRoot)
    .forEach(assertExists)
;

const changeExtensionToMd = (contractPath: string) => contractPath.replace(/.sol$/, '.md');
const toPathFromProjectRoot = (path: string) => `${CONTRACT_DOCS_PATH}${path}`;
const whitelistedDocsAsExceptions = whitelistedContracts
    .map(changeExtensionToMd)
    .map(toPathFromProjectRoot)
    .map(path => `!${path}`)
;

const filesToRemove = globby.sync([`${CONTRACT_DOCS_PATH}**/*.md`, ...whitelistedDocsAsExceptions]);
filesToRemove.forEach(path => fs.unlinkSync(path));

deleteEmptyDirsIn(path.resolve(CONTRACT_DOCS_PATH));