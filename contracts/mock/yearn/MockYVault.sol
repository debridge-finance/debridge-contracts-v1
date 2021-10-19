// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./IController.sol";
import "./IVault.sol";
import "./MockYToken.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockYearnVault is IVault {
    using Address for address;
    using SafeERC20 for IERC20;

    address public token;
    address public underlying;

    uint256 public min = 9500;
    uint256 public constant max = 10000;

    address public governance;
    address public controller;

    constructor(address _token, address _controller)
    {
        token = _token;
        underlying = address(MockYToken(_token).token());
        governance = msg.sender;
        controller = _controller;
    }

    function balance() public view returns (uint256) {
        return IERC20(token).balanceOf(address(this)) + (IController(controller).balanceOf(token));
    }

    function balanceOf(address _account) public view returns (uint256) {
        return IERC20(token).balanceOf(_account);
    }

    function totalAssets() public view override returns (uint256) {
        return IERC20(token).balanceOf((address(this)));
    }

    function decimals() external view override returns (uint256) {
        return ERC20(token).decimals();
    }

    function pricePerShare() public pure override returns (uint256) {
        // TODO: increase current time like aave mocks
        return 15*1e17;
    }

    function setController(address _controller) public {
        require(msg.sender == governance, "!governance");
        controller = _controller;
    }

    function deposit(uint256 _amount) public override {
        uint256 _pool = balance();
        uint256 _before = IERC20(underlying).balanceOf(address(this));
        IERC20(underlying).safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _after = IERC20(underlying).balanceOf(address(this));
        _amount = _after - _before; // Additional check for deflationary tokens
        uint256 shares = 0;
        if (IERC20(token).totalSupply() == 0) {
            shares = _amount;
        } else {
            shares = (_amount * (IERC20(token).totalSupply())) / (_pool);
        }
        MockYToken(token).mint(msg.sender, shares);
    }

    function withdrawAll() external override {
        withdraw(IERC20(token).balanceOf(msg.sender));
    }

    function withdraw(uint256 _shares) public override returns(uint256) {
        uint256 r = (balance() * (_shares)) / (IERC20(token).totalSupply());
        MockYToken(token).burn(msg.sender, _shares);

        uint256 b = IERC20(token).balanceOf(address(this));
        if (b < r) {
            uint256 _withdraw = r - b;
            IController(controller).withdraw(address(token), _withdraw);
            uint256 _after = IERC20(token).balanceOf(address(this));
            uint256 _diff = _after - b;
            if (_diff < _withdraw) {
                r = b + _diff;
            }
        }
        IERC20(underlying).safeTransfer(msg.sender, r);
        return r;
    }
}
