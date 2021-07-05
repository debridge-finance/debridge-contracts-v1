// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IAnyDebridge {
    struct ChainSupportInfo {
        bool isSupported; // whether the chain for the asset is supported
        uint256 fixedFee; // transfer fixed fee
        uint256 assetFee; // transfer fee rate (in % of transferred amount)
    }

    function send(
        address _tokenAddress,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo
    ) external payable;

    function burn(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        uint256 _deadline,
        bytes memory _signature
    ) external;
}
