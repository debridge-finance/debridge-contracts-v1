// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "../periphery/FeeProxy.sol";

//TODO: set debridgeGate, treasury, weth
contract MockFeeProxy is FeeProxy {
    constructor(
        // address _linkToken,
        IUniswapV2Factory _uniswapFactory,
        IWETH _weth,
        // IDeBridgeGate _debridgeGate,
        address _treasury
    )
        public
        // address _deEthToken
        FeeProxy(_uniswapFactory, _weth, _treasury)
    {}

    /// @dev override chain id (BSC/HECO)
    function overrideChainId(uint256 _chainId) external onlyAdmin {
        chainId = _chainId;
    }
}
