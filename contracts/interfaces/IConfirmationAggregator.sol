// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IConfirmationAggregator {

    /* ========== STRUCTS ========== */

    struct SubmissionInfo {
        uint8 confirmations; // received confirmations count
        uint8 requiredConfirmations; // required oracles (DSRM) received confirmations count
        bool isConfirmed; // is confirmed submission (user can claim)
        mapping(address => bool) hasVerified; // verifier => has already voted
    }
    struct DebridgeDeployInfo {
        uint256 chainId; //native chainId
        address nativeAddress; //native token address
        uint8 confirmations; // received confirmations count
        uint8 requiredConfirmations; // required oracles (DSRM) received confirmations count
        uint8 decimals;
        string name;
        string symbol;
        mapping(address => bool) hasVerified; // verifier => has already voted
    }

    /* ========== EVENTS ========== */

    event DeployConfirmed(bytes32 deployId, address operator); // emitted once the submission is confirmed by one oracle
    event Confirmed(bytes32 submissionId, address operator); // emitted once the submission is confirmed by one oracle

    /* ========== FUNCTIONS ========== */

    function submit(bytes32 _submissionId) external;

    function submitMany(bytes32[] memory _submissionIds) external;

    function getSubmissionConfirmations(bytes32 _submissionId)
        external
        view
        returns (uint8 _confirmations, bool _isConfirmed);

    function getWrappedAssetAddress(bytes32 _debridgeId)
        external
        view
        returns (address _wrappedAssetAddress);

    function deployAsset(bytes32 _debridgeId)
        external
        returns (address wrappedAssetAddress, address nativeAddress, uint256 nativeChainId);
}
