// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "../interfaces/IPriceConsumer.sol";

contract PriceConsumer is IPriceConsumer, Ownable {
    mapping(address => address) priceFeeds;

    /**
     * @dev get Price of Token
     * @param _token address of token
     */
    function getPriceOfToken(address _token) external view override returns (uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(priceFeeds[_token]);
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return price > 0 ? uint256(price) : 0;
    }

    /**
     * @dev set Price feed
     * @param _token address of token
     * @param _priceFeed address of price feed
     */
    function addPriceFeed(address _token, address _priceFeed) external onlyOwner {
        priceFeeds[_token] = _priceFeed;
    }
}
