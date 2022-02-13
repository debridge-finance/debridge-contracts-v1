// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./BridgeAppBase.sol";
import "./forkedInterfaces/IDeBridgeGate.sol";

contract InvitationContract is BridgeAppBase {
    uint256 public code;

    mapping(uint256 => bytes) public getAccountByCode;
    mapping(bytes => uint256) public getCodeByAccount;

    event Registered(bytes account, uint256 code);

    error ZeroSender();

    function initialize(IDeBridgeGate _deBridgeGate) external initializer {
        __BridgeAppBase_init(_deBridgeGate);
        code = 0;
    }

    modifier onlyCallProxy() {
        if (deBridgeGate.callProxy() != msg.sender) revert CallProxyBadRole();
        _;
    }

    function onBridgedMessage() external virtual onlyCallProxy whenNotPaused returns (bool) {
        ICallProxy callProxy = ICallProxy(deBridgeGate.callProxy());
        bytes memory nativeSender = callProxy.submissionNativeSender();
        if (nativeSender.length == 0) revert ZeroSender();
        return _setCode(nativeSender);
    }

    function register() external whenNotPaused returns (bool) {
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