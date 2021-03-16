// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IDarkDebridge.sol";
import "./Aggregator.sol";

contract CommitmentAggregator is Aggregator {
    struct CommitmentInfo {
        bool broadcasted;
        uint256 confirmations;
        bytes32 debridgeId; // hash(chainId, tokenAddress, amount)
        bytes32 commitment;
        mapping(address => bool) hasVerified;
    }

    mapping(bytes32 => CommitmentInfo) public getCommintmentInfo;
    mapping(bytes32 => IDarkDebridge) public getDebridge;

    event Confirmed(bytes32 commitment, bytes32 debridgeId, address operator);
    event Broadcasted(bytes32 debridgeId, bytes32 commitment);

    constructor(uint256 _minConfirmations, uint128 _payment)
        Aggregator(_minConfirmations, _payment)
    {}

    function submit(bytes32 _commitment, bytes32 _debridgeId)
        external
        onlyOracle
    {
        bytes32 depositId =
            keccak256(abi.encodePacked(_commitment, _debridgeId));
        CommitmentInfo storage commitmentInfo = getCommintmentInfo[depositId];
        require(
            !commitmentInfo.hasVerified[msg.sender],
            "submit: submitted already"
        );
        if (commitmentInfo.confirmations == 0) {
            commitmentInfo.commitment = _commitment;
            commitmentInfo.debridgeId = _debridgeId;
        }
        commitmentInfo.confirmations += 1;
        commitmentInfo.hasVerified[msg.sender] = true;
        if (commitmentInfo.confirmations == minConfirmations) {
            getDebridge[_debridgeId].externalDeposit(_commitment);
            commitmentInfo.broadcasted = true;
        }
        _payOracle(msg.sender);
    }

    function setDebridge(bytes32 _debridgeId, IDarkDebridge _debridge)
        external
        onlyAdmin
    {
        getDebridge[_debridgeId] = _debridge;
    }
}
