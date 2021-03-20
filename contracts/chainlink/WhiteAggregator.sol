// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Aggregator.sol";
import "../interfaces/IWhiteAggregator.sol";

contract WhiteAggregator is Aggregator, IWhiteAggregator {
    struct SubmissionInfo {
        bool confirmed; // whether is confirmed
        uint256 confirmations; // received confirmations count
        mapping(address => bool) hasVerified; // verifier => has already voted
    }

    mapping(bytes32 => SubmissionInfo) public getMintInfo; // mint id => submission info
    mapping(bytes32 => SubmissionInfo) public getBurntInfo; // burnt id => submission info

    event Confirmed(bytes32 submissionId, address operator); // emitted once the submission is confirmed

    /// @dev Constructor that initializes the most important configurations.
    /// @param _minConfirmations Minimal required confirmations.
    /// @param _payment Oracle reward.
    /// @param _link Link token to pay to oracles.
    constructor(
        uint256 _minConfirmations,
        uint128 _payment,
        IERC20 _link
    ) Aggregator(_minConfirmations, _payment, _link) {}

    /// @dev Confirms the mint request.
    /// @param _mintId Submission identifier.
    function submitMint(bytes32 _mintId) external override onlyOracle {
        SubmissionInfo storage mintInfo = getMintInfo[_mintId];
        require(!mintInfo.hasVerified[msg.sender], "submit: submitted already");
        mintInfo.confirmations += 1;
        mintInfo.hasVerified[msg.sender] = true;
        if (mintInfo.confirmations >= minConfirmations) {
            mintInfo.confirmed = true;
        }
        _payOracle(msg.sender);
        emit Confirmed(_mintId, msg.sender);
    }

    /// @dev Confirms the burnnt request.
    /// @param _burntId Submission identifier.
    function submitBurn(bytes32 _burntId) external override onlyOracle {
        SubmissionInfo storage burnInfo = getBurntInfo[_burntId];
        require(!burnInfo.hasVerified[msg.sender], "submit: submitted already");
        burnInfo.confirmations += 1;
        burnInfo.hasVerified[msg.sender] = true;
        if (burnInfo.confirmations >= minConfirmations) {
            burnInfo.confirmed = true;
        }
        emit Confirmed(_burntId, msg.sender);
        _payOracle(msg.sender);
    }

    /// @dev Returns whether mint request is confirmed.
    /// @param _mintId Submission identifier.
    /// @return Whether mint request is confirmed.
    function isMintConfirmed(bytes32 _mintId)
        external
        view
        override
        returns (bool)
    {
        return getMintInfo[_mintId].confirmed;
    }

    /// @dev Returns whether burnnt request is confirmed.
    /// @param _burntId Submission identifier.
    /// @return Whether burnnt request is confirmed.
    function isBurntConfirmed(bytes32 _burntId)
        external
        view
        override
        returns (bool)
    {
        return getBurntInfo[_burntId].confirmed;
    }
}
