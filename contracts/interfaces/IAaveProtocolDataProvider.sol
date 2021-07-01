// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.2;

contract IAaveProtocolDataProvider {

  function getReserveTokensAddresses(address asset)
    external
    view
    returns (
      address aTokenAddress,
      address stableDebtTokenAddress,
      address variableDebtTokenAddress
    );
}