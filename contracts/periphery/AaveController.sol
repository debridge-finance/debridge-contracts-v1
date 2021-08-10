// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ILendingPool.sol";
import "../interfaces/ILendingPoolAddressesProvider.sol";
import "../interfaces/IAaveProtocolDataProvider.sol";
import "../interfaces/IStrategy.sol";

contract AaveInteractor is IStrategy {
    
  using SafeERC20 for IERC20;

  address public lendingPoolProvider;
  address public protocolDataProvider;
  mapping(address => address) aTokenToUnderlying;
  // total amount of underlying tokens locked in the strategy (yield not included)
  uint256 public underlyingTokensDeposited;
  // total amount of aTokens received for deposited underlying tokens
  uint256 public aTokensReceived;
  
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
    uint256 aTokenBalanceBefore = IERC20(aToken(_token)).balanceOf(address(this));
    uint256 underlyingBalanceBefore = IERC20(_token).balanceOf(address(this));
    ILendingPool(lendPool).deposit(
      _token,
      _amount,
      msg.sender,
      0 // referral code
    );
    aTokensReceived += IERC20(aToken(_token)).balanceOf(address(this)) - aTokenBalanceBefore;
    underlyingTokensDeposited += underlyingBalanceBefore - IERC20(_token).balanceOf(address(this));
  }

  function withdrawAll(address _token) external override {
    withdraw(_token, type(uint256).max);
  }

  /**
   * @dev withdraw tokens from Aave Lending pool
   * @return _body deposit body in underlying tokens
   * @return _yield yield amount in underlying tokens
   **/
  // todo: add reentrancy guard
  function withdraw(address _token, uint256 _amount) public override returns (uint256 _body, uint256 _yield) {
    address underlying = aTokenToUnderlying[_token];
    address lendPool = lendingPool();
    IERC20(_token).safeApprove(lendPool, 0);
    IERC20(_token).safeApprove(lendPool, _amount);
    uint256 maxAmount = IERC20(_token).balanceOf(address(this));
    uint256 aTokenBalanceBefore = IERC20(aToken(_token)).balanceOf(address(this));
    uint256 underlyingBalanceBefore = IERC20(_token).balanceOf(msg.sender);
    uint256 amountWithdrawn = ILendingPool(lendPool).withdraw(
      underlying,
      _amount,
      msg.sender
    );

    require(
      amountWithdrawn == _amount ||
      (_amount == type(uint256).max && maxAmount == IERC20(underlying).balanceOf(address(this))),
      "Didn't withdraw requested amount"
    );

    uint256 aTokensWithdrawn = aTokenBalanceBefore - IERC20(aToken(_token)).balanceOf(address(this));
    require(aTokensWithdrawn == amountWithdrawn, "withdraw: unexpected aToken withdrawal result");

    uint256 underlyingTokensReturned = IERC20(_token).balanceOf(msg.sender) - underlyingBalanceBefore;
    underlyingTokensDeposited -= underlyingTokensReturned;

    uint256 _body = getUnderlyingByA(amountWithdrawn);
    uint256 _yield = underlyingTokensReturned - _body;
    // todo: gracefully treat situations when yield is negative. In this case 0 should be returned.
  }

  /**
   * @dev Returns the `amount` of a overlying tokens by underlying token amount.
   * The calculation based on the average rate for all underlying asset deposits.
   * @param _amount amount of underlying asset
   * @return The amount of A-tokens
   **/
  function getAByUnderlying(uint256 _amount) public view returns (uint256) {
    return ( _amount * aTokensReceived / underlyingTokensDeposited );
  }


  /**
   * @dev Returns the `amount` of underlying tokens by a token amount.
   * The calculation based on the average rate for all underlying asset deposits.
   * @param _amount amount of a tokens
   * @return The amount of underlying tokens
   **/
  function getUnderlyingByA(uint256 _amount) public view returns (uint256) {
    return ( _amount * underlyingTokensDeposited / aTokensReceived );
  }
}
