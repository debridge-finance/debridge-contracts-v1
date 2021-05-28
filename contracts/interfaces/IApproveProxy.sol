// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IApproveProxy {
    function callERC20(
        address _token,
        address _fallbackAddress,
        address _receiver,
        bytes memory _data
    ) external returns (bool);
}
