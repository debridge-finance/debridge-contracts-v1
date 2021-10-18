// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../oracles/DelegatedStaking.sol";

contract MockDelegatedStaking is DelegatedStaking {

    function initializeMock(
        uint256 _withdrawTimelock,
        IPriceConsumer _priceConsumer,
        ISwapProxy _swapProxy,
        address _slashingTreasury
    ) public initializer {
        DelegatedStaking.initialize( _withdrawTimelock,
        _priceConsumer,
        _swapProxy,
        _slashingTreasury);
    }

    // ============ Version Control ============
    function version2() external pure returns (uint256) {
        return 102; // 1.0.1
    }
}
