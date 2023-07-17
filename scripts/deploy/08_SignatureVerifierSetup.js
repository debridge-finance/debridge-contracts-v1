const { ethers, upgrades } = require("hardhat");
const { waitTx, getLastDeployedProxy } = require("../deploy-utils");
const debridgeInitParams = require("../../assets/debridgeInitParams");


module.exports = async function ({ getNamedAccounts, deployments, network }) {
  const { deployer } = await getNamedAccounts();

  console.log('*'.repeat(80));
  console.log(`\tStart add validators`);
  console.log(`\tfrom DEPLOYER ${deployer}`);
  console.log('*'.repeat(80));
  const allValidators = debridgeInitParams["allValidators"].map(i => i.toLowerCase());;
  if (!allValidators) return;


  console.log(`new validators  ${allValidators.length}: ${allValidators}`);
  let signatureVerifierInstance = await getLastDeployedProxy("SignatureVerifier", deployer);

  const DEFAULT_ADMIN_ROLE = await signatureVerifierInstance.DEFAULT_ADMIN_ROLE();
  const hasRole = await signatureVerifierInstance.hasRole(DEFAULT_ADMIN_ROLE, deployer);
  if (!hasRole) {
    console.log("Access denied!");
    return;
  }
  console.log("Deployer has DEFAULT_ADMIN_ROLE");

  console.log(`Contract version: ${await signatureVerifierInstance.version()}`);


  let existValidators = [];
  for (var i = 0; i < 20; i++) {
    try {
      const currentValidator = (await signatureVerifierInstance.oracleAddresses(i)).toLowerCase();
      console.log(`found validator in contract: ${currentValidator}`);
      existValidators.push(currentValidator);
    }
    catch (exc) {
      break;
    }
  }
  console.log(`existValidators: ${existValidators}`);

  // -----validatorsForAdd------------------
  let validatorsForAdd = [];
  for (var i = 0; i < allValidators.length; i++) {
    if (existValidators.indexOf(allValidators[i]) === -1) {
      validatorsForAdd.push(allValidators[i]);
    }
  }
  console.log(`validatorsForAdd: ${validatorsForAdd.length}: ${validatorsForAdd}`);

  //TODO: we need to increase min conf. add new validators, then remove obsolete validators
  // -----validatorsForRemove------------------
  let validatorsForRemove = [];
  for (var i = 0; i < existValidators.length; i++) {
    if (allValidators.indexOf(existValidators[i]) === -1) {
      validatorsForRemove.push(existValidators[i]);
    }
  }
  console.log(`validatorsForRemove: ${validatorsForRemove.length}: ${validatorsForRemove}`);

  // -----update min confirmation------------------
  const newMinConfirmation = parseInt((existValidators.length + validatorsForAdd.length - validatorsForRemove.length) / 2) + 1;
  const minConfirmationFromContract = await signatureVerifierInstance.minConfirmations();
  console.log(`MinConfirmations from contract: ${minConfirmationFromContract}`);

  if (newMinConfirmation > minConfirmationFromContract) {
    console.log(`newMinConfirmation: ${newMinConfirmation}`);
    const setMinConfirmationsTx = await signatureVerifierInstance.setMinConfirmations(newMinConfirmation);
    await waitTx(setMinConfirmationsTx);
    console.log(`setMinConfirmationsTx : ${setMinConfirmationsTx.hash}`);
    console.log(`after update minConfirmations: ${await signatureVerifierInstance.minConfirmations()}`);
  }
  
  // -----remove validators from contract------------------
   for (var i = 0; i < validatorsForRemove.length; i++) {
    console.log(`removing : ${validatorsForRemove[i]}`);
    let tx = await signatureVerifierInstance.updateOracle(validatorsForRemove[i], false, false);
    await waitTx(tx);
    console.log(`removed validator ${validatorsForRemove[i]} : ${tx.hash}`);
  }

  // -----add new validators to contract------------------

  if (validatorsForAdd.length > 0) {
    let required = validatorsForAdd.map(i => false);
    console.log(`adding : ${validatorsForAdd}`);
    const addOraclesTx = await signatureVerifierInstance.addOracles(validatorsForAdd, required);
    await waitTx(addOraclesTx);
    console.log(`addOraclesTx : ${addOraclesTx.hash}`);
  }

  console.log(`Checks after update`);
  for (var i = 0; i < 20; i++) {
    try {
      const currentValidator = (await signatureVerifierInstance.oracleAddresses(i)).toLowerCase();
      console.log(`found validator in contract: ${currentValidator}`);
      existValidators.push(currentValidator);
    }
    catch (exc) {
      break;
    }
  }
};

module.exports.tags = ["08_SignatureVerifierSetup"];
module.exports.dependencies = [''];