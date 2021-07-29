// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// MockProxyReceiver receives payable and non-payable calls from CallProxy.sol.
// Used for positive proxy tests
contract MockProxyReceiver {

    uint256 public result = 0;
    uint256[] public resultArray;
    uint256 public weiReceived = 0;
    string public lastHit = "";

    function setUint256Payable(uint256 _result) external payable {
        lastHit = "setUint256Payable";
        result = _result;
        weiReceived = msg.value;
    }

    function setArrayUint256Payable(uint256[] memory _result) external payable {
        lastHit = "setArrayUint256Payable";
        resultArray = _result;
        weiReceived = msg.value;
    }

    // This function is called for all messages sent to
    // this contract, except plain Ether transfers
    // (there is no other function except the receive function).
    // Any call with non-empty calldata to this contract will execute
    // the fallback function (even if Ether is sent along with the call).
    fallback() external payable {
        lastHit = "fallback";
        weiReceived = msg.value;
    }

    // This function is called for plain Ether transfers, i.e.
    // for every call with empty calldata.
    receive() external payable {
        lastHit = "receive";
        weiReceived = msg.value;
    }
}
