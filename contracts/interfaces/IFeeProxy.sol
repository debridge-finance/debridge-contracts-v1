// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IFeeProxy {
    // function swapToLink(
    //     address _erc20Token,
    //     address _receiver
    // ) external;

    function transferToTreasury(
        bytes32 _debridgeId,
        address _tokenAddress,
        uint256 _nativeChain
    ) external payable;

    /// @dev Swap  Native tokens to deETH and then transfer reward to Ethereum network.
    function transferNativeToTreasury(
        bytes32 _wethDebridgeId,
        uint256 _nativeFixFee
    ) external payable;
}
