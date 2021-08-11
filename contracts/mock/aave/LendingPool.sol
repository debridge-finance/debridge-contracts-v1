// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
import {LendingPoolAddressesProvider} from "./LendingPoolAddressesProvider.sol";
import {MockAToken} from "./MockAToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract LendingPool {
    using SafeERC20 for IERC20;

    struct ReserveData {
        //stores the reserve configuration
        bool configuration;
        //the liquidity index. Expressed in ray
        uint128 liquidityIndex;
        //variable borrow index. Expressed in ray
        uint128 variableBorrowIndex;
        //the current supply rate. Expressed in ray
        uint128 currentLiquidityRate;
        //the current variable borrow rate. Expressed in ray
        uint128 currentVariableBorrowRate;
        //the current stable borrow rate. Expressed in ray
        uint128 currentStableBorrowRate;
        uint40 lastUpdateTimestamp;
        //tokens addresses
        address aTokenAddress;
        address stableDebtTokenAddress;
        address variableDebtTokenAddress;
        //address of the interest rate strategy
        address interestRateStrategyAddress;
        //the id of the reserve. Represents the position in the list of the active reserves
        uint8 id;
    }

    event Deposit(
        address indexed reserve,
        address user,
        address indexed onBehalfOf,
        uint256 amount,
        uint16 indexed referral
    );

    event Withdraw(address asset, address user, address onBehalfOf, uint256 amount);

    LendingPoolAddressesProvider public _addressesProvider;
    mapping(address => ReserveData) internal _reserves;

    function initialize(LendingPoolAddressesProvider provider) public {
        _addressesProvider = provider;
    }

    function addReserveAsset(address underlyingAsset, address aTokenAddress) public {
        _reserves[underlyingAsset] = ReserveData(
            false,
            0,
            0,
            0,
            0,
            0,
            0,
            aTokenAddress,
            address(0),
            address(0),
            address(0),
            0
        );
    }

    function deposit(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external {
        ReserveData storage reserve = _reserves[asset];

        address aToken = reserve.aTokenAddress;

        IERC20(asset).safeTransferFrom(msg.sender, aToken, amount);
        MockAToken(aToken).mint(onBehalfOf, amount, reserve.liquidityIndex);

        emit Deposit(asset, onBehalfOf, onBehalfOf, amount, referralCode);
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256) {
        ReserveData storage reserve = _reserves[asset];

        address aToken = reserve.aTokenAddress;

        uint256 userBalance = MockAToken(aToken).balanceOf(to);
        uint256 amountToWithdraw = amount;

        if (amount == type(uint256).max) {
            amountToWithdraw = userBalance;
        }

        MockAToken(aToken).burn(to, to, amountToWithdraw, reserve.liquidityIndex);

        emit Withdraw(asset, to, to, amountToWithdraw);

        return amountToWithdraw;
    }

    function getReserveData(address asset) external view returns (ReserveData memory) {
        return _reserves[asset];
    }
}
