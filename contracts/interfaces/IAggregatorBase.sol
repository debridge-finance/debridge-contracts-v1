// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IAggregatorBase {
    /* ========== STRUCTS ========== */

    struct OracleInfo {
        bool exist; // exist oracle
        bool isValid; // is valid oracle
        bool required; // without this oracle (DSRM), the transfer will not be confirmed
    }

    /* ========== EVENTS ========== */

    event AddOracle(address oracle, bool required); // add oracle by admin
    event UpdateOracle(address oracle, bool required, bool isValid); // update oracle by admin
    event DeployApproved(bytes32 deployId); // emitted once the submission is confirmed by min required aount of oracles
    event SubmissionApproved(bytes32 submissionId); // emitted once the submission is confirmed by min required aount of oracles
}
