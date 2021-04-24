// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IWhiteLightAggregator {
    function submit(bytes32 _submissionId, bytes[2][] memory _trxData)
        external
        returns (bool);

    function isSubmissionConfirmed(bytes32 _submissionId)
        external
        view
        returns (bool);
}
