// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./EnumerableSet.sol";
import "./MockYController.sol";
import "./MockYVault.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract YRegistry {
    using Address for address;
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet private vaults;
    EnumerableSet.AddressSet private controllers;

    constructor() {}

    function addVault(address _vault) public {
        setVault(_vault);

        address controller = getVaultData(_vault);

        setController(controller);
    }

    function setController(address _controller) internal {
        if (!controllers.contains(_controller)) {
            controllers.add(_controller);
        }
    }

    function setVault(address _vault) internal {
        require(_vault.isContract(), "Vault is not a contract");
        // Checks if vault is already on the array
        require(!vaults.contains(_vault), "Vault already exists");
        // Adds unique _vault to vaults array
        vaults.add(_vault);
    }

    function getVaultData(address _vault)
        internal
        view
        returns (address)
    {
        address vault = _vault;

        // Get values from controller
        address controller = MockYearnVault(vault).controller();
        address token = MockYearnVault(vault).underlying();

        // Check if vault is set on controller for token
        address controllerVault = address(0);
        controllerVault = MockYController(controller).vaults(token);
        require(controllerVault == vault, "Controller vault address does not match"); // Might happen on Proxy Vaults

        return controller;
    }

    function getVaults() external view returns (MockYearnVault[] memory) {
        MockYearnVault[] memory vaultsArray = new MockYearnVault[](vaults.length());
        for (uint256 i = 0; i < vaults.length(); i++) {
            vaultsArray[i] = MockYearnVault(vaults.at(i));
        }
        return vaultsArray;
    }
}