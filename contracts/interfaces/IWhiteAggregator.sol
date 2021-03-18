// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IWhiteDebridge.sol";

interface IWhiteAggregator {
    struct SubmissionInfo {
        bool confirmed;
        uint256 confirmations;
        mapping(address => bool) hasVerified;
    }

    function submitMint(bytes32 _mintId) external;

    function submitBurn(bytes32 _burntId) external;

    function setDebridge(bytes32 _debridgeId, IWhiteDebridge _debridge)
        external;

    function isMintConfirmed(bytes32 _mintId) external view returns (bool);

    function isBurntConfirmed(bytes32 _burntId) external view returns (bool);
}
