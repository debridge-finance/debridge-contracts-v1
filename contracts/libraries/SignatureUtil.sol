// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

library SignatureUtil {
    /// @dev Prepares raw msg that was signed by the oracle.
    /// @param _submissionId Submission identifier.
    function getUnsignedMsg(bytes32 _submissionId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _submissionId));
    }

    /// @dev Splits signature bytes to r,s,v components.
    /// @param _signature Signature bytes in format r+s+v.
    function splitSignature(bytes memory _signature)
        internal
        pure
        returns (
            bytes32 r,
            bytes32 s,
            uint8 v
        )
    {
        require(_signature.length == 65, "splitSignature: invalid length");
        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := and(mload(add(_signature, 65)), 0xff)
            //the same
            // v := byte(0, mload(add(_signature, 96)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Incorrect v");
    }
}
