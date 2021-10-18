// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./YRegistry.sol";
import "./MockYVault.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockYToken is ERC20 {

    uint256 constant MAXUINT256 = type(uint256).max;

    string private _name;
    string private _symbol;
    uint8 private _decimals;
    YRegistry public registry;
    IERC20 public token;

    constructor(
        address _registry,
        string memory name,
        string memory symbol,
        uint8 decimals,
        address _token
    ) ERC20(name, symbol) {
        _name = name;
        _symbol = symbol;
        _decimals = decimals;
        token = IERC20(_token);
        registry = YRegistry(_registry);
    }

    function setRegistry(address _registry) external {
        registry = YRegistry(_registry);
    }

    function totalSupply() public view override returns (uint256 total) {
        return totalAssets();
    }

    function balanceOf(address account) public view override returns (uint256 balance) {
        return totalVaultBalance(account);
    }

    function _transfer(
        address sender,
        address receiver,
        uint256 amount
    ) internal override {
        require(receiver != address(0), "ERC20: transfer to the zero address");
        require(amount == _withdraw(sender, receiver, amount));
        emit Transfer(sender, receiver, amount);
    }

    function transfer(address receiver, uint256 amount) public override returns (bool) {
        _transfer(msg.sender, receiver, amount);
        return true;
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external {
        _burn(account, amount);
    }

    function deposit(uint256 amount) external returns (uint256) {
        return _deposit(msg.sender, msg.sender, amount, true); // `true` = pull from sender
    }

    function withdraw(uint256 amount) external returns (uint256) {
        return _withdraw(msg.sender, msg.sender, amount);
    }

    function allVaults() public view virtual returns (MockYearnVault[] memory) {
        return registry.getVaults();
    }

    function totalVaultBalance(address account) public view returns (uint256 balance) {
        MockYearnVault[] memory vaults = allVaults();

        for (uint256 id = 0; id < vaults.length; id++) {
            balance = balance + (vaults[id].balanceOf(account) * (vaults[id].pricePerShare()) / (10**uint256(vaults[id].decimals())));
        }
    }

    function totalAssets() public view returns (uint256 assets) {
        MockYearnVault[] memory vaults = allVaults();

        for (uint256 id = 0; id < vaults.length; id++) {
            assets = assets + (vaults[id].totalAssets());
        }
    }

    function _deposit(
        address depositor,
        address receiver,
        uint256 amount,
        bool pullFunds // If true, funds need to be pulled from `depositor` via `transferFrom`
    ) internal returns (uint256 deposited) {
        MockYearnVault[] memory vaults = allVaults();
        MockYearnVault _bestVault = vaults[vaults.length - 1];

        if (pullFunds) {
            if (amount == MAXUINT256) {
                amount = token.balanceOf(depositor);
            }
            SafeERC20.safeTransferFrom(token, depositor, address(this), amount);
        }

        if (token.allowance(address(this), address(_bestVault)) < amount) {
            SafeERC20.safeApprove(token, address(_bestVault), 0); // Avoid issues with some tokens requiring 0
            SafeERC20.safeApprove(token, address(_bestVault), MAXUINT256); // Vaults are trusted
        }

        uint256 beforeBal = token.balanceOf(address(this));
        _bestVault.deposit(amount);

        uint256 afterBal = token.balanceOf(address(this));
        deposited = beforeBal - afterBal;
        // `receiver` now has shares of `_bestVault` as balance, converted to `token` here
        // Issue a refund if not everything was deposited
        if (depositor != address(this) && afterBal > 0) SafeERC20.safeTransfer(token, receiver, afterBal);
    }

    function _withdraw(
        address sender,
        address receiver,
        uint256 amount
    ) internal returns (uint256 withdrawn) {

        MockYearnVault[] memory vaults = allVaults();

        for (uint256 id = 0; id < vaults.length; id++) {
            if (amount > 0) {
                if (sender != address(this)) IERC20(token).transferFrom(address(vaults[id]), address(this), amount);

                if (amount != MAXUINT256) {
                    // Compute amount to withdraw fully to satisfy the request
                    uint256 estimatedShares = amount
                    - (withdrawn) // NOTE: Changes every iteration
                    * (10**uint256(vaults[id].decimals()))
                    / (vaults[id].pricePerShare()); // NOTE: Every Vault is different
                    if (estimatedShares > 0) {
                        withdrawn = withdrawn + vaults[id].withdraw(estimatedShares);
                    }
                } else {
                    withdrawn = IERC20(token).balanceOf(msg.sender);
                }

                // Check if we have fully satisfied the request
                if (amount <= withdrawn) break; // withdrawn as much as we needed
            }
        }

        // `receiver` now has `withdrawn` tokens as balance
        if (receiver != address(this)) SafeERC20.safeTransfer(token, receiver, withdrawn);
    }
}
