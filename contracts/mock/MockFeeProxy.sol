// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../periphery/FeeProxy.sol";

contract MockFeeProxy is FeeProxy {
    uint256 chainId;

    function initializeMock(IUniswapV2Factory _uniswapFactory, IWETH _weth) public initializer {
        FeeProxy.initialize(_uniswapFactory, _weth);
    }

    /// @dev override chain id (BSC/HECO)
    function overrideChainId(uint256 _chainId) external onlyAdmin {
        chainId = _chainId;
    }

    // return overrided chain id
    function getChainId() public view override returns (uint256 cid) {
        return chainId;
    }
}
