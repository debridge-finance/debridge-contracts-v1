import globby from "globby";
import {CONTRACT_DOCS_PATH} from "./generateTableOfContents/parts/constants";
import * as fs from "fs";
import {sync as deleteEmptyDirsIn} from "delete-empty";
import path from "path";

const whitelistedDocs = [
    'transfers/DeBridgeGate.md',
    'transfers/DeBridgeTokenDeployer.md',
    'transfers/SignatureVerifier.md',
    'periphery/CallProxy.md',
];

const exceptions = whitelistedDocs.map(path => `!${CONTRACT_DOCS_PATH}${path}`);
const filesToRemove = globby.sync([`${CONTRACT_DOCS_PATH}**/*.md`, ...exceptions]);
filesToRemove.forEach(path => fs.unlinkSync(path));
deleteEmptyDirsIn(path.resolve(CONTRACT_DOCS_PATH));