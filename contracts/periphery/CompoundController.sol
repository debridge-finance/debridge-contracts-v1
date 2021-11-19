// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/compound/IComptroller.sol";
import "../interfaces/compound/ICToken.sol";
import "../interfaces/IStrategy.sol";
import "./BaseStrategyController.sol";

contract CompoundController is BaseStrategyController {

  using SafeERC20 for IERC20;

  IComptroller public comptroller;
  mapping(address => address) public underlyingToCToken;

  constructor(address _comptroller) {
    comptroller = IComptroller(_comptroller);
    mapToCTokens();
  }

  function mapToCTokens() internal {
    address[] memory cTokens = comptroller.getAllMarkets();
    for (uint256 i = 0; i < cTokens.length; i++) {
      underlyingToCToken[ICToken(cTokens[i]).underlying()] = cTokens[i];
    }
  }

  function strategyToken(address _token) public view override returns (address) {
    address CToken = underlyingToCToken[_token];
    require(ICToken(CToken).isCToken(), "cToken: underlying does not map to cToken");
    return CToken;
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
    uint256 mintResult = ICToken(CToken).mint(_amount);
    require(mintResult == 0, "Supplying failed");
  }

  function withdrawAll(address _token) external override {
    uint256 owned = ICToken(_token).balanceOfUnderlying(address(this));
    withdraw(_token, owned);
  }

  function withdraw(address _token, uint256 _amount) public override {
    uint256 redeemResult = ICToken(_token).redeemUnderlying(_amount);
    _collectProtocolToken(_token);
    require(redeemResult == 0, "Redeeming failed");
  }

  // Collect COMP
  function _collectProtocolToken(address _token) internal {
      address[] memory cTokens = new address[](1);
      cTokens[0] = address(_token);
      comptroller.claimComp(address(this), cTokens);
  }
}
