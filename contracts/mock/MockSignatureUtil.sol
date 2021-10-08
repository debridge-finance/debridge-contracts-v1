pragma solidity =0.8.7;

import "../libraries/SignatureUtil.sol";

contract MockSignatureUtil {

    using SignatureUtil for bytes;

    constructor(){}


    function call_splitSignature(bytes memory signature) public {
        signature.splitSignature();
    }

    function call_parseSignature(bytes memory signatures, uint256 offset) public {
        signatures.parseSignature(offset);
    }

    function call_toUint256(bytes memory _bytes, uint256 _offset) public {
        _bytes.toUint256(_offset);
    }
}