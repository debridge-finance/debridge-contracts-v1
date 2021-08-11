// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

contract LendingPoolAddressesProvider {
    address private lendingPool;

    function getLendingPool() external view returns (address) {
        return lendingPool;
    }

    function setLendingPool(address _lendingPool) external {
        lendingPool = _lendingPool;
    }
}
