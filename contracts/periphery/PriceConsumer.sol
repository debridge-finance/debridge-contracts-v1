// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapV2ERC20.sol";
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
    function getPriceOfToken(address _token) external override view returns(uint256){
        address pairAddress = getPair(_token, WETH);
        if (pairAddress != address(0)) {
            IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
            IUniswapV2ERC20 token0 = IUniswapV2ERC20(pair.token0());
            IUniswapV2ERC20 token1 = IUniswapV2ERC20(pair.token1());
            (uint Res0, uint Res1,) = pair.getReserves();

            // decimals
            uint res0 = Res0*(10**token1.decimals());
            return((amount*res0)/Res1); // return amount of token0 needed to buy token1
        } else {
            return 0;
        }
    }

    function getPair(address _from, address _to) internal view returns(address) {
        IUniswapV2Factory factory = IUniswapV2Factory(UNISWAP_FACTORY);
        return factory.getPair(_from, _to);
    }
}
