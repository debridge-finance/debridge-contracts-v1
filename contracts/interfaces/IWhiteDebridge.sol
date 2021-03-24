// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IWhiteDebridge {
    function send(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo
    ) external payable;

    function mint(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _nonce
    ) external;

    function burn(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount
    ) external;

    function claim(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount,
        uint256 _nonce
    ) external;

    function addNativeAsset(
        address _tokenAddress,
        uint256 _minAmount,
        uint256 _transferFee,
        uint256 _minReserves,
        uint256[] memory _supportedChainIds
    ) external;

    function setChainIdSupport(
        bytes32 _debridgeId,
        uint256 _chainId,
        bool _isSupported
    ) external;

    function addExternalAsset(
        address _tokenAddress,
        uint256 _chainId,
        uint256 _minAmount,
        uint256 _transferFee,
        uint256 _minReserves,
        uint256[] memory _supportedChainIds,
        string memory _name,
        string memory _symbol
    ) external;
}
