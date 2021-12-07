import globby from "globby";
import {CONTRACT_DOCS_PATH} from "./generateTableOfContents/parts/constants";
import {sync as deleteEmptyDirsIn} from "delete-empty";
import path from "path";
import {contractsWhitelistedForDocs} from "./whitelistedContracts";
import * as fs from "fs";


const changeExtensionToMd = (contractPath: string) => contractPath.replace(/.sol$/, '.md');
const toPathFromProjectRoot = (path: string) => `${CONTRACT_DOCS_PATH}${path}`;
const whitelistedDocsAsExceptions = contractsWhitelistedForDocs
    .map(changeExtensionToMd)
    .map(toPathFromProjectRoot)
    .map(path => `!${path}`)
;

const filesToRemove = globby.sync([`${CONTRACT_DOCS_PATH}**/*.md`, ...whitelistedDocsAsExceptions]);
filesToRemove.forEach(path => fs.unlinkSync(path));

deleteEmptyDirsIn(path.resolve(CONTRACT_DOCS_PATH));