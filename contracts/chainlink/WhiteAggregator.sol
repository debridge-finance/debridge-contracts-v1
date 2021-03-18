// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Aggregator.sol";

contract WhiteAggregator is Aggregator {
    struct SubmissionInfo {
        bool confirmed;
        uint256 confirmations;
        mapping(address => bool) hasVerified;
    }

    mapping(bytes32 => SubmissionInfo) public getMintInfo;
    mapping(bytes32 => SubmissionInfo) public getBurntInfo;

    event Confirmed(bytes32 commitment, bytes32 debridgeId, address operator);
    event Broadcasted(bytes32 debridgeId, bytes32 commitment);

    constructor(
        uint256 _minConfirmations,
        uint128 _payment,
        IERC20 _link
    ) Aggregator(_minConfirmations, _payment, _link) {}

    function submitMint(bytes32 _mintId) external onlyOracle {
        SubmissionInfo storage mintInfo = getMintInfo[_mintId];
        require(!mintInfo.hasVerified[msg.sender], "submit: submitted already");
        mintInfo.confirmations += 1;
        mintInfo.hasVerified[msg.sender] = true;
        if (mintInfo.confirmations == minConfirmations) {
            mintInfo.confirmed = true;
        }
        _payOracle(msg.sender);
    }

    function submitBurn(bytes32 _burntId) external onlyOracle {
        SubmissionInfo storage burnInfo = getBurntInfo[_burntId];
        require(!burnInfo.hasVerified[msg.sender], "submit: submitted already");
        burnInfo.confirmations += 1;
        burnInfo.hasVerified[msg.sender] = true;
        if (burnInfo.confirmations == minConfirmations) {
            burnInfo.confirmed = true;
        }
        _payOracle(msg.sender);
    }

    function isMintConfirmed(bytes32 _mintId) external view returns (bool) {
        return getMintInfo[_mintId].confirmed;
    }

    function isBurntConfirmed(bytes32 _burntId) external view returns (bool) {
        return getBurntInfo[_burntId].confirmed;
    }
}
