// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.7;

interface IDeCallProxy {
    function deCall(
        address _destination,
        uint256 _chainIdFrom,
        address _nativeSender,
        bytes calldata _data
    ) external payable returns (bool result);
}
