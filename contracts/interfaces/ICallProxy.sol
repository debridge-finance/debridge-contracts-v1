// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface ICallProxy {

    function submissionChainIdFrom() external returns (uint256);
    function submissionNativeSender() external returns (bytes memory);

    function call(
        address _fallbackAddress,
        address _receiver,
        bytes memory _data,
        uint256 _flags,
        bytes memory _nativeSender,
        uint256 _chainIdFrom
    ) external payable returns (bool);

    function callERC20(
        address _token,
        address _fallbackAddress,
        address _receiver,
        bytes memory _data,
        uint256 _flags,
        bytes memory _nativeSender,
        uint256 _chainIdFrom
    ) external returns (bool);
}
