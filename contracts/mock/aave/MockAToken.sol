// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {LendingPool} from "./LendingPool.sol";
import {WadRayMath} from "./libraries/WadRayMath.sol";


contract MockAToken is ERC20 {
    using SafeERC20 for IERC20;
    using WadRayMath for uint256;

    LendingPool public immutable POOL;
    uint8 private _decimals;
    address public immutable UNDERLYING_ASSET_ADDRESS;
    mapping(address => uint256) internal _balances;

    event Mint(address indexed to, uint256 value, uint256 index);
    event Burn(address indexed from, address indexed target, uint256 value, uint256 index);

    constructor(
        LendingPool pool,
        string memory _name,
        string memory _symbol,
        uint8 _decimal,
        address uderlyingAssetAddress
    ) ERC20(_name, _symbol) {
        POOL = pool;
        _decimals = _decimal;
        UNDERLYING_ASSET_ADDRESS = uderlyingAssetAddress;
    }

    function mint(
        address user,
        uint256 amount,
        uint256 index
    ) external returns (bool) {
        uint256 oldAccountBalance = _balances[user];
        _balances[user] = oldAccountBalance + amount;
        _mint(user, amount);

        emit Transfer(address(0), user, amount);
        emit Mint(user, amount, index);

        return true;
    }

    function burn(
        address user,
        address receiverOfUnderlying,
        uint256 amount,
        uint256 index
    ) external {
        uint256 oldAccountBalance = _balances[user];
        _balances[user] = oldAccountBalance - amount;
        _burn(user, amount);

        IERC20(UNDERLYING_ASSET_ADDRESS).safeTransfer(receiverOfUnderlying, amount);

        emit Transfer(user, address(0), amount);
        emit Burn(user, receiverOfUnderlying, amount, index);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function balanceWithYieldOf(address user)
    public
    view
    returns (uint256)
    {
        uint256 userBalance = _balances[user];
        return userBalance.rayMul(POOL.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS));
    }
}
