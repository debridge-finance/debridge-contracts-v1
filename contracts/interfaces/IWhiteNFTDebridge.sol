// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IWhiteNFTDebridge {
    struct ChainSupportInfo {
        bool isSupported;
        uint256 fixedFee;
    }

    function send(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _tokenId,
        uint256 _chainIdTo
    ) external payable;

    function burn(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _tokenId,
        uint256 _chainIdTo,
        uint256 _deadline,
        bytes memory _signature
    ) external;
    
    function addNativeAsset(
        address _tokenAddress,
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo
    ) external;

    function setChainIdSupport(
        bytes32 _debridgeId,
        uint256 _chainId,
        bool _isSupported
    ) external;

    function addExternalAsset(
        address _tokenAddress,
        address _wrappedAssetAddress,
        uint256 _chainId,
        uint256[] memory _supportedChainIds,
        ChainSupportInfo[] memory _chainSupportInfo
    ) external;
}