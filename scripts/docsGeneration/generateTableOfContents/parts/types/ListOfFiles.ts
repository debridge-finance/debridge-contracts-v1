export type ListOfFiles = { [fileOrDirName: string]: string | ListOfFiles };
export type FileEntry = [fileName: string, filePathWithFileName: string];
export type DirEntry = [dirName: string, dirContent: ListOfFiles];
export type ListOfFilesEntry = [name: string, value: string | ListOfFiles];