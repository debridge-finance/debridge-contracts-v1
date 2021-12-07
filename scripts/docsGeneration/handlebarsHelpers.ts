import {contractsWhitelistedForReadme} from "./whitelistedContracts";

function getName(path: string): string {
    const nameWithExtension = path.split('/').pop();
    return nameWithExtension.replace(/.sol$/, '');
}

const contractNamesWhitelistedForReadme = contractsWhitelistedForReadme.map(getName);

const isWhitelisted = (name: string): boolean => {
    return contractNamesWhitelistedForReadme.includes(name);
};

export {isWhitelisted};