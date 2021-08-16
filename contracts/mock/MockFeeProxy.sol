// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../periphery/FeeProxy.sol";

contract MockFeeProxy is FeeProxy{

    constructor(
        IUniswapV2Factory _uniswapFactory,
        IWETH _weth
        ) FeeProxy (_uniswapFactory, _weth)
    {

    }

    /// @dev override chain id (BSC/HECO)
    function overrideChainId(uint256 _chainId) external onlyAdmin() {
        chainId = _chainId;
    }
}
