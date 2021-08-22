// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

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

    constructor(address _lendingPoolProvider, address _protocolDataProvider) {
        lendingPoolProvider = _lendingPoolProvider;
        protocolDataProvider = _protocolDataProvider;
    }

    function lendingPool() public view returns (address) {
        return ILendingPoolAddressesProvider(lendingPoolProvider).getLendingPool();
    }

    // TODO: rename to getAaveTokenAddress
    function aToken(address _token) public view returns (address) {
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
        uint256 reserves = IERC20(_token).balanceOf(_account);
        // address incentivesController = IAToken(_token).getIncentivesController();
        // uint256 reserves = IAaveIncentivesController(incentivesController).getUserAssetData(_account, _token);
        return reserves;
    }

    function deposit(address _token, uint256 _amount) external override {
        aTokenToUnderlying[aToken(_token)] = _token;
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
        withdraw(_token, type(uint256).max);
    }

    function withdraw(address _token, uint256 _amount) public override {
        address underlying = aTokenToUnderlying[_token];
        address lendPool = lendingPool();
        IERC20(_token).safeApprove(lendPool, 0);
        IERC20(_token).safeApprove(lendPool, _amount);
        uint256 maxAmount = IERC20(_token).balanceOf(address(this));

        uint256 amountWithdrawn = ILendingPool(lendPool).withdraw(underlying, _amount, msg.sender);

        require(
            amountWithdrawn == _amount ||
                (_amount == type(uint256).max &&
                    maxAmount == IERC20(underlying).balanceOf(address(this))),
            "Didn't withdraw requested amount"
        );
    }
}
