pragma solidity =0.8.7;

import "../libraries/SignatureUtil.sol";

contract MockSignatureUtil {

    using SignatureUtil for bytes;

    constructor(){}


    function call_splitSignature(bytes memory signature) public {
        signature.splitSignature();
    }
}