// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "../periphery/DeBridgeToken.sol";

/// @dev Variation of DeBridgeToken contract with paused token transfers.
contract DeBridgeTokenPaused is DeBridgeToken {

    function _beforeTokenTransfer(
        address /* from */,
        address /* to */,
        uint256 /* amount */
    ) internal virtual override {
        revert("DeBridgeToken paused");
    }
}
