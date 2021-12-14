// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "../interfaces/IWETH.sol";
import "../interfaces/IWethGate.sol";

/// @dev Upgradable contracts cannot receive ether via `transfer` because of increased SLOAD gas cost.
/// We use this non-upgradeable contract as the recipient and then immediately transfer to an upgradable contract.
/// More details about this issue can be found
/// [here](https://forum.openzeppelin.com/t/openzeppelin-upgradeable-contracts-affected-by-istanbul-hardfork/1616).
contract WethGate is IWethGate
{
    /// @dev Wrapped native token contract
    IWETH public weth;

    /* ========== ERRORS ========== */

    error EthTransferFailed();

    /* ========== EVENTS ========== */
    /// @dev Emitted when any amount is withdrawn.
    event Withdrawal(address indexed receiver, uint wad);

    /* ========== CONSTRUCTOR  ========== */

    constructor(IWETH _weth) {
        weth = _weth;
    }

    /// @inheritdoc IWethGate
    function withdraw(address _receiver, uint _wad) external override {
        weth.withdraw(_wad);
        _safeTransferETH(_receiver, _wad);
        emit Withdrawal(_receiver, _wad);
    }

    function _safeTransferETH(address _to, uint256 _value) internal {
        (bool success, ) = _to.call{value: _value}(new bytes(0));
        if (!success) revert EthTransferFailed();
    }

    // we need to accept ETH sends to unwrap WETH
    receive() external payable {
    }

    // ============ Version Control ============
    /// @dev Get this contract's version
    function version() external pure returns (uint256) {
        return 101; // 1.0.1
    }
}
