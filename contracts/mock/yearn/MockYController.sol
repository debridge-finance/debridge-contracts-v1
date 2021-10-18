// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./IController.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockYController is IController {
    using SafeERC20 for IERC20;
    using Address for address;

    mapping(address => address) public _vaults;
    mapping(address => uint256) public balances;

    constructor() {
    }

    function setVault(address _token, address _vault) public {
        require(_vaults[_token] == address(0), "vault");
        _vaults[_token] = _vault;
    }

    function balanceOf(address _token) external view override returns (uint256) {
        return balances[_token];
    }

    function withdrawAll(address _token) public {
        withdraw(_token, type(uint256).max);
    }

    function withdraw(address _token, uint256 _amount) public override {
        require(msg.sender == _vaults[_token], "!vault");
        balances[_token] -= _amount;
        IERC20(_token).safeTransferFrom(_token, msg.sender, _amount);
    }

    function vaults(address _token) public view override returns (address) {
        return _vaults[_token];
    }
}
