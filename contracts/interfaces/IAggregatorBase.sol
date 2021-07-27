// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IAggregatorBase {
    
    /* ========== STRUCTS ========== */

    struct OracleInfo {
        address admin; // current oracle admin
    }
    struct BlockConfirmationsInfo {
        uint256 count; // count of submissions in block
        bool requireExtraCheck; // exceed confirmation count for all submissions in block
        mapping(bytes32 => bool) isConfirmed; // submission => was confirmed
    }

    /* ========== EVENTS ========== */

    event DeployConfirmed(bytes32 deployId, address operator); // emitted once the submission is confirmed by one oracle
    event DeployApproved(bytes32 deployId); // emitted once the submission is confirmed by min required aount of oracles

    event Confirmed(bytes32 submissionId, address operator); // emitted once the submission is confirmed by one oracle
    event SubmissionApproved(bytes32 submissionId); // emitted once the submission is confirmed by min required aount of oracles

}
