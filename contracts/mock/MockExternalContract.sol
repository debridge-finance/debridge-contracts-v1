// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../interfaces/IDeBridgeGate.sol";

contract MockExternalContract {

    function readIsSubmissionUsed(
        IDeBridgeGate _gate,
        bytes32 _debridgeId
    ) external returns (bool) {
        return _gate.isSubmissionUsed(_debridgeId);
    }
}
