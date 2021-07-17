// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../periphery/WrappedAsset.sol";

contract GovToken is WrappedAsset {
    constructor(
        address _admin, 
        address[] memory _minters)
            WrappedAsset("Debridge Goveranance Token", 
                        "DBR", 
                        18, 
                        _admin,
                        _minters)
    {
    }
}
