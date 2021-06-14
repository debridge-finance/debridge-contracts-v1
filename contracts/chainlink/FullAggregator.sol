// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Aggregator.sol";
import "../interfaces/IFullAggregator.sol";

contract FullAggregator is Aggregator, IFullAggregator {
    struct SubmissionInfo {
        uint256 block; // confirmation block
        uint256 confirmations; // received confirmations count
        mapping(address => bool) hasVerified; // verifier => has already voted
    }
    uint256 public confirmationThreshold; // bonus reward for one submission
    uint256 public excessConfirmations; // minimal required confirmations in case of too many confirmations

    mapping(bytes32 => SubmissionInfo) public getSubmissionInfo; // mint id => submission info
    mapping(uint256 => BlockConfirmationsInfo) public getConfirmationsPerBlock; // block => confirmations

    event Confirmed(bytes32 submissionId, address operator); // emitted once the submission is confirmed by one oracle
    event SubmissionApproved(bytes32 submissionId); // emitted once the submission is confirmed by min required aount of oracles

    /// @dev Constructor that initializes the most important configurations.
    /// @param _minConfirmations Common confirmations count.
    /// @param _corePayment Oracle reward.
    /// @param _bonusPayment Oracle reward.
    /// @param _coreToken Link token to pay to oracles.
    /// @param _bonusToken DBR token to pay to oracles.
    /// @param _confirmationThreshold Confirmations per block before extra check enabled.
    /// @param _excessConfirmations Confirmations count in case of excess activity.
    constructor(
        uint256 _minConfirmations,
        uint256 _corePayment,
        uint256 _bonusPayment,
        IERC20 _coreToken,
        IERC20 _bonusToken,
        uint256 _confirmationThreshold,
        uint256 _excessConfirmations
    )
        Aggregator(
            _minConfirmations,
            _corePayment,
            _bonusPayment,
            _coreToken,
            _bonusToken
        )
    {
        confirmationThreshold = _confirmationThreshold;
        excessConfirmations = _excessConfirmations;
    }

    /// @dev Confirms few transfer requests.
    /// @param _submissionIds Submission identifiers.
    function submitMany(bytes32[] memory _submissionIds)
        external
        override
        onlyOracle
    {
        for (uint256 i; i < _submissionIds.length; i++) {
            _submit(_submissionIds[i]);
        }
    }

    /// @dev Confirms the transfer request.
    /// @param _submissionId Submission identifier.
    function submit(bytes32 _submissionId) external override onlyOracle {
        _submit(_submissionId);
    }

    /// @dev Confirms single transfer request.
    /// @param _submissionId Submission identifier.
    function _submit(bytes32 _submissionId) internal {
        SubmissionInfo storage submissionInfo =
            getSubmissionInfo[_submissionId];
        require(
            !submissionInfo.hasVerified[msg.sender],
            "submit: submitted already"
        );
        submissionInfo.confirmations += 1;
        submissionInfo.hasVerified[msg.sender] = true;
        if (submissionInfo.confirmations >= minConfirmations) {
            BlockConfirmationsInfo storage _blockConfirmationsInfo =
                getConfirmationsPerBlock[block.number];
            if (!_blockConfirmationsInfo.isConfirmed[_submissionId]) {
                _blockConfirmationsInfo.count += 1;
                _blockConfirmationsInfo.isConfirmed[_submissionId] = true;
                if (_blockConfirmationsInfo.count >= confirmationThreshold) {
                    _blockConfirmationsInfo.requireExtraCheck = true;
                }
            }
            submissionInfo.block = block.number;
            emit SubmissionApproved(_submissionId);
        }
        _payOracle(msg.sender);
        emit Confirmed(_submissionId, msg.sender);
    }

    /// @dev Sets minimal required confirmations.
    /// @param _excessConfirmations Confirmation info.
    function setExcessConfirmations(uint256 _excessConfirmations)
        public
        onlyAdmin
    {
        excessConfirmations = _excessConfirmations;
    }

    /// @dev Sets minimal required confirmations.
    /// @param _confirmationThreshold Confirmation info.
    function setThreshold(uint256 _confirmationThreshold) public onlyAdmin {
        confirmationThreshold = _confirmationThreshold;
    }

    /// @dev Returns whether transfer request is confirmed.
    /// @param _submissionId Submission identifier.
    /// @return _confirmations number of confirmation.
    /// @return _blockConfirmationPassed Whether transfer request is confirmed.
    function getSubmissionConfirmations(bytes32 _submissionId)
        external
        view
        override
        returns (uint256 _confirmations, bool _blockConfirmationPassed)
    {
        SubmissionInfo storage submissionInfo =
            getSubmissionInfo[_submissionId];
        BlockConfirmationsInfo storage _blockConfirmationsInfo =
            getConfirmationsPerBlock[submissionInfo.block];
        _confirmations = submissionInfo.confirmations;
        return (
            _confirmations,
            _confirmations >=
                (
                    (_blockConfirmationsInfo.requireExtraCheck)
                        ? excessConfirmations
                        : minConfirmations
                )
        );
    }
}
