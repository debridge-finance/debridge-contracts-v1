// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IFeeProxy {
    // function swapToLink(
    //     address _erc20Token,
    //     address _receiver
    // ) external;

    function transferToTreasury(
        bytes32 _debridgeId,
        // address _erc20Token,
        // uint256 _nativeChain,
        uint256 nativeFixFee,
        address _tokenAddress,
        uint256 _nativeChain
    ) external payable;
}
