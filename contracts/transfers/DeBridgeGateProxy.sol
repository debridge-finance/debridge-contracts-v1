// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.7;

import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract DeBridgeGateProxy is TransparentUpgradeableProxy {
    constructor(
        address _logic,
        address admin_,
        bytes memory _data
    ) payable TransparentUpgradeableProxy(_logic, admin_, _data) {
    }

    receive() external payable override {}
}