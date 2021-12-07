import {execSync} from "child_process";
import assert from "assert";

// See https://stackoverflow.com/a/545413
const findHashOfDocsDir = `find docs/ -type f -print0 | sort -z | xargs -0 sha1sum | sha1sum`;
const findHashOfMainReadme = `sha1sum README.md`;

const docsHashBefore = execSync(findHashOfDocsDir, {encoding: 'utf8'});
const mainReadmeHashBefore = execSync(findHashOfMainReadme, {encoding: 'utf8'});

execSync('yarn docs');

const docsHashAfter = execSync(findHashOfDocsDir, {encoding: 'utf8'});
const mainReadmeHashAfter = execSync(findHashOfMainReadme, {encoding: 'utf8'});

assert(
    (docsHashBefore === docsHashAfter) && (mainReadmeHashBefore === mainReadmeHashAfter),
    'Docs are not in sync'
);
console.log('Docs are in sync');