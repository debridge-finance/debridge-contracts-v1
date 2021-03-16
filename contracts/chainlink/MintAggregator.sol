// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IWhiteDebridge.sol";
import "./Aggregator.sol";

contract MintAggregator is Aggregator {
    struct MintInfo {
        bool broadcasted;
        uint256 confirmations;
        bytes32 debridgeId; // hash(chainId, tokenAddress)
        uint256 amount;
        address receiver;
        uint256 nonce;
        mapping(address => bool) hasVerified;
    }

    mapping(bytes32 => MintInfo) public getCommintmentInfo;
    mapping(bytes32 => IWhiteDebridge) public getDebridge;

    event Confirmed(bytes32 commitment, bytes32 debridgeId, address operator);
    event Broadcasted(bytes32 debridgeId, bytes32 commitment);

    constructor(uint256 _minConfirmations, uint128 _payment)
        Aggregator(_minConfirmations, _payment)
    {}

    function submit(
        bytes32 _debridgeId,
        uint256 _amount,
        address _receiver,
        uint256 _nonce
    ) external onlyOracle {
        bytes32 depositId =
            keccak256(
                abi.encodePacked(_debridgeId, _amount, _receiver, _nonce)
            );
        MintInfo storage mintInfo = getCommintmentInfo[depositId];
        require(!mintInfo.hasVerified[msg.sender], "submit: submitted already");
        if (mintInfo.confirmations == 0) {
            mintInfo.amount = _amount;
            mintInfo.receiver = _receiver;
            mintInfo.nonce = _nonce;
            mintInfo.debridgeId = _debridgeId;
        }
        mintInfo.confirmations += 1;
        mintInfo.hasVerified[msg.sender] = true;
        if (mintInfo.confirmations == minConfirmations) {
            getDebridge[_debridgeId].externalDeposit(
                _debridgeId,
                _amount,
                _receiver
            );
            mintInfo.broadcasted = true;
        }
        _payOracle(msg.sender);
    }

    function setDebridge(bytes32 _debridgeId, IWhiteDebridge _debridge)
        external
        onlyAdmin
    {
        getDebridge[_debridgeId] = _debridge;
    }
}
