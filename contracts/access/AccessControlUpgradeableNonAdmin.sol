// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

abstract contract AccessControlUpgradeableNonAdmin is AccessControlUpgradeable {
    modifier onlyNonAdminAddress(bytes32 role, address account) {
        require(!hasRole(getRoleAdmin(role), account), "Cannot set admin address");
        _;
    }

// @dev this is a non-admin-only function that chet the address passed to grantRole does not match the admin address
    function grantRoleNonAdmin(bytes32 role, address account) public virtual onlyNonAdminAddress(role, account) {
        grantRole(role, account);
    }

}