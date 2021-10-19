pragma solidity 0.8.7;

import "../periphery/CallProxy.sol";

contract MockCallProxy is CallProxy {

    constructor() {
        initialize(0);
    }

    function mock_set_gate_role(address gate) public {
        _setupRole(DEBRIDGE_GATE_ROLE, gate);
    }
}