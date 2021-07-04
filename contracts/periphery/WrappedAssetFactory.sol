// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IWrappedAssetFactory.sol";
import "./WrappedAsset.sol";

contract WrappedAssetFactory is IWrappedAssetFactory, AccessControl {
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE"); // minter role identifier

    modifier onlyDeployer {
        require(hasRole(DEPLOYER_ROLE, msg.sender), "onlyMinter: bad role");
        _;
    }

    /// @dev Constructor that initializes the most important configurations.
    constructor(address _admin, address[] memory _deployers) {
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        for (uint256 i = 0; i < _deployers.length; i++) {
            _setupRole(DEPLOYER_ROLE, _deployers[i]);
        }
    }

    /// @dev Issues new tokens.
    function deploy(
        string memory _name,
        string memory _symbol,
        address _admin,
        address[] memory _minters
    ) external override onlyDeployer() returns (address) {
        WrappedAsset wrappedAsset = new WrappedAsset(
            _name,
            _symbol,
            _admin,
            _minters
        );
        return address(wrappedAsset);
    }
}
