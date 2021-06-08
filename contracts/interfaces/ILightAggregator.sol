// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface ILightAggregator {
    function submitMany(
        bytes32[] memory _submissionIds,
        bytes[] memory _signatures
    ) external;

    function submit(bytes32 _submissionId, bytes memory _signature) external;

    function isSubmissionConfirmed(bytes32 _submissionId)
        external
        view
        returns (bool);
}
