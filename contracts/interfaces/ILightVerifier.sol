// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface ILightVerifier {
    function submit(bytes32 _submissionId, bytes[] memory _signatures)
        external
        returns (bool);

    function isSubmissionConfirmed(bytes32 _submissionId)
        external
        view
        returns (bool);
}
