// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IWhiteLightAggregator.sol";

contract WhiteLightAggregator is AccessControl, IWhiteLightAggregator {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE"); // role allowed to submit the data
    uint256 public minConfirmations; // minimal required confimations
    bytes[2] public utilityBytes; // the part of the transaction payload;
    bytes public versionBytes; // chain id of the network where the confirmations are collected + v

    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "onlyAdmin: bad role");
        _;
    }

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
    /// @param _utilityBytes Utility bytes to be inserted into the transaction payload.
    /// @param _versionBytes The bytes that identify the chain where confirmations are sent + v.
    constructor(
        uint256 _minConfirmations,
        bytes[2] memory _utilityBytes,
        bytes memory _versionBytes
    ) {
        minConfirmations = _minConfirmations;
        utilityBytes = _utilityBytes;
        versionBytes = _versionBytes;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @dev Confirms the mint request.
    /// @param _submissionId Submission identifier.
    /// @param _trxData Array of transactions by oracles of 2 elements - payload up to the receiver address and the signature bytes.
    function submit(bytes32 _submissionId, bytes[2][] memory _trxData)
        external
        override
        returns (bool)
    {
        SubmissionInfo storage submissionInfo =
            getSubmissionInfo[_submissionId];
        for (uint256 i = 0; i < _trxData.length; i++) {
            (bytes32 r, bytes32 s, uint8 v) = splitSignature(_trxData[i][1]);
            bytes memory unsignedTrx =
                getUnsignedTrx(_trxData[i][0], hex"d9caa3d2", _submissionId);
            address oracle = ecrecover(keccak256(unsignedTrx), v, r, s);
            require(hasRole(ORACLE_ROLE, oracle), "onlyOracle: bad role");
            require(
                !submissionInfo.hasVerified[oracle],
                "submit: submitted already"
            );
            submissionInfo.confirmations += 1;
            submissionInfo.hasVerified[oracle] = true;
            emit Confirmed(_submissionId, oracle);
            if (submissionInfo.confirmations >= minConfirmations) {
                submissionInfo.confirmed = true;
                emit SubmissionApproved(_submissionId);
                return submissionInfo.confirmed;
            }
        }
        return submissionInfo.confirmed;
    }

    /* ADMIN */

    /// @dev Sets utility bytes.
    /// @param _utilityBytes Utility bytes to be inserted into the transaction payload.
    function setUtilityBytes(bytes[2] memory _utilityBytes) external onlyAdmin {
        utilityBytes = _utilityBytes;
    }

    /// @dev Sets version bytes.
    /// @param _versionBytes The bytes that identify the chain where confirmations are sent + v.
    function setVersionBytes(bytes memory _versionBytes) external onlyAdmin {
        versionBytes = _versionBytes;
    }

    /// @dev Sets minimal required confirmations.
    /// @param _minConfirmations Minimal required confirmations.
    function setMinConfirmations(uint256 _minConfirmations) external onlyAdmin {
        minConfirmations = _minConfirmations;
    }

    /// @dev Add new oracle.
    /// @param _oracle Oracle address.
    function addOracle(address _oracle) external onlyAdmin {
        grantRole(ORACLE_ROLE, _oracle);
    }

    /// @dev Remove oracle.
    /// @param _oracle Oracle address.
    function removeOracle(address _oracle) external onlyAdmin {
        revokeRole(ORACLE_ROLE, _oracle);
    }

    /* VIEW */

    /// @dev Returns whether mint request is confirmed.
    /// @param _submissionId Submission identifier.
    /// @return Whether mint request is confirmed.
    function isSubmissionConfirmed(bytes32 _submissionId)
        external
        view
        override
        returns (bool)
    {
        return getSubmissionInfo[_submissionId].confirmed;
    }

    /// @dev Prepares raw transacton that was signed by the oracle.
    /// @param _payloadPart First part of the transaction; rlp encoded (nonce + gasprice + startgas) + length of the next rlp encoded element (recipient).
    /// @param _method The function identifier called by the oracle for the confirmation.
    /// @param _submissionId Submission identifier.
    function getUnsignedTrx(
        bytes memory _payloadPart,
        bytes memory _method,
        bytes32 _submissionId
    ) public view returns (bytes memory) {
        return
            abi.encodePacked(
                _payloadPart,
                utilityBytes[0],
                _method,
                abi.encodePacked(_submissionId),
                versionBytes, // NOTE: the byte must contain the chaind + v
                utilityBytes[1]
            );
    }

    /// @dev Splits signature bytes to r,s,v components.
    /// @param _signature Signature bytes in format r+s+v.
    function splitSignature(bytes memory _signature)
        public
        pure
        returns (
            bytes32 r,
            bytes32 s,
            uint8 v
        )
    {
        require(
            _signature.length == 65,
            "splitSignature: invalid signature length"
        );

        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }
    }
}
