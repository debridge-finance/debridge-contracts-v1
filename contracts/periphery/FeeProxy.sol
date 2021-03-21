// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapV2Factory.sol";

contract FeeProxy {
    address public linkToken;
    IUniswapV2Factory public uniswapFactory;

    constructor(address _linkToken, IUniswapV2Factory _uniswapFactory) {
        linkToken = _linkToken;
        uniswapFactory = _uniswapFactory;
    }

    function swapToLink(
        address _erc20Token,
        uint256 _amount,
        address _receiver
    ) external {
        IERC20 erc20 = IERC20(_erc20Token);
        _amount = erc20.balanceOf(address(this));
        IUniswapV2Pair uniswapPair =
            IUniswapV2Pair(uniswapFactory.getPair(linkToken, _erc20Token));
        erc20.transfer(address(uniswapPair), _amount);
        bool linkFirst = linkToken < _erc20Token;
        if (linkFirst) {
            uniswapPair.swap(0, _amount, _receiver, "");
        } else {
            uniswapPair.swap(_amount, 0, _receiver, "");
        }
    }
}
