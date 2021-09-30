// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapV2Factory.sol";
import "../interfaces/IPriceConsumer.sol";

contract PriceConsumer is IPriceConsumer, Ownable {
    address public constant WETH = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    address public constant UNISWAP_FACTORY = address(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f);
    mapping(address => address) priceFeeds;

    /**
     * @dev get Price of Token in WETH
     * @param _token address of token
     */
    function getPriceOfToken(address _token) external override view returns (uint256){
        return getRate(_token, WETH);
    }

    /**
     * @dev get Price of Token in another token
     * @param _base address of base token
     * @param _quote address of quote token
     * ETH/USD = 3000 (ETH is base, USD is quote)
     * Rate = reserveQuote / reserveBase
     */
    function getRate(address _base, address _quote) external override view returns (uint256){
        address pairAddress = getPairAddress(_base, _quote);
        if (pairAddress != address(0)) {
            IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
            address token0address = pair.token0();
            IERC20 token0 = IERC20(token0address);
            IERC20 token1 = IERC20(pair.token1());
            (uint reserve0, uint reserve1,) = pair.getReserves();

            if (token0address == _base) {
                // token0 = _base, token1 = _quote
                // rate = reserve1 / reserve0
                return (reserve1 / 10 ** token1.decimals()) / (reserve0 / 10 ** token0.decimals());
            } else {
                // token0 = _quote, token1 = _base
                // rate = reserve0 / reserve1
                return (reserve0 / 10 ** token0.decimals()) / (reserve1 / 10 ** token1.decimals());
            }
        } else {
            return 0;
        }
    }

    function getPairAddress(address _from, address _to) internal view returns (address) {
        IUniswapV2Factory factory = IUniswapV2Factory(UNISWAP_FACTORY);
        return factory.getPair(_from, _to);
    }
}
