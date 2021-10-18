// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IYearnVault is IERC20 {
    function deposit(uint256 _amount, address recipient) external returns (uint256);
    function withdraw(uint256 maxShares, address recipient, uint256 maxLoss) external returns (uint256);
    function token() external view returns (address);
    function controller() external view returns (address);
}
