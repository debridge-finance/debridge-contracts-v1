// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface ISignatureVerifier {
    /* ========== STRUCTS ========== */

    struct DebridgeDeployInfo {
        uint256 chainId; //native chainId
        bytes nativeAddress; //native token address
        uint8 decimals;
        uint8 confirmations; // received confirmations count
        string name;
        string symbol;
    }

    /* ========== EVENTS ========== */

    event Confirmed(
        bytes32 indexed submissionId,
        address indexed operator); // emitted once the submission is confirmed by the only oracle

    event DeployConfirmed(
        bytes32 indexed deployId,
        address indexed operator); // emitted once the submission is confirmed by one oracle

    /* ========== FUNCTIONS ========== */

    function submit(
        bytes32 _submissionId,
        bytes memory _signatures,
        uint8 _excessConfirmations
    ) external;

    function getWrappedAssetAddress(bytes32 _debridgeId)
        external
        view
        returns (address _wrappedAssetAddress);

    function deployAsset(bytes32 _debridgeId)
        external
        returns (
            address wrappedAssetAddress,
            bytes memory nativeAddress,
            uint256 nativeChainId
        );
}
