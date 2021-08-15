// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/yearn/IYToken.sol";
import "../interfaces/yearn/IYRegistry.sol";
import "../interfaces/yearn/IYearnVault.sol";
import "../interfaces/IStrategy.sol";

contract YearnController is IStrategy {
    
  using SafeERC20 for IERC20;

  address yRegistry;
  mapping(address => address) public underlyingToYToken;

  constructor(address _yRegistry) {
    yRegistry = _yRegistry;
    mapToYTokens();
  }

  function mapToYTokens() internal {
    address[] memory yTokens = IYRegistry(yRegistry).getVaults();
    for (uint256 i = 0; i < yTokens.length; i++) {
      underlyingToYToken[IYearnVault(yTokens[i]).token()] = yTokens[i];
    }
  }

  function strategyToken(address _token) public view override returns (address) {
    return underlyingToYToken[_token];
  }

  function updateReserves(address _account, address _token) 
    external 
    view 
    override 
    returns (uint256) 
  {
    return IERC20(_token).balanceOf(_account);
  }

  function deposit(address _token, uint256 _amount) external override {
    IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
    address YToken = strategyToken(_token);
    IERC20(_token).safeApprove(YToken, 0);
    IERC20(_token).safeApprove(YToken, _amount);
    IYToken(YToken).deposit(_amount);
  }

  function withdrawAll(address _token) external override {
    withdraw(_token, type(uint256).max);
  }

  function withdraw(address _token, uint256 _amount) public override {
    IYToken(_token).withdraw(_amount);
  }
}
