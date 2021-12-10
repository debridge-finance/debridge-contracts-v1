// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.7;

import "../interfaces/ICallProxy.sol";

contract MockCallProxy is ICallProxy {
    uint256 public override submissionChainIdFrom;
    bytes public override submissionNativeSender;

    event MockCallProxyCallSuccess();
    event MockCallProxyCallFail();

    function call(
        address,
        address _receiver,
        bytes memory _data,
        uint256,
        bytes memory _nativeSender,
        uint256 _chainIdFrom
    ) external payable override returns (bool) {
        submissionChainIdFrom = _chainIdFrom;
        submissionNativeSender = _nativeSender;
        (bool success,) = payable(_receiver).call{value: msg.value}(_data);

        if (success) {
            emit MockCallProxyCallSuccess();
        } else {
            emit MockCallProxyCallFail();
        }

        return success;
    }

    function callERC20(
        address,
        address,
        address,
        bytes memory,
        uint256,
        bytes memory,
        uint256
    ) external pure override returns (bool) {
        //NOP for now
        return false;
    }
}
