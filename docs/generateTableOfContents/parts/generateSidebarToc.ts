import {upperFirst} from "lodash";
import {DirEntry, FileEntry, ListOfFiles} from "./types/ListOfFiles";
import {isDir, isFile, notReadme} from "./filters";
import {toLink} from "./toLink";
import {CONTRACTS_PATH_IN_DOCS, README_NAME} from "./constants";

export default function generateSidebarToc(listOfFiles: ListOfFiles): string {
    const title = `## Contracts\n`;

    const entries = Object.entries(listOfFiles);
    const fileEntries = entries.filter(isFile).filter(notReadme);
    const dirEntries = entries.filter(isDir);

    const dirLinks = dirEntries.map(generateDirLinksWithSubLinks);
    const fileLinks = fileEntries.map(([name, path]) => toLink(name, CONTRACTS_PATH_IN_DOCS + path));

    return title + [...dirLinks, ...fileLinks].join('\n');
}

function generateDirLinksWithSubLinks([name, content]: DirEntry): string {
    const dirLink = toLink(upperFirst(name), `${CONTRACTS_PATH_IN_DOCS}${name}/${README_NAME}`);

    const entries = Object.entries(content);
    const dirEntries = entries.filter(isDir);
    const fileEntries = entries.filter(isFile).filter(notReadme);

    const dirsContentFlat: FileEntry[] = dirEntries
        .map(([, content]) => content)
        .map(flattenDirContent)
        .flat()
    ;

    const indent = (str: string) => `  ${str}`;
    const subLinks = [...fileEntries, ...dirsContentFlat]
        .map(([fileName, filePath]) => toLink(fileName, CONTRACTS_PATH_IN_DOCS + filePath))
        .map(indent)
        .join('\n');

    return `${dirLink}\n${subLinks}`;
}

function flattenDirContent(listOfFiles: ListOfFiles): FileEntry[] {
    const entries = Object.entries(listOfFiles);
    const dirEntries = entries.filter(isDir);
    const fileEntries = entries.filter(isFile).filter(notReadme);

    const dirContent: FileEntry[] = dirEntries
        .map(([, content]) => content)
        .map(flattenDirContent)
        .flat()
    ;

    return [...dirContent, ...fileEntries];
}