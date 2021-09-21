// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IFeeProxy {
    // function swapToLink(
    //     address _erc20Token,
    //     address _receiver
    // ) external;

    function swap(
        address _fromToken,
        address _toToken,
        address _receiver,
        uint256 _amount
    ) external returns(uint256);

    function transferToTreasury(
        bytes32 _debridgeId,
        // address _erc20Token,
        // uint256 _nativeChain,
        uint256 nativeFixFee
    ) external payable;
}
