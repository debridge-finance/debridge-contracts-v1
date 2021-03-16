// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface ITornado {
    function deposit(bytes32 _commitment) external payable;

    function externalDeposit(bytes32 _commitment) external payable;

    function withdraw(
        bytes calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address payable _recipient,
        address payable _relayer,
        uint256 _fee,
        uint256 _refund
    ) external payable;

    function withdrawExternal(
        bytes calldata _proof,
        bytes32 _root,
        bytes32 _nullifierHash,
        address payable _recipient,
        address payable _relayer,
        uint256 _fee,
        uint256 _refund,
        uint256 _networkId
    ) external payable;

    function isSpent(bytes32 _nullifierHash) external view returns (bool);

    function isSpentArray(bytes32[] calldata _nullifierHashes)
        external
        view
        returns (bool[] memory spent);

    function updateVerifier(address _newVerifier) external;
}
