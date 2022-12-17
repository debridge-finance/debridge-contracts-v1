// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../interfaces/IDeCallProxy.sol";
import "../interfaces/IDeCallReceiver.sol;"

/// @dev Proxy to execute the other contract calls.
/// This contract is used when a user requests transfer with specific call of other contract.
contract DeCallProxy is Initializable, AccessControlUpgradeable, IDeCallProxy {
    bytes32 public constant CALL_PROXY_ROLE = keccak256("CALL_PROXY_ROLE");

    error CallProxyBadRole();

    modifier onlyCallProxyRole() {
        if (!hasRole(CALL_PROXY_ROLE, msg.sender)) revert CallProxyBadRole();
        _;
    }

    function deCall(
        address _destination,
        uint256 _chainIdFrom,
        address _nativeSender,
        bytes calldata _data
    ) external payable override onlyCallProxyRole returns (bool result) {
        result = IDeCallReceiver(_destination).onDeCall{value: msg.value}(
            _chainIdFrom,
            _nativeSender,
            _data
        );
    }
}
