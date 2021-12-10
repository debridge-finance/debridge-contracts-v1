import getListOfFiles from "./parts/getListOfFiles";
import {CONTRACT_DOCS_PATH} from "./parts/constants";
import generateReadmesForDirsRecursively from "./parts/generateReadmesForDirsRecursively";
import generateSidebarToc from "./parts/generateSidebarToc";
import writeTocToSummary from "./parts/writeTocToSummary";

const listOfFiles = getListOfFiles();
generateReadmesForDirsRecursively(CONTRACT_DOCS_PATH, listOfFiles);
const sidebarToc = generateSidebarToc(listOfFiles);
writeTocToSummary(sidebarToc);