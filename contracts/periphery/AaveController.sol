// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/aave/ILendingPool.sol";
import "../interfaces/aave/ILendingPoolAddressesProvider.sol";
import "../interfaces/aave/IAaveProtocolDataProvider.sol";
import "../interfaces/aave/IAToken.sol";
import "../interfaces/IStrategy.sol";
import "./BaseStrategyController.sol";

contract AaveController is BaseStrategyController {
    using SafeERC20 for IERC20;

    address public lendingPoolProvider;
    address public protocolDataProvider;

    constructor(address _lendingPoolProvider, address _protocolDataProvider) {
        lendingPoolProvider = _lendingPoolProvider;
        protocolDataProvider = _protocolDataProvider;
    }

    function lendingPool() public view returns (address) {
        return ILendingPoolAddressesProvider(lendingPoolProvider).getLendingPool();
    }

    function strategyToken(address _token) public view override returns (address) {
        (address newATokenAddress, , ) = IAaveProtocolDataProvider(protocolDataProvider)
            .getReserveTokensAddresses(_token);
        return newATokenAddress;
    }

    function updateReserves(address _account, address _token)
        external
        view
        override
        returns (uint256)
    {
        return IERC20(_token).balanceOf(_account);
    }

    function _deposit(address _token, uint256 _amount) internal override {
        address lendPool = lendingPool();
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_token).safeApprove(lendPool, 0);
        IERC20(_token).safeApprove(lendPool, _amount);

        ILendingPool(lendPool).deposit(
            _token,
            _amount,
            msg.sender,
            0 // referral code
        );
    }

    function withdrawAll(address _token) external override {
        _withdraw(_token, type(uint256).max);
    }

    function _withdraw(address _token, uint256 _amount) internal override {
        address lendPool = lendingPool();
        address aToken = strategyToken(_token);
        IERC20(_token).safeApprove(lendPool, 0);
        IERC20(_token).safeApprove(lendPool, _amount);
        uint256 maxAmount = IERC20(aToken).balanceOf(msg.sender);

        uint256 userBalance = IERC20(aToken).balanceOf(msg.sender);
        uint256 amountToWithdraw = _amount;

        if (_amount == type(uint256).max || _amount > userBalance) {
            amountToWithdraw = userBalance;
        }

        IERC20(aToken).transferFrom(msg.sender, address(this), amountToWithdraw);

        uint256 amountWithdrawn = ILendingPool(lendPool).withdraw(
            _token,
            amountToWithdraw,
            msg.sender
        );

        _collectProtocolToken(aToken, amountToWithdraw / maxAmount);

        require(
            amountWithdrawn == _amount ||
                (_amount == type(uint256).max && maxAmount == amountWithdrawn),
            "Didn't withdraw requested amount"
        );
    }

    // Collect stkAAVE
    function _collectProtocolToken(address _token, uint256 _amount) internal {
        address[] memory assets = new address[](1);
        assets[0] = address(_token);
        IAaveIncentivesController incentivesController = IAToken(_token).getIncentivesController();
        uint256 rewardsBalance = incentivesController.getRewardsBalance(assets, address(this));
        incentivesController.claimRewards(assets, _amount * rewardsBalance, address(this));
    }
}
