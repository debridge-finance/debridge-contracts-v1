import globby from "globby";
import set from "lodash/set";
import {CONTRACT_DOCS_PATH} from "./constants";
import {ListOfFiles} from "./types/ListOfFiles";

export default async function getListOfFiles(): Promise<ListOfFiles> {
    const pathsFromRoot = await globby([`${CONTRACT_DOCS_PATH}**/*.md`]);

    const pathToContractsDirLength = `${CONTRACT_DOCS_PATH}`.length;
    const removeContractsDir = (path: string): string => path.slice(pathToContractsDirLength);
    const contractsPaths = pathsFromRoot
        .map(removeContractsDir)
        .sort()

    const result: ListOfFiles = {};

    contractsPaths.forEach((pathWithFilename: string) => {
        const pathWithFilenameSplit = pathWithFilename.split('/');
        set(result, pathWithFilenameSplit, pathWithFilename);
    });

    return result;
}