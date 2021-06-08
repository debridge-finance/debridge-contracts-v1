// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IFullAggregator {
    function submit(bytes32 _submissionId) external;

    function submitMany(bytes32[] memory _submissionIds) external;

    function isSubmissionConfirmed(bytes32 _submissionId)
        external
        view
        returns (bool);
}
