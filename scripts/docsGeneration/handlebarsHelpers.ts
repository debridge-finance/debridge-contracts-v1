import {contractsWhitelistedForReadme} from "./whitelistedContracts";
import {upperFirst} from "lodash";

function getName(path: string): string {
    const nameWithExtension = path.split('/').pop();
    return nameWithExtension.replace(/.sol$/, '');
}

const contractNamesWhitelistedForReadme = contractsWhitelistedForReadme.map(getName);

const isWhitelisted = (name: string): boolean => {
    return contractNamesWhitelistedForReadme.includes(name);
};

const getPathWithoutFileNameUpperFirst = (path: string): string => {
    const pathWithoutFileName = path.split('/').slice(0, -1).join('/');
    return upperFirst(pathWithoutFileName);
}

const seenPaths: string[] = [];
const isPathWithoutFileNameNeverSeen = (path: string): boolean => {
    const pathWithoutFileName = getPathWithoutFileNameUpperFirst(path);
    const isPathNeverSeen = !seenPaths.includes(pathWithoutFileName);
    if (isPathNeverSeen){
        seenPaths.push(pathWithoutFileName);
    }
    return isPathNeverSeen;
}

export {isWhitelisted, isPathWithoutFileNameNeverSeen, getPathWithoutFileNameUpperFirst};