import {readFileSync, writeFileSync} from "fs";
import {escapeRegExp} from "lodash";
import {SUMMARY_PATH, TOC_END_MARK, TOC_START_MARK} from "./constants";

export default async function writeTocToSummary(toc: string): Promise<void> {
    const oldSummary = readFileSync(SUMMARY_PATH).toString();
    const startMark = escapeRegExp(TOC_START_MARK);
    const endMark = escapeRegExp(TOC_END_MARK);
    const regexp = new RegExp(
        `${startMark}(.*)${endMark}`,
        's'
    );
    const newSummary = oldSummary.replace(
        regexp,
        `${TOC_START_MARK}\n${toc}\n\n${TOC_END_MARK}`
    );
    writeFileSync(SUMMARY_PATH, newSummary);
}