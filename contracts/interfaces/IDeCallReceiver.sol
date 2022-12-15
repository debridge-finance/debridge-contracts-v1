// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.7;

interface IDeCallReceiver {
    function onDeCall(
        uint256 _chainIdFrom,
        address _nativeSender,
        bytes calldata _data
    ) external returns (bool result);
}
