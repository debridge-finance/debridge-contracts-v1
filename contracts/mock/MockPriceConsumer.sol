// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../interfaces/IPriceConsumer.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockPriceConsumer is IPriceConsumer, Ownable {
    mapping(address => uint256) public priceFeeds;

    /**
     * @dev get Price of Token
     * @param _token address of token
     */
    function getPriceOfToken(address _token) external override view returns(uint256){
        return priceFeeds[_token];
    }

    /**
     * @dev set Price feed
     * @param _token address of token
     * @param _price constant price of token
     */
    function addPriceFeed(address _token, uint256 _price) external onlyOwner(){
        priceFeeds[_token] = _price;
    }
}