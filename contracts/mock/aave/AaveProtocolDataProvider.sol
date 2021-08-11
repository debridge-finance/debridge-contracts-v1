// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
import {LendingPoolAddressesProvider} from "./LendingPoolAddressesProvider.sol";
import {LendingPool} from "./LendingPool.sol";

contract AaveProtocolDataProvider {
    LendingPoolAddressesProvider public immutable ADDRESSES_PROVIDER;

    constructor(LendingPoolAddressesProvider addressesProvider) public {
        ADDRESSES_PROVIDER = addressesProvider;
    }

    function getReserveTokensAddresses(address asset)
        external
        view
        returns (
            address aTokenAddress,
            address stableDebtTokenAddress,
            address variableDebtTokenAddress
        )
    {
        LendingPool.ReserveData memory reserve = LendingPool(ADDRESSES_PROVIDER.getLendingPool())
            .getReserveData(asset);

        return (
            reserve.aTokenAddress,
            reserve.stableDebtTokenAddress,
            reserve.variableDebtTokenAddress
        );
    }
}
