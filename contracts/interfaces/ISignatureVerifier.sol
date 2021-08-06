// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface ISignatureVerifier {
    /* ========== STRUCTS ========== */

    struct SubmissionInfo {
        uint256 block; // confirmation block
        uint8 confirmations; // received confirmations count
        mapping(address => bool) hasVerified; // verifier => has already voted
    }

    struct DebridgeDeployInfo {
        uint256 chainId; //native chainId
        address nativeAddress; //native token address
        uint8 decimals;
        uint8 confirmations; // received confirmations count
        string name;
        string symbol;
        mapping(address => bool) hasVerified; // verifier => has already voted
    }

    /* ========== EVENTS ========== */

    event Confirmed(bytes32 submissionId, address operator); // emitted once the submission is confirmed by the only oracle
    event DeployConfirmed(bytes32 deployId, address operator); // emitted once the submission is confirmed by one oracle

    /* ========== FUNCTIONS ========== */

    function submit(bytes32 _submissionId, bytes[] memory _signatures)
        external
        returns (uint8 _confirmations, bool _blockConfirmationPassed);

    function getWrappedAssetAddress(bytes32 _debridgeId)
        external
        view
        returns (address _wrappedAssetAddress);

    function deployAsset(bytes32 _debridgeId)
        external
        returns (address wrappedAssetAddress, address nativeAddress, uint256 nativeChainId);
}
