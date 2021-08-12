// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../interfaces/IStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockStrategy is IStrategy {
    using SafeERC20 for IERC20;
    address public defiController;
    constructor(address _defiController){
        defiController=_defiController;
    }

    function deposit(address _token, uint256 _amount) external override {
        IERC20(_token).safeTransferFrom(address(defiController),address(this),_amount);
    }

    function withdraw(address _token, uint256 _amount) public virtual override returns(uint256 _yield, uint256 _body){
        //bad withdraw for
        _yield=1;
        _body=_amount;
        IERC20(_token).safeTransfer(address(defiController),_body+_yield);
    }

    function withdrawAll(address token) external override {

    }

    function updateReserves(address account, address token) 
        external 
        view 
        override 
        returns(uint256) {}

    function sendETH() external payable{}
}