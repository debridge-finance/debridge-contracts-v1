// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./MockYToken.sol";
import "./YRegistry.sol";
import "./MockYVault.sol";
import "../../interfaces/IStrategy.sol";
import "hardhat/console.sol";
import "../../periphery/BaseStrategyController.sol";

contract MockYearnController is BaseStrategyController {

  using SafeERC20 for IERC20;

  address yRegistry;
  mapping(address => address) public underlyingToYToken;

  constructor(address _yRegistry) {
    yRegistry = _yRegistry;
    mapToYTokens();
  }

  function mapToYTokens() internal {
    MockYearnVault[] memory yTokens = YRegistry(yRegistry).getVaults();
    for (uint256 i = 0; i < yTokens.length; i++) {
      underlyingToYToken[MockYearnVault(yTokens[i]).underlying()] = address(yTokens[i]);
    }
  }

  function strategyToken(address _token) public view override returns (address) {
      require(underlyingToYToken[_token] != address(0), "MockYearnController: underlying does not map to yToken");
    return underlyingToYToken[_token];
  }

  function updateReserves(address _account, address _token)
    external
    view
    override
    returns (uint256)
  {
    return MockYToken(_token).balanceOf(_account);
  }

  function _deposit(address _token, uint256 _amount) internal override {
    IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
    address yToken = strategyToken(_token);
    IERC20(_token).safeApprove(yToken, 0);
    IERC20(_token).safeApprove(yToken, _amount);
    MockYToken(yToken).deposit(_amount);
  }

  function withdrawAll(address _token) external override {
    _withdraw(_token, type(uint256).max);
  }

  function _withdraw(address _token, uint256 _amount) internal override {
    MockYToken(_token).withdraw(_amount);
  }
  
}
