// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ILendingPool.sol";
import "../interfaces/ILendingPoolAddressesProvider.sol";
import "../interfaces/IAaveProtocolDataProvider.sol";
import "../interfaces/IStrategy.sol";
import "./DefiController.sol";

contract AaveInteractor is IStrategy {
    
  using SafeERC20 for IERC20;

  address public lendingPoolProvider;
  address public protocolDataProvider;
  mapping(address => address) aTokenToUnderlying;

  // Collected yield in underlying tokens
  // gets calculated and increased on withdraw.
  // todo: should be transferred to treasury
  uint256 public underlyingTokensYield;

  constructor(
    address _lendingPoolProvider,
    address _protocolDataProvider
  ) {
    lendingPoolProvider = _lendingPoolProvider;
    protocolDataProvider = _protocolDataProvider;
  }

  function lendingPool() public view returns (address) {
    return ILendingPoolAddressesProvider(lendingPoolProvider).getLendingPool();
  }

  function aToken(address _token) public view returns (address) {
    (address newATokenAddress,,) =
      IAaveProtocolDataProvider(protocolDataProvider).getReserveTokensAddresses(_token);
    return newATokenAddress;
  }

  function updateReserves(address _account, address _token) 
    external 
    view 
    override 
    returns (uint256) 
  {
    uint256 reserves = IERC20(_token).balanceOf(_account);
    // address incentivesController = IAToken(_token).getIncentivesController();
    // uint256 reserves = IAaveIncentivesController(incentivesController).getUserAssetData(_account, _token);
    return reserves;
  }


// todo: add reentrancy guard
  function deposit(address _token, uint256 _amount) external override {
    aTokenToUnderlying[aToken(_token)] = _token;
    address lendPool = lendingPool();
    IERC20(_token).transferFrom(msg.sender, address(this), _amount);
    IERC20(_token).safeApprove(lendPool, 0);
    IERC20(_token).safeApprove(lendPool, _amount);
    ILendingPool(lendPool).deposit(
      _token,
      _amount,
      msg.sender,
      0 // referral code
    );
  }


  /**
   * @dev withdraw tokens from Aave Lending pool
   * @param _token underlying token address
   * @param _amount amount of underlying tokens to withdraw 
   * @return _body deposit body in underlying tokens
   * @return _yield yield amount in underlying tokens
   **/
  // todo: add reentrancy guard
  function withdraw(address _token, uint256 _amount) override public returns (uint256 _body, uint256 _yield) {
    address lendPool = lendingPool();
    address _aToken = aToken(_token);
    uint256 aTokenBalanceBefore = IERC20(_aToken).balanceOf(msg.sender);
    // IERC20(_aToken).safeApprove(lendPool, 0);
    // IERC20(_aToken).safeApprove(lendPool, _amount);  // TODO check neccessary
    uint256 maxAmount = IERC20(_token).balanceOf(address(this));

    uint256 amountWithdrawn = ILendingPool(lendPool).withdraw(
      _token,
      _amount,
      msg.sender
    );
    require(
      amountWithdrawn == _amount ||
      (_amount == type(uint256).max && maxAmount == IERC20(_token).balanceOf(address(this))),
      "Didn't withdraw requested amount"
    );
    
    uint256 aTokensWithdrawn = aTokenBalanceBefore - IERC20(_aToken).balanceOf(msg.sender);
    _yield = aTokensWithdrawn - amountWithdrawn;
    underlyingTokensYield += _yield;
    return (amountWithdrawn, _yield);
    // todo: gracefully treat situations when yield is negative. In this case 0 should be returned.
  }

    function withdrawAll(address _token) external override {
    withdraw(_token, type(uint256).max);
  }
}
