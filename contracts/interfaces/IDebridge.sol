// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IDebridge {
    struct ChainSupportInfo {
        bool isSupported; // whether the chain for the asset is supported
        uint256 fixedNativeFee; // transfer fixed fee
        uint256 transferFee; // transfer fee rate (in % of transferred amount)
    }

    function send(
        address _tokenAddress,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        bool _useAssetFee
    ) external payable;

    function burn(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo,
        uint256 _deadline,
        bytes memory _signature,
        bool _useAssetFee
    ) external payable;

    function setChainIdSupport(
        bytes32 _debridgeId,
        uint256 _chainId,
        bool _isSupported
    ) external;
}
