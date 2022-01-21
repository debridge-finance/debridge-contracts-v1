import {DirEntry, FileEntry, ListOfFilesEntry} from "./types/ListOfFiles";
import {README_NAME} from "./constants";

export const isFile = (x: ListOfFilesEntry): x is FileEntry => typeof x[1] === 'string';
export const isDir = (x: ListOfFilesEntry): x is DirEntry => !isFile(x);
export const notReadme = ([name]: FileEntry) => name !== README_NAME;