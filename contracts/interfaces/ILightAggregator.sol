// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface ILightAggregator {

    /* ========== STRUCTS ========== */

    struct SubmissionInfo {
        uint256 block; // confirmation block
        uint256 confirmations; // received confirmations count
        bytes[] signatures;
        mapping(address => bool) hasVerified; // verifier => has already voted
    }
    struct DebridgeDeployInfo {
        address tokenAddress;
        uint256 chainId;
        string name;
        string symbol;
        uint8 decimals;
        bool approved;
        uint256 confirmations; // received confirmations count
        bytes[] signatures;
        mapping(address => bool) hasVerified; // verifier => has already voted
    }
    
    function submitMany(
        bytes32[] memory _submissionIds,
        bytes[] memory _signatures
    ) external;

    function submit(bytes32 _submissionId, bytes memory _signature) external;

    function getSubmissionConfirmations(bytes32 _submissionId)
        external
        view
        returns (uint256 _confirmations, bool _blockConfirmationPassed);
}
