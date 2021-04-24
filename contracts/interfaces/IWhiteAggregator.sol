// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IWhiteAggregator {
    function submit(bytes32 _submissionId) external;

    function isSubmissionConfirmed(bytes32 _submissionId)
        external
        view
        returns (bool);
}
