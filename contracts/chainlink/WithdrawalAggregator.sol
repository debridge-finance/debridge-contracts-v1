// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ILightDebridge.sol";
import "./Aggregator.sol";

contract WithdrawalAggregator is Aggregator {
    struct WithdrawalInfo {
        bool broadcasted;
        uint256 confirmations;
        bytes32 debridgeId; // hash(chainId, tokenAddress, amount)
        bytes32 nullifierHash;
        address recipient;
        address relayer;
        uint256 fee;
        uint256 refund;
        mapping(address => bool) hasVerified;
    }

    mapping(bytes32 => WithdrawalInfo) public getCommintmentInfo;
    mapping(bytes32 => ILightDebridge) public getDebridge;

    event Confirmed(bytes32 commitment, bytes32 debridgeId, address operator);
    event Broadcasted(bytes32 debridgeId, bytes32 commitment);

    constructor(uint256 _minConfirmations, uint128 _payment)
        Aggregator(_minConfirmations, _payment)
    {}

    function submit(
        bytes32 _debridgeId,
        bytes32 _nullifierHash,
        uint256 _fee,
        uint256 _refund,
        address payable _recipient,
        address payable _relayer
    ) external onlyOracle {
        bytes32 withdrawalId =
            keccak256(
                abi.encodePacked(
                    _debridgeId,
                    _nullifierHash,
                    _fee,
                    _refund,
                    _recipient,
                    _relayer
                )
            );
        WithdrawalInfo storage withdrawalInfo =
            getCommintmentInfo[withdrawalId];
        require(
            !withdrawalInfo.hasVerified[msg.sender],
            "submit: submitted already"
        );
        if (withdrawalInfo.confirmations == 0) {
            withdrawalInfo.debridgeId = _debridgeId;
            withdrawalInfo.nullifierHash = _nullifierHash;
            withdrawalInfo.fee = _fee;
            withdrawalInfo.refund = _refund;
            withdrawalInfo.recipient = _recipient;
            withdrawalInfo.relayer = _relayer;
        }
        withdrawalInfo.confirmations += 1;
        withdrawalInfo.hasVerified[msg.sender] = true;
        if (withdrawalInfo.confirmations == minConfirmations) {
            getDebridge[_debridgeId].withdraw(
                _recipient,
                _relayer,
                _fee,
                _refund
            );
            withdrawalInfo.broadcasted = true;
        }
        _payOracle(msg.sender);
    }

    function setDebridge(bytes32 _debridgeId, ILightDebridge _debridge)
        external
        onlyAdmin
    {
        getDebridge[_debridgeId] = _debridge;
    }
}
