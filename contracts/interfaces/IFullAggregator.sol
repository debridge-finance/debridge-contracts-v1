// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IFullAggregator {
    function submit(bytes32 _submissionId) external;

    function submitMany(bytes32[] memory _submissionIds) external;

    function getSubmissionConfirmations(bytes32 _submissionId)
        external
        view
        returns (uint256 _confirmations, bool _blockConfirmationPassed);

    function getWrappedAssetAddress(bytes32 _debridgeId)
        external
        view
        returns (address _wrappedAssetAddress);
}
