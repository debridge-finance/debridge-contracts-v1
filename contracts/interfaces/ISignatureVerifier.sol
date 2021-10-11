// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface ISignatureVerifier {

    /* ========== EVENTS ========== */

    event Confirmed(bytes32 submissionId, address operator); // emitted once the submission is confirmed by the only oracle
    event DeployConfirmed(bytes32 deployId, address operator); // emitted once the submission is confirmed by one oracle

    /* ========== FUNCTIONS ========== */

    function submit(
        bytes32 _submissionId,
        bytes memory _signatures,
        uint8 _excessConfirmations
    ) external;

}
