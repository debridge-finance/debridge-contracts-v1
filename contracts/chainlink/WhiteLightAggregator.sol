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
    mapping(address => bool) public isOracle; // oracle address => oracle details

    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "onlyAdmin: bad role");
        _;
    }

    struct SubmissionInfo {
        bool confirmed; // whether is confirmed
        uint256 confirmations; // received confirmations count
        mapping(address => bool) hasVerified; // verifier => has already voted
    }

    mapping(bytes32 => SubmissionInfo) public getMintInfo; // mint id => submission info
    mapping(bytes32 => SubmissionInfo) public getBurntInfo; // burnt id => submission info

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
    /// @param _mintId Submission identifier.
    /// @param _trxData Array of transactions by oracles of 2 elements - payload up to the receiver address and the signature bytes.
    function submitMint(bytes32 _mintId, bytes[2][] memory _trxData)
        external
        override
        returns (bool)
    {
        SubmissionInfo storage mintInfo = getMintInfo[_mintId];
        return _submit(mintInfo, hex"0b29b943", _mintId, _trxData);
    }

    /// @dev Confirms the burnnt request.
    /// @param _burntId Submission identifier.
    /// @param _trxData Array of transactions by oracles of 2 elements - payload up to the receiver address and the signature bytes.
    function submitBurn(bytes32 _burntId, bytes[2][] memory _trxData)
        external
        override
        returns (bool)
    {
        SubmissionInfo storage burnInfo = getBurntInfo[_burntId];
        return _submit(burnInfo, hex"c4b56cd0", _burntId, _trxData);
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
        isOracle[_oracle] = true;
    }

    /// @dev Remove oracle.
    /// @param _oracle Oracle address.
    function removeOracle(address _oracle) external onlyAdmin {
        revokeRole(ORACLE_ROLE, _oracle);
    }

    /* INTERNAL */

    /// @dev Confirms the burnnt request.
    /// @param _submissionId Submission identifier.
    /// @param _trxData Array of transactions by oracles of 2 elements - payload up to the receiver address and the signature bytes.
    function _submit(
        SubmissionInfo storage _submissionInfo,
        bytes memory _methodId,
        bytes32 _submissionId,
        bytes[2][] memory _trxData
    ) internal returns (bool) {
        for (uint256 i = 0; i < _trxData.length; i++) {
            (bytes32 r, bytes32 s, uint8 v) = splitSignature(_trxData[i][1]);
            bytes memory unsignedTrx =
                getUnsignedTrx(_trxData[i][0], _methodId, _submissionId);
            address oracle = ecrecover(keccak256(unsignedTrx), v, r, s);
            require(hasRole(ORACLE_ROLE, oracle), "onlyOracle: bad role");
            require(
                !_submissionInfo.hasVerified[oracle],
                "submit: submitted already"
            );
            _submissionInfo.confirmations += 1;
            _submissionInfo.hasVerified[oracle] = true;
            if (_submissionInfo.confirmations >= minConfirmations) {
                _submissionInfo.confirmed = true;
                emit SubmissionApproved(_submissionId);
                return _submissionInfo.confirmed;
            }
            emit Confirmed(_submissionId, oracle);
        }
        return _submissionInfo.confirmed;
    }

    /* VIEW */

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
            concat(
                concat(
                    concat(
                        concat(concat(_payloadPart, utilityBytes[0]), _method),
                        abi.encodePacked(_submissionId)
                    ),
                    versionBytes // NOTE: the byte must contain the chaind + v
                ),
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

    /// @dev Concats arbitrary bytes.
    /// @param _preBytes First byte array.
    /// @param _postBytes Second byte array.
    function concat(bytes memory _preBytes, bytes memory _postBytes)
        internal
        pure
        returns (bytes memory)
    {
        bytes memory tempBytes;

        assembly {
            tempBytes := mload(0x40)

            let length := mload(_preBytes)
            mstore(tempBytes, length)
            let mc := add(tempBytes, 0x20)
            let end := add(mc, length)

            for {
                let cc := add(_preBytes, 0x20)
            } lt(mc, end) {
                mc := add(mc, 0x20)
                cc := add(cc, 0x20)
            } {
                mstore(mc, mload(cc))
            }

            length := mload(_postBytes)
            mstore(tempBytes, add(length, mload(tempBytes)))
            mc := end
            end := add(mc, length)

            for {
                let cc := add(_postBytes, 0x20)
            } lt(mc, end) {
                mc := add(mc, 0x20)
                cc := add(cc, 0x20)
            } {
                mstore(mc, mload(cc))
            }
            mstore(
                0x40,
                and(
                    add(add(end, iszero(add(length, mload(_preBytes)))), 31),
                    not(31)
                )
            )
        }

        return tempBytes;
    }
}
