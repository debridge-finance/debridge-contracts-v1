import {FileEntry} from "./types/ListOfFiles";

export default ([fileName, filePath]: FileEntry) => [
    fileName.replace(/.md$/, ''),
    filePath,
];