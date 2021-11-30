import getListOfFiles from "./parts/getListOfFiles";
import {CONTRACTS_PATH} from "./parts/constants";
import generateReadmesForDirsRecursively from "./parts/generateReadmesForDirsRecursively";
import generateSidebarToc from "./parts/generateSidebarToc";
import writeTocToSummary from "./parts/writeTocToSummary";


async function main() {
    const listOfFiles = await getListOfFiles();
    generateReadmesForDirsRecursively(CONTRACTS_PATH, listOfFiles);
    const sidebarToc = generateSidebarToc(listOfFiles);
    await writeTocToSummary(sidebarToc);
}

main().catch(e => console.error(e));