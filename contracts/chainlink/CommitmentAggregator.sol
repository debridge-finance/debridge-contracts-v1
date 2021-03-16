// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/ITornado.sol";

contract CommitmentAggregator is AccessControl {
    struct CommitmentInfo {
        bool broadcasted;
        uint256 confirmations;
        mapping(address => bool) hasVerified;
    }

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    uint256 public minConfirmations;
    mapping(bytes32 => CommitmentInfo) public getCommintmentInfo;
    ITornado tornado;

    constructor(uint256 _minConfirmations, ITornado _tornado) {
        minConfirmations = _minConfirmations;
        tornado = _tornado;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function submit(bytes32 _commitment) external {
        require(hasRole(ORACLE_ROLE, msg.sender), "onlyOracle: bad role");
        CommitmentInfo storage commitmentInfo = getCommintmentInfo[_commitment];
        require(
            !commitmentInfo.hasVerified[msg.sender],
            "submit: submitted already"
        );
        commitmentInfo.confirmations += 1;
        commitmentInfo.hasVerified[msg.sender] = true;
        if (
            !commitmentInfo.broadcasted &&
            commitmentInfo.confirmations >= minConfirmations
        ) {
            // submit to Tornado
            tornado.externalDeposit(_commitment);
        }
    }

    function setMinConfirmations(uint256 _minConfirmations) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "setMinConfirmations: bad role"
        );
        minConfirmations = _minConfirmations;
    }
}
