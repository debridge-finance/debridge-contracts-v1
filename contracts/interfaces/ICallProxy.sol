// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface ICallProxy {
    function call(
        address _fallbackAddress,
        address _receiver,
        bytes memory _data,
        uint8 _reservedFlag,
        bytes memory _nativeSender
    ) external payable returns (bool);

    function callERC20(
        address _token,
        address _fallbackAddress,
        address _receiver,
        bytes memory _data,
        uint8 _reservedFlag,
        bytes memory _nativeSender
    ) external returns (bool);
}
