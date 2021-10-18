// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Comptroller.sol";
import "./MockCToken.sol";
import "../../interfaces/IStrategy.sol";

contract MockCompoundController is IStrategy {

  using SafeERC20 for IERC20;

  Comptroller public comptroller;
  mapping(address => address) public underlyingToCToken;

  constructor(address _comptroller) {
    comptroller = Comptroller(_comptroller);
    mapToCTokens();
  }

  function mapToCTokens() internal {
    address[] memory cTokens = comptroller.getAllMarkets();
    for (uint256 i = 0; i < cTokens.length; i++) {
      underlyingToCToken[MockCToken(cTokens[i]).UNDERLYING_ASSET_ADDRESS()] = cTokens[i];
    }
  }

  function strategyToken(address _token) public view override returns (address) {
    require(underlyingToCToken[_token] != address(0), "MockCompoundController: underlying does not map to cToken");
    return underlyingToCToken[_token];
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
    address CToken = strategyToken(_token);
    IERC20(_token).safeApprove(CToken, 0);
    IERC20(_token).safeApprove(CToken, _amount);
    MockCToken(CToken).mint(msg.sender, _amount, 0);
  }

  function withdrawAll(address _token) external override {
    withdraw(_token, type(uint256).max);
  }

  function withdraw(address _token, uint256 _amount) public override {
    address cToken = strategyToken(_token);
    uint256 maxAmount = IERC20(cToken).balanceOf(msg.sender);

    uint256 userBalance = IERC20(cToken).balanceOf(msg.sender);
    uint256 amountToWithdraw = _amount;

    if (_amount == type(uint256).max || _amount > userBalance) {
        amountToWithdraw = userBalance;
    }
        
    IERC20(cToken).transferFrom(msg.sender, address(this), amountToWithdraw);
    MockCToken(cToken).burn(msg.sender, msg.sender, amountToWithdraw, 0);

    _collectProtocolToken(_token);
  }

  // Collect COMP
  function _collectProtocolToken(address _token) internal {
      ICToken[] memory cTokens = new ICToken[](1);
      cTokens[0] = ICToken(_token);
      comptroller.claimComp(address(this), cTokens);
  }
}
