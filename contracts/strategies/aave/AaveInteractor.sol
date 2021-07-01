pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interface/ILendingPool.sol";
import "../../interfaces/ILendingPoolAddressesProvider.sol";
import "../../interfaces/IAaveProtocolDataProvider.sol";
import "../../interfaces/IAaveIncentivesController.sol";
import "../../interfaces/IStrategy.sol";

contract AaveInteractor is IStrategy, IAaveIncentivesController {
    
  using SafeERC20 for IERC20;

  address public lendingPoolProvider;
  address public protocolDataProvider;
  address public strategyController;
  mapping(address => address) aTokenToUnderlying;

  constructor(
    address _lendingPoolProvider,
    address _protocolDataProvider,
    address _strategyController
  ) public {
    lendingPoolProvider = _lendingPoolProvider;
    protocolDataProvider = _protocolDataProvider;
    strategyController = _strategyController;
  }

  function lendingPool() public view returns (address) {
    return ILendingPoolAddressesProvider(lendingPoolProvider).getLendingPool();
  }

  function aToken(address _token) public view returns (address) {
    (address newATokenAddress,,) =
      IAaveProtocolDataProvider(protocolDataProvider).getReserveTokensAddresses(_token);
    return newATokenAddress;
  }

  function deposit(address _token, uint256 amount) external override onlyStrategyController() {
    aTokenToUnderlying[aToken(_token)] = _token;
    address lendPool = lendingPool();
    IERC20(_token).safeApprove(lendPool, 0);
    IERC20(_token).safeApprove(lendPool, amount);

    ILendingPool(lendPool).deposit(
      _token,
      amount,
      address(this),
      0 // referral code
    );
  }

  function withdrawAll(address _token) external override onlyStrategyController() {
    withdraw(_token, type(uint256).max);
  }

  function withdraw(address _token, uint256 _amount) public override onlyStrategyController() {
    address underlying = aTokenToUnderlying[_token];
    address lendPool = lendingPool();
    IERC20(_token).safeApprove(lendPool, 0);
    IERC20(_token).safeApprove(lendPool, _amount);
    uint256 maxAmount = IERC20(_token).balanceOf(address(this));

    uint256 amountWithdrawn = ILendingPool(lendPool).withdraw(
      underlying,
      _amount,
      strategyController
    );

    require(
      amountWithdrawn == _amount ||
      (_amount == type(uint256).max && maxAmount == IERC20(underlying).balanceOf(address(this))),
      "Did not withdraw requested amount"
    );
  }

  function getRewardBalance(address _account, address _token) 
    external 
    view 
    override 
    returns (uint256) 
  {
    address[] memory tokens = new address[](1);
    tokens[0] = _token;
    uint256 rewards = super.getRewardsBalance(tokens, _account);
    return rewards;
  }

  function getAssetBalance(address _account, address _token) 
    external 
    view 
    override 
    returns (uint256) 
  {
    uint256 balance = super.getUserAssetData(_account, _token);
    return balance;
  }

    /* modifiers */

    modifier onlyStrategyController() {
        require(strategyController == msg.sender, "Only strategy controller");
        _;
    }
}
