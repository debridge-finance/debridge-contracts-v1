// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../interfaces/IUniswapV2ERC20.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapV2Factory.sol";
import "../interfaces/IPriceConsumer.sol";
import "hardhat/console.sol";

contract PriceConsumer is IPriceConsumer, Ownable, Initializable {
    address public weth;
    address public factory;

    function initialize(address _weth, address _factory) public initializer {
        weth = _weth;
        factory = _factory;
    }

    /**
     * @dev get Price of Token in WETH
     * @param _token address of token
     */
    function getPriceOfTokenInWETH(address _token) external view override returns (uint256) {
        return getRate(_token, weth);
    }

    /**
     * @dev get Price of Token in another token.
     * returns price in decimals of quote token
     * @param _base address of base token
     * @param _quote address of quote token
     * ETH/USD = 3000 (ETH is base, USD is quote)
     * Rate = reserveQuote / reserveBase
     */
    function getRate(address _base, address _quote) public view override returns (uint256) {
        address pairAddress = getPairAddress(_base, _quote);
        if (pairAddress != address(0)) {
            IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
            address token0address = pair.token0();
            IUniswapV2ERC20 token0 = IUniswapV2ERC20(token0address);
            IUniswapV2ERC20 token1 = IUniswapV2ERC20(pair.token1());
            (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();

            if (token0address == _base) {
                // token0 = _base, token1 = _quote
                // rate = reserve1 / reserve0
                uint256 res1 = reserve1 * (10**token0.decimals());
                return res1 / reserve0;
            } else {
                // token0 = _quote, token1 = _base
                // rate = reserve0 / reserve1
                uint256 res0 = reserve0 * (10**token1.decimals());
                return res0 / reserve1;
            }
        } else {
            return 0;
        }
    }

    function getPairAddress(address _token0, address _token1) public view override returns (address) {
        IUniswapV2Factory _factory = IUniswapV2Factory(factory);
        return _factory.getPair(_token0, _token1);
    }
}
