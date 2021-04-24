// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Aggregator.sol";
import "../interfaces/IWhiteAggregator.sol";

contract WhiteFullAggregator is Aggregator, IWhiteAggregator {
    struct SubmissionInfo {
        bool confirmed; // whether is confirmed
        uint256 confirmations; // received confirmations count
        mapping(address => bool) hasVerified; // verifier => has already voted
    }

    mapping(bytes32 => SubmissionInfo) public getSubmissionInfo; // mint id => submission info

    event Confirmed(bytes32 submissionId, address operator); // emitted once the submission is confirmed
    event SubmissionApproved(bytes32 submissionId); // emitted once the submission is confirmed

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
    /// @param _submissionId Submission identifier.
    function submit(bytes32 _submissionId) external override onlyOracle {
        SubmissionInfo storage mintInfo = getSubmissionInfo[_submissionId];
        require(!mintInfo.hasVerified[msg.sender], "submit: submitted already");
        mintInfo.confirmations += 1;
        mintInfo.hasVerified[msg.sender] = true;
        if (mintInfo.confirmations >= minConfirmations) {
            mintInfo.confirmed = true;
            emit SubmissionApproved(_submissionId);
        }
        _payOracle(msg.sender);
        emit Confirmed(_submissionId, msg.sender);
    }

    /// @dev Returns whether burnnt request is confirmed.
    /// @param _submissionId Submission identifier.
    /// @return Whether burnnt request is confirmed.
    function isSubmissionConfirmed(bytes32 _submissionId)
        external
        view
        override
        returns (bool)
    {
        return getSubmissionInfo[_submissionId].confirmed;
    }
}
