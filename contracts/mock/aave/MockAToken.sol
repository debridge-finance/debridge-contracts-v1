// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IncentivesController} from "./IncentivesController.sol";
import {LendingPool} from "./LendingPool.sol";
import {WadRayMath} from "./libraries/WadRayMath.sol";


contract MockAToken is ERC20 {
    using SafeERC20 for IERC20;
    using WadRayMath for uint256;

    LendingPool public immutable POOL;
    IncentivesController public immutable INCENTIVES_CONTROLLER;
    uint8 private _decimals;
    address public immutable UNDERLYING_ASSET_ADDRESS;
    mapping(address => uint256) internal _balances;

    event Mint(address indexed to, uint256 value, uint256 index);
    event Burn(address indexed from, address indexed target, uint256 value, uint256 index);

    constructor(
        LendingPool pool,
        IncentivesController controller,
        string memory _name,
        string memory _symbol,
        uint8 _decimal,
        address uderlyingAssetAddress
    ) ERC20(_name, _symbol) {
        POOL = pool;
        INCENTIVES_CONTROLLER = controller;
        _decimals = _decimal;
        UNDERLYING_ASSET_ADDRESS = uderlyingAssetAddress;
    }

    // NOTE: it's mocked implementation of mint method
    // in original mint amount could be scaled, depends of lendingPool.liquidityIndex
    function mint(
        address user,
        uint256 amount,
        uint256 index
    ) external returns (bool) {
        _balances[user] += amount;
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
        uint256 amountScaled = amount.rayDiv(index);
        require(amountScaled != 0, "CT_INVALID_BURN_AMOUNT");

        _balances[user] -= amount;
        _burn(user, amount);

        IERC20(UNDERLYING_ASSET_ADDRESS).safeTransfer(receiverOfUnderlying, amount);

        emit Transfer(user, address(0), amount);
        emit Burn(user, receiverOfUnderlying, amount, index);
    }

    function hack(
        address[] calldata users
    ) external {
        for(uint256 i = 0; i<users.length; i++) {
            _balances[users[i]] = _balances[users[i]]/2;
        }
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function balanceOf(address user)
    public
    view
    override
    returns (uint256)
    {
        return _balances[user];
    }

    function balanceOfAToken(address user)
    public
    returns (uint256)
    {
        uint256 userBalance = _balances[user];
        _balances[user] = userBalance.rayMul(POOL.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS));
        return _balances[user];
    }

    function getIncentivesController() external view returns (IncentivesController) {
        return INCENTIVES_CONTROLLER;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
         _transfer(sender, recipient, amount);

        _balances[sender] -= amount;
        _balances[recipient] += amount;

        return true;
    }
}
