// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IWrappedAsset.sol";

contract WrappedAsset is AccessControl, IWrappedAsset, ERC20 {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    modifier onlyMinter {
        require(hasRole(MINTER_ROLE, msg.sender), "onlyAggregator: bad role");
        _;
    }

    constructor(string memory _name, string memory _symbol)
        ERC20(_name, _symbol)
    {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
    }

    function mint(address _receiver, uint256 _amount)
        external
        override
        onlyMinter()
    {
        _mint(_receiver, _amount);
    }

    function burn(uint256 _amount) external override onlyMinter() {
        _burn(msg.sender, _amount);
    }
}
