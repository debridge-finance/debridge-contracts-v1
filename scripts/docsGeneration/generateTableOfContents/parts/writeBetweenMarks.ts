import {readFileSync, writeFileSync} from "fs";
import {escapeRegExp} from "lodash";

export default function writeBetweenMarks(
    startMark: string,
    endMark: string,
    replacement: string,
    filePath: string
): void {
    const oldContent = readFileSync(filePath).toString();
    const startMarkEscaped = escapeRegExp(startMark);
    const endMarkEscaped = escapeRegExp(endMark);
    const regexp = new RegExp(
        `${startMarkEscaped}(.*)${endMarkEscaped}`,
        's'
    );
    const newContent = oldContent.replace(
        regexp,
        `${startMark}\n${replacement}\n\n${endMark}`
    );
    writeFileSync(filePath, newContent);
}