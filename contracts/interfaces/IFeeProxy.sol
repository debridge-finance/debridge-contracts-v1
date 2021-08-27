// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IFeeProxy {
    function withdrawFee(address _tokenAddress) external payable;

    /// @dev Swap  Native tokens to deETH and then transfer reward to Ethereum network.
    function withdrawNativeFee() external payable;
}
