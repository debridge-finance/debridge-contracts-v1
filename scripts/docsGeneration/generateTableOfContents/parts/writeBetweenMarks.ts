import {readFileSync, writeFileSync} from "fs";
import {escapeRegExp} from "lodash";
import assert from "assert";

export default function writeBetweenMarks(
    startMark: string,
    endMark: string,
    replacement: string,
    filePath: string
): void {
    const oldContent = readFileSync(filePath).toString();
    assert(oldContent.includes(startMark) && oldContent.includes(endMark), `No marks found in ${filePath}`);

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