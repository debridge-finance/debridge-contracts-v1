// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockAToken is ERC20 {
    using SafeERC20 for IERC20;

    uint8 private _decimals;
    address public immutable UNDERLYING_ASSET_ADDRESS;

    event Mint(address indexed to, uint256 value, uint256 index);
    event Burn(address indexed from, address indexed target, uint256 value, uint256 index);

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimal,
        address uderlyingAssetAddress
    ) ERC20(_name, _symbol) {
        _decimals = _decimal;
        UNDERLYING_ASSET_ADDRESS = uderlyingAssetAddress;
    }

    function mint(
        address user,
        uint256 amount,
        uint256 index
    ) external returns (bool) {
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
        _burn(user, amount);

        IERC20(UNDERLYING_ASSET_ADDRESS).safeTransfer(receiverOfUnderlying, amount);

        emit Transfer(user, address(0), amount);
        emit Burn(user, receiverOfUnderlying, amount, index);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
