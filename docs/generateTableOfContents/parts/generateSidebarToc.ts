import {upperFirst} from "lodash";
import {DirEntry, ListOfFiles} from "./types/ListOfFiles";
import {isDir, isFile, notReadme} from "./filters";
import {toLink} from "./toLink";
import {CONTRACTS_PATH_IN_DOCS, README_NAME} from "./constants";

export default function generateSidebarToc(listOfFiles: ListOfFiles): string {
    const title = `## Contracts\n`;

    const entries = Object.entries(listOfFiles);
    const fileEntries = entries.filter(isFile).filter(notReadme);
    const dirEntries = entries.filter(isDir);

    const dirLinks = dirEntries.map(entry => generateDirLinksWithSubLinks(entry));
    const fileLinks = fileEntries.map(([name, path]) => toLink(name, CONTRACTS_PATH_IN_DOCS + path));

    return title + [...dirLinks, ...fileLinks].join('\n');
}

function generateDirLinksWithSubLinks(
    [name, content]: DirEntry,
    level = 1,
    path = CONTRACTS_PATH_IN_DOCS
): string {
    const indent = (str: string): string => '  '.repeat(level) + str;

    const dirLink = toLink(upperFirst(name), `${path}${name}/${README_NAME}`);
    const dirLinkIndented = '  '.repeat(level - 1) + dirLink;

    const entries = Object.entries(content);
    const dirEntries = entries.filter(isDir);
    const fileEntries = entries.filter(isFile).filter(notReadme);

    const subDirLinks = dirEntries.map(entry =>
        generateDirLinksWithSubLinks(entry, level + 1, `${path}${name}/`)
    ).join('\n');

    const subLinks = fileEntries
        .map(([fileName, filePath]) => toLink(fileName, CONTRACTS_PATH_IN_DOCS + filePath))
        .map(indent)
        .join('\n');

    return `${dirLinkIndented}\n${subLinks}\n${subDirLinks}`;
}
