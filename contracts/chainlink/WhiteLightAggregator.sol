// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract WhiteLightAggregator is AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE"); // role allowed to submit the data
    uint256 public minConfirmations; // minimal required confimations
    bytes[2] public utilityBytes;
    // [    hex"72736F8c88bd1e438B05aCc28C58ac21C5dC76CE80a4",    hex"388080"];

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
    struct SignatureInfo {
        bytes payloadPart;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    mapping(bytes32 => SubmissionInfo) public getMintInfo; // mint id => submission info
    mapping(bytes32 => SubmissionInfo) public getBurntInfo; // burnt id => submission info

    event Confirmed(bytes32 submissionId, address operator); // emitted once the submission is confirmed
    event SubmissionApproved(bytes32 submissionId); // emitted once the submission is confirmed

    /// @dev Constructor that initializes the most important configurations.
    /// @param _minConfirmations Minimal required confirmations.
    constructor(uint256 _minConfirmations, bytes[2] memory _utilityBytes) {
        minConfirmations = _minConfirmations;
        utilityBytes = _utilityBytes;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @dev Confirms the mint request.
    /// @param _mintId Submission identifier.
    function submitMint(bytes32 _mintId, bytes[2][] memory _trxData)
        external
        returns (bool)
    {
        SubmissionInfo storage mintInfo = getMintInfo[_mintId];
        for (uint256 i = 0; i < _trxData.length; i++) {
            bytes memory unsignedTrx =
                getUnsignedTrx(_trxData[i][0], hex"0b29b943", _mintId);
            address oracle =
                recoverSigner(keccak256(unsignedTrx), _trxData[i][1]);
            require(hasRole(ORACLE_ROLE, oracle), "onlyOracle: bad role");
            require(!mintInfo.hasVerified[oracle], "submit: submitted already");
            mintInfo.confirmations += 1;
            mintInfo.hasVerified[oracle] = true;
            if (mintInfo.confirmations >= minConfirmations) {
                mintInfo.confirmed = true;
                emit SubmissionApproved(_mintId);
            }
            emit Confirmed(_mintId, oracle);
        }
        return mintInfo.confirmed;
    }

    /// @dev Confirms the burnnt request.
    /// @param _burntId Submission identifier.
    function submitBurn(bytes32 _burntId, bytes[2][] memory _trxData)
        external
        returns (bool)
    {
        SubmissionInfo storage burnInfo = getBurntInfo[_burntId];
        for (uint256 i = 0; i < _trxData.length; i++) {
            bytes memory unsignedTrx =
                getUnsignedTrx(_trxData[i][0], hex"c4b56cd0", _burntId);
            address oracle =
                recoverSigner(keccak256(unsignedTrx), _trxData[i][1]);
            require(hasRole(ORACLE_ROLE, oracle), "onlyOracle: bad role");
            require(!burnInfo.hasVerified[oracle], "submit: submitted already");
            burnInfo.confirmations += 1;
            burnInfo.hasVerified[oracle] = true;
            if (burnInfo.confirmations >= minConfirmations) {
                burnInfo.confirmed = true;
                emit SubmissionApproved(_burntId);
            }
            emit Confirmed(_burntId, oracle);
        }
        return burnInfo.confirmed;
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

    /// @dev Returns whether mint request is confirmed.
    /// @param _mintId Submission identifier.
    /// @return Whether mint request is confirmed.
    function isMintConfirmed(bytes32 _mintId) external view returns (bool) {
        return getMintInfo[_mintId].confirmed;
    }

    /// @dev Returns whether burnnt request is confirmed.
    /// @param _burntId Submission identifier.
    /// @return Whether burnnt request is confirmed.
    function isBurntConfirmed(bytes32 _burntId) external view returns (bool) {
        return getBurntInfo[_burntId].confirmed;
    }

    function getUnsignedTrx(
        bytes memory _payloadPart,
        bytes memory _method,
        bytes32 _mintId
    ) public view returns (bytes memory) {
        return
            concat(
                concat(
                    concat(concat(_payloadPart, utilityBytes[0]), _method),
                    abi.encodePacked(_mintId)
                ),
                utilityBytes[1]
            );
    }

    function recoverSigner(
        bytes32 _ethSignedMessageHash,
        bytes memory _signature
    ) public pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);

        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function splitSignature(bytes memory sig)
        public
        pure
        returns (
            bytes32 r,
            bytes32 s,
            uint8 v
        )
    {
        require(sig.length == 65, "invalid signature length");

        assembly {
            /*
            First 32 bytes stores the length of the signature

            add(sig, 32) = pointer of sig + 32
            effectively, skips first 32 bytes of signature

            mload(p) loads next 32 bytes starting at the memory address p into memory
            */

            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }

        // implicitly return (r, s, v)
    }

    function concat(bytes memory _preBytes, bytes memory _postBytes)
        internal
        pure
        returns (bytes memory)
    {
        bytes memory tempBytes;

        assembly {
            // Get a location of some free memory and store it in tempBytes as
            // Solidity does for memory variables.
            tempBytes := mload(0x40)

            // Store the length of the first bytes array at the beginning of
            // the memory for tempBytes.
            let length := mload(_preBytes)
            mstore(tempBytes, length)

            // Maintain a memory counter for the current write location in the
            // temp bytes array by adding the 32 bytes for the array length to
            // the starting location.
            let mc := add(tempBytes, 0x20)
            // Stop copying when the memory counter reaches the length of the
            // first bytes array.
            let end := add(mc, length)

            for {
                // Initialize a copy counter to the start of the _preBytes data,
                // 32 bytes into its memory.
                let cc := add(_preBytes, 0x20)
            } lt(mc, end) {
                // Increase both counters by 32 bytes each iteration.
                mc := add(mc, 0x20)
                cc := add(cc, 0x20)
            } {
                // Write the _preBytes data into the tempBytes memory 32 bytes
                // at a time.
                mstore(mc, mload(cc))
            }

            // Add the length of _postBytes to the current length of tempBytes
            // and store it as the new length in the first 32 bytes of the
            // tempBytes memory.
            length := mload(_postBytes)
            mstore(tempBytes, add(length, mload(tempBytes)))

            // Move the memory counter back from a multiple of 0x20 to the
            // actual end of the _preBytes data.
            mc := end
            // Stop copying when the memory counter reaches the new combined
            // length of the arrays.
            end := add(mc, length)

            for {
                let cc := add(_postBytes, 0x20)
            } lt(mc, end) {
                mc := add(mc, 0x20)
                cc := add(cc, 0x20)
            } {
                mstore(mc, mload(cc))
            }

            // Update the free-memory pointer by padding our last write location
            // to 32 bytes: add 31 bytes to the end of tempBytes to move to the
            // next 32 byte block, then round down to the nearest multiple of
            // 32. If the sum of the length of the two arrays is zero then add
            // one before rounding down to leave a blank 32 bytes (the length block with 0).
            mstore(
                0x40,
                and(
                    add(add(end, iszero(add(length, mload(_preBytes)))), 31),
                    not(31) // Round down to the nearest 32 bytes.
                )
            )
        }

        return tempBytes;
    }
}

// payloadPart0
// <>mainAggregatorAddr80a4
// mintId
// <>388080
// v
// r
// s
// curl -H "Content-Type: application/json" -X POST --data \
// '{"jsonrpc":"2.0","method":"eth_getRawTransactionByHash","params":["0x2283e8ce36373904d48c6fbdad833bc4d7a70ba933d9855c13c3e7a6ebd5735b"],"id":1}' http://46.4.15.216:8546

// f88a1385012a05f2008307a12094
// 72736f8c88bd1e438b05acc28c58ac21c5dc76ce
// 80a4
// 0b29b943
// 081c750bd2db46f668d3473f90ab06610cd19217c997fe9ca748700640431aa1 // msg
// 388080

// f88a1385012a05f2008307a1209472736f8c88bd1e438b05acc28c58ac21c5dc76ce80a40b29b943081c750bd2db46f668d3473f90ab06610cd19217c997fe9ca748700640431aa1388080

// f8491385012a05f2008307a1209472736f8c88bd1e438b05acc28c58ac21c5dc76ce80a40b29b943081c750bd2db46f668d3473f90ab06610cd19217c997fe9ca748700640431aa1388080

// 0xf88a1385012a05f2008307a1209472736f8c88bd1e438b05acc28c58ac21c5dc76ce80a40b29b943081c750bd2db46f668d3473f90ab06610cd19217c997fe9ca748700640431aa1
// 40be5a02232e429759d9ff9beb8646b1d22454893b3d46a33e1ed716e2e5aedefc11a966b8cef4e501b9e017592643a7246aec007a73d545b06f5301d22bc14bee
// cannot encode object for signature with missing names
// (argument="values", coder={"name":"bytes","type":"bytes","localName":null,"dynamic":true}, value={"payloadPart":"0xf8491385012a05f2008307a12094","v":1,"r":"0xbe5a02232e429759d9ff9beb8646b1d22454893b3d46a33e1ed716e2e5aedefc","s":"0x11a966b8cef4e501b9e017592643a7246aec007a73d545b06f5301d22bc14bee"}, code=INVALID_ARGUMENT, version=abi/5.0.7)

// [["payloadPart", "0xf8491385012a05f2008307a12094"], ["v": 1], ["r": "0xbe5a02232e429759d9ff9beb8646b1d22454893b3d46a33e1ed716e2e5aedefc"], ["s", "0x11a966b8cef4e501b9e017592643a7246aec007a73d545b06f5301d22bc14bee"]]
// [{ "payloadPart": "0xf8491385012a05f2008307a12094" ,     "v": 1,      "r": "0xbe5a02232e429759d9ff9beb8646b1d22454893b3d46a33e1ed716e2e5aedefc",      "s": "0x11a966b8cef4e501b9e017592643a7246aec007a73d545b06f5301d22bc14bee" }]
// {
//   "nonce": 19,
//   "gasPrice": {
//     "type": "BigNumber",
//     "hex": "0x012a05f200"
//   },
//   "gasLimit": {
//     "type": "BigNumber",
//     "hex": "0x07a120"
//   },
//   "to": "0x72736F8c88bd1e438B05aCc28C58ac21C5dC76CE",
//   "value": {
//     "type": "BigNumber",
//     "hex": "0x00"
//   },
//   "data": "0x0b29b943081c750bd2db46f668d3473f90ab06610cd19217c997fe9ca748700640431aa1",
//   "chainId": 56,
//   "v": 148,
//   "r": "0xbe5a02232e429759d9ff9beb8646b1d22454893b3d46a33e1ed716e2e5aedefc",
//   "s": "0x11a966b8cef4e501b9e017592643a7246aec007a73d545b06f5301d22bc14bee",
//   "from": "0x0b341A3fD55d4cc8aDb856859Bd426231a21a0d3",
//   "hash": "0x2283e8ce36373904d48c6fbdad833bc4d7a70ba933d9855c13c3e7a6ebd5735b"
// }
//[ "0x72736f8c88bd1e438b05acc28c58ac21c5dc76ce80a4", "0x388080" ]
// {
// 	"bytes32 _mintId": "0x081c750bd2db46f668d3473f90ab06610cd19217c997fe9ca748700640431aa1",
// 	"bytes[2][] _trxData": [
// 		[
// 			"0xf8491385012a05f2008307a12094",
// 			"0xbe5a02232e429759d9ff9beb8646b1d22454893b3d46a33e1ed716e2e5aedefc11a966b8cef4e501b9e017592643a7246aec007a73d545b06f5301d22bc14bee1c"
// 		]
// 	]
// }
