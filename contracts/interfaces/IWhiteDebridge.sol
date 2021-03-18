// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IWhiteDebridge {
    function send(
        address _tokenAddress,
        address _receiver,
        uint256 _amount,
        uint256 _chainIdTo
    ) external payable;

    function claim(
        bytes32 _debridgeId,
        uint256 _amount,
        address _receiver,
        uint256 _nonce
    ) external;

    function burn(
        bytes32 _debridgeId,
        address _receiver,
        uint256 _amount
    ) external;

    function mint(
        bytes32 _debridgeId,
        uint256 _amount,
        address _receiver,
        uint256 _nonce
    ) external;

    function addNativelAsset(
        address _tokenAddress,
        uint256 _minAmount,
        uint256 _transferFee,
        uint256[] memory _supportedChainIds
    ) external;

    function setChainIdSupport(
        bytes32 _debridgeId,
        uint256 _chainId,
        bool _isSupported
    ) external;

    function addExternalAsset(
        bytes32 _debridgeId,
        uint256 _chainId,
        uint256 _minAmount,
        uint256 _transferFee,
        uint256[] memory _supportedChainIds,
        string memory _name,
        string memory _symbol
    ) external;
}
