// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../interfaces/IStrategy.sol";
import "./MockStrategy.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract BadMockStrategy is MockStrategy {
    using SafeERC20 for IERC20;
    constructor(address _defiController) MockStrategy(_defiController) public { }

    function withdraw(address _token, uint256 _amount) public override returns(uint256 _yield, uint256 _body){
        //bad withdraw for
        _yield=1;
        _body=_amount+_amount/2;
        IERC20(_token).safeTransfer(address(defiController),_body+_yield);
    }
}