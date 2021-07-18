// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapV2Factory.sol";
import "../interfaces/IFeeProxy.sol";

contract FeeProxy is IFeeProxy{
    address public linkToken;
    IUniswapV2Factory public uniswapFactory;

    constructor(address _linkToken, IUniswapV2Factory _uniswapFactory) {
        linkToken = _linkToken;
        uniswapFactory = _uniswapFactory;
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountOut) {
        require(amountIn > 0, "getAmountOut: insuffient amount");
        require(
            reserveIn > 0 && reserveOut > 0,
            "getAmountOut: insuffient liquidity"
        );
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function swapToLink(
        address _erc20Token,
        address _receiver
    ) external override{
        IERC20 erc20 = IERC20(_erc20Token);
        uint256 _amount = erc20.balanceOf(address(this));
        IUniswapV2Pair uniswapPair =
            IUniswapV2Pair(uniswapFactory.getPair(linkToken, _erc20Token));
        erc20.transfer(address(uniswapPair), _amount);
        bool linkFirst = linkToken < _erc20Token;
        (uint256 reserve0, uint256 reserve1, ) = uniswapPair.getReserves();
        if (linkFirst) {
            uint256 amountOut = getAmountOut(_amount, reserve1, reserve0);
            uniswapPair.swap(amountOut, 0, _receiver, "");
        } else {
            uint256 amountOut = getAmountOut(_amount, reserve0, reserve1);
            uniswapPair.swap(0, amountOut, _receiver, "");
        }
    }
}
