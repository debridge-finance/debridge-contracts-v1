// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./forkedInterfaces/IDeBridgeGate.sol";
import "../interfaces/ICallProxy.sol";

contract InvitationContract {

    uint256 public code;
    IDeBridgeGate public deBridgeGate;

    mapping(uint256 => bytes) public getAccountByCode;
    mapping(bytes => uint256) public getCodeByAccount;

    event Registered(bytes account, uint256 code);

    error CallProxyBadRole();
    error ZeroSender();

    constructor(IDeBridgeGate _deBridgeGate) {
        deBridgeGate = _deBridgeGate;
        code = 0;
    }

    modifier onlyCallProxy() {
        if (deBridgeGate.callProxy() != msg.sender) revert CallProxyBadRole();
        _;
    }

    function onBridgedMessage() external virtual onlyCallProxy returns (bool) {
        ICallProxy callProxy = ICallProxy(deBridgeGate.callProxy());
        bytes memory nativeSender = callProxy.submissionNativeSender();
        if (nativeSender.length == 0) revert ZeroSender();
        return _setCode(nativeSender);
    }

    function register() external returns (bool) {
        return _setCode(abi.encodePacked(msg.sender));
    }

    function _setCode(bytes memory _customer) internal returns (bool) {
        if (getCodeByAccount[_customer] == 0) {
            code ++;
            getAccountByCode[code] = _customer;
            getCodeByAccount[_customer] = code;
            emit Registered(_customer, code);
            return true;
        }
        return false;
    }
}