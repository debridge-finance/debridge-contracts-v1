// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../../interfaces/compound/ICToken.sol";

contract Comptroller {
    address public admin;
    address[] public allMarkets;

    constructor() {
        admin = msg.sender;
    }

    function claimComp(address holder, ICToken[] memory cTokens) public {

    }

    function addMarket(address cToken) public {
        for (uint i = 0; i < allMarkets.length; i ++) {
            require(allMarkets[i] != address(cToken), "market already added");
        }
        allMarkets.push(address(cToken));
    }

    function getAllMarkets() public view returns (address[] memory) {
        return allMarkets;
    }
}