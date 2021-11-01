// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

contract MockInvalidToken {
    string private name;
    string private symbol;
    uint8 private decimals;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }
}
