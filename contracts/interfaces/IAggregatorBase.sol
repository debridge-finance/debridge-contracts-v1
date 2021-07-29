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

    event DeployApproved(bytes32 deployId); // emitted once the submission is confirmed by min required aount of oracles
    event SubmissionApproved(bytes32 submissionId); // emitted once the submission is confirmed by min required aount of oracles

}
