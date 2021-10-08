// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../periphery/FeeProxy.sol";

//TODO: set debridgeGate, treasury, weth
contract MockFeeProxyOne is FeeProxy{
   
    constructor(
        // address _linkToken, 
        IUniswapV2Factory _uniswapFactory,
        IWETH _weth,
        // IDeBridgeGate _debridgeGate, 
        address _treasury
        // address _deEthToken
        ) FeeProxy ()
    {
        initialize(_uniswapFactory, _weth);
    }

    function mock_set_debridge(address _debrdige) public {
        debridgeGate = IDeBridgeGate(_debrdige);
    }

    
}
