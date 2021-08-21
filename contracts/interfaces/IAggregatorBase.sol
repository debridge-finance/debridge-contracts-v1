// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IAggregatorBase {
    /* ========== STRUCTS ========== */

    struct OracleInfo {
        bool exist; // exist oracle
        bool isValid; // is valid oracle
        bool required; // without this oracle (DSRM), the transfer will not be confirmed
        address admin; // current oracle admin
    }

    /* ========== EVENTS ========== */

    event AddOracle(address oracle, address admin, bool required); // add oracle by admin
    event UpdateOracle(address oracle, bool required, bool isValid); // update oracle by admin
    event UpdateOracleAdmin(address oracle, address admin); // update oracle by oracle's admin
    event UpdateOracleAdminByOwner(address oracle, address admin); // update oracle by admin
    event DeployApproved(bytes32 deployId); // emitted once the submission is confirmed by min required aount of oracles
    event SubmissionApproved(bytes32 submissionId); // emitted once the submission is confirmed by min required aount of oracles
}
