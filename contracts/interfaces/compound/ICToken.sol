// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICToken is IERC20  {
    function underlying() external view returns (address);
    function balanceOfUnderlying(address account) external returns (uint);
    function isCToken() external view returns (bool);
    function mint(uint mintAmount) external returns (uint);
    function redeem(uint redeemAmount) external returns (uint);
    function redeemUnderlying(uint redeemAmount) external returns (uint);

    // Accrue interest then return the up-to-date exchange rate
    function exchangeRateCurrent() external returns (uint);
    
    // Calculates the exchange rate from the underlying to the CToken
    // This function does not accrue interest before calculating the exchange rate
    function exchangeRateStored() external view returns (uint);
}
