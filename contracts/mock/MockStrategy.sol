// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStrategy.sol";

contract MockStrategy is IStrategy {
    
    using SafeERC20 for IERC20;

    function deposit(address _token, uint256 _amount) external override {
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
    }

    function withdraw(address _token, uint256 _amount) external override {
        
    }

    function withdrawAll(address _token) external override {

    }

    function updateReserves(address _account, address _token) 
        external 
        view 
        override 
        returns(uint256)
    {
        
    }
}