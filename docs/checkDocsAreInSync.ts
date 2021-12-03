import {execSync} from "child_process";
import assert from "assert";

// See https://stackoverflow.com/a/545413
const findHashOfDocsDir = `find docs/ -type f -print0 | sort -z | xargs -0 sha1sum | sha1sum`;

const hashBefore = execSync(findHashOfDocsDir, {encoding: 'utf8'});
execSync('yarn docs');
const hashAfter = execSync(findHashOfDocsDir, {encoding: 'utf8'});
assert(hashBefore === hashAfter, 'Docs are not in sync');
console.log('Docs are in sync');