// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface ISignatureAggregator {
    /* ========== STRUCTS ========== */

    struct SubmissionInfo {
        uint8 confirmations; // received confirmations count
        bytes[] signatures;
        mapping(address => bool) hasVerified; // verifier => has already voted
    }
    struct DebridgeDeployInfo {
        uint256 chainId; //native chainId
        bytes nativeAddress; //native token address
        uint8 decimals;
        uint8 confirmations; // received confirmations count
        bool approved;
        string name;
        string symbol;
        bytes[] signatures;
        mapping(address => bool) hasVerified; // verifier => has already voted
    }

    /* ========== EVENTS ========== */

    event DeployConfirmed(bytes32 deployId, address operator, bytes signature); // emitted once the submission is confirmed by one oracle
    event Confirmed(bytes32 submissionId, address operator, bytes signature); // emitted once the submission is confirmed by one oracle

    /* ========== FUNCTIONS ========== */

    function submitMany(bytes32[] memory _submissionIds, bytes[] memory _signatures) external;

    function submit(bytes32 _submissionId, bytes memory _signature) external;

    function getSubmissionConfirmations(bytes32 _submissionId)
        external
        view
        returns (uint8 _confirmations, bool _blockConfirmationPassed);
}
