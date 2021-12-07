import {SUMMARY_PATH, TOC_END_MARK, TOC_START_MARK} from "./constants";
import writeBetweenMarks from "./writeBetweenMarks";

export default async function writeTocToSummary(toc: string): Promise<void> {
    writeBetweenMarks(
        TOC_START_MARK,
        TOC_END_MARK,
        toc,
        SUMMARY_PATH
    )
}